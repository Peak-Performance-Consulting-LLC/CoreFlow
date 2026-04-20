import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/server.ts';

interface EnrollBody {
  record_id: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authContext = await authenticateRequest(request);
    if (authContext instanceof Response) return authContext;

    const { serviceClient, user } = authContext;

    const { record_id } = (await request.json()) as EnrollBody;
    if (!record_id) return jsonResponse({ error: 'record_id is required.' }, 400);

    // Resolve workspace from user
    const { data: memberRow } = await serviceClient
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!memberRow) return jsonResponse({ error: 'Workspace not found.' }, 404);
    const workspaceId = memberRow.workspace_id;

    // Check automation is enabled
    const { data: settings } = await serviceClient
      .from('workspace_email_automation_settings')
      .select('is_enabled')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!settings?.is_enabled) {
      return jsonResponse({ error: 'Email automation is disabled for this workspace.' }, 422);
    }

    // Get the default sender
    const { data: sender } = await serviceClient
      .from('workspace_email_senders')
      .select('id, sender_email, sender_name')
      .eq('workspace_id', workspaceId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();

    if (!sender) {
      return jsonResponse({ error: 'No default email sender configured.' }, 422);
    }

    // Check if already enrolled (active)
    const { data: existing } = await serviceClient
      .from('record_email_followups')
      .select('id, status')
      .eq('workspace_id', workspaceId)
      .eq('record_id', record_id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      return jsonResponse({ error: 'This lead is already enrolled in an active email sequence.' }, 409);
    }

    // Fetch the record to get lead name/email
    const { data: record } = await serviceClient
      .from('records')
      .select('id, title, email')
      .eq('id', record_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!record) return jsonResponse({ error: 'Record not found.' }, 404);

    const leadEmail = (record as Record<string, string>).email;
    if (!leadEmail) {
      return jsonResponse({ error: 'This record has no email address. Add one before enrolling.' }, 422);
    }

    // Fetch workspace info for template variables
    const { data: workspace } = await serviceClient
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .maybeSingle();

    const workspaceName = (workspace as Record<string, string> | null)?.name ?? 'us';

    // Load sequence steps
    const { data: steps } = await serviceClient
      .from('workspace_email_sequence_steps')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('step_order', { ascending: true });

    if (!steps || steps.length === 0) {
      return jsonResponse({ error: 'No active email sequence steps configured.' }, 422);
    }

    // Create followup record
    const { data: followup, error: followupError } = await serviceClient
      .from('record_email_followups')
      .insert({
        workspace_id: workspaceId,
        record_id,
        sender_id: sender.id,
        status: 'active',
        enrolled_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (followupError) return jsonResponse({ error: followupError.message }, 500);

    // Create scheduled followup steps
    const leadName = (record as Record<string, string>).title ?? 'there';
    const leadFirstName = leadName.split(' ')[0];

    const stepInserts = steps.map((
      step: Record<string, unknown>,
      idx: number,
    ) => {
      const previousDelayHours =
        idx === 0 ? 0 : steps.slice(0, idx).reduce((sum: number, s: Record<string, unknown>) => sum + (s.delay_hours as number), 0);
      const totalDelayMs = previousDelayHours * 60 * 60 * 1000 + (step.delay_hours as number) * 60 * 60 * 1000;
      const scheduledFor = new Date(Date.now() + totalDelayMs);

      const renderTemplate = (template: string) =>
        template
          .replace(/\{\{lead_full_name\}\}/g, leadName)
          .replace(/\{\{lead_first_name\}\}/g, leadFirstName)
          .replace(/\{\{lead_email\}\}/g, leadEmail)
          .replace(/\{\{workspace_name\}\}/g, workspaceName)
          .replace(/\{\{sender_name\}\}/g, sender.sender_name ?? sender.sender_email)
          .replace(/\{\{sender_email\}\}/g, sender.sender_email);

      return {
        workspace_id: workspaceId,
        followup_id: followup.id,
        sender_id: sender.id,
        step_order: step.step_order as number,
        status: 'pending',
        scheduled_for: idx === 0 ? new Date().toISOString() : scheduledFor.toISOString(),
        subject_rendered: renderTemplate(step.subject_template as string),
        body_rendered: renderTemplate(step.body_template as string),
        max_attempts: 3,
      };
    });

    const { error: stepError } = await serviceClient
      .from('record_email_followup_steps')
      .insert(stepInserts);

    if (stepError) return jsonResponse({ error: stepError.message }, 500);

    return jsonResponse({
      followup_id: followup.id,
      steps_scheduled: stepInserts.length,
      message: `Enrolled "${leadName}" in ${stepInserts.length}-step email sequence.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return jsonResponse({ error: message }, 500);
  }
});
