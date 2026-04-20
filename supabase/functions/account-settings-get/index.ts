import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/server.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authContext = await authenticateRequest(request);
    if (authContext instanceof Response) return authContext;

    const { serviceClient, user } = authContext;

    // ── Look up workspace from the authenticated user (no body needed) ──
    const { data: memberRow, error: memberError } = await serviceClient
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberError) return jsonResponse({ error: memberError.message }, 500);
    if (!memberRow) return jsonResponse({ error: 'No workspace found for this user.' }, 404);

    const workspaceId = memberRow.workspace_id;

    // ── Ensure default email automation rows exist (idempotent) ──
    const { error: defaultsError } = await serviceClient.rpc(
      'ensure_workspace_email_automation_defaults',
      { target_workspace_id: workspaceId, actor_user_id: user.id },
    );

    // If the RPC isn't in the schema cache yet, skip gracefully instead of aborting
    if (defaultsError && !defaultsError.message?.includes('Could not find')) {
      return jsonResponse({ error: defaultsError.message }, 500);
    }

    // ── Fetch automation settings ──
    const { data: automationSettings, error: automationError } = await serviceClient
      .from('workspace_email_automation_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (automationError) return jsonResponse({ error: automationError.message }, 500);

    // ── Fetch senders ──
    const { data: senders, error: sendersError } = await serviceClient
      .from('workspace_email_senders')
      .select(
        'id, provider, sender_email, sender_name, status, is_default, is_active, health_status, connected_at, last_used_at',
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (sendersError) return jsonResponse({ error: sendersError.message }, 500);

    // ── Fetch sequence steps ──
    const { data: sequenceSteps, error: stepsError } = await serviceClient
      .from('workspace_email_sequence_steps')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('step_order', { ascending: true });

    if (stepsError) return jsonResponse({ error: stepsError.message }, 500);

    return jsonResponse({
      workspace_id: workspaceId,
      automation: automationSettings ?? null,
      senders: senders ?? [],
      sequence_steps: sequenceSteps ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return jsonResponse({ error: message }, 500);
  }
});
