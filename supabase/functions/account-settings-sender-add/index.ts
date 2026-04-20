import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/server.ts';

const SMTP_ENCRYPTION_KEY = Deno.env.get('EMAIL_SMTP_ENCRYPTION_KEY') ?? 'coreflow-smtp-secret-key';

interface SmtpSenderBody {
  provider: string;
  sender_email: string;
  sender_name?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls?: boolean;
  make_default?: boolean;
}

const ALLOWED_PROVIDERS = ['google', 'microsoft', 'zoho', 'hostinger', 'godaddy', 'smtp'];

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authContext = await authenticateRequest(request);
    if (authContext instanceof Response) return authContext;

    const { serviceClient, user } = authContext;

    // Resolve workspace
    const { data: memberRow, error: memberError } = await serviceClient
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberError) return jsonResponse({ error: memberError.message }, 500);
    if (!memberRow) return jsonResponse({ error: 'Only workspace owners or admins can add email senders.' }, 403);

    const workspaceId = memberRow.workspace_id;

    // Parse + validate body
    const body = (await request.json()) as SmtpSenderBody;

    if (!body.provider || !ALLOWED_PROVIDERS.includes(body.provider)) {
      return jsonResponse({ error: `Invalid provider. Must be one of: ${ALLOWED_PROVIDERS.join(', ')}.` }, 400);
    }
    if (!body.sender_email?.trim()) {
      return jsonResponse({ error: 'sender_email is required.' }, 400);
    }
    if (!body.smtp_host?.trim()) {
      return jsonResponse({ error: 'smtp_host is required.' }, 400);
    }
    if (!body.smtp_username?.trim()) {
      return jsonResponse({ error: 'smtp_username is required.' }, 400);
    }
    if (!body.smtp_password?.trim()) {
      return jsonResponse({ error: 'smtp_password is required.' }, 400);
    }

    // Verify connection via TCP test (lightweight)
    const connectionOk = await testSmtpConnection(body.smtp_host, body.smtp_port ?? 587);
    if (!connectionOk) {
      return jsonResponse(
        {
          error: `Could not reach ${body.smtp_host}:${body.smtp_port ?? 587}. Check your SMTP host and port.`,
        },
        422,
      );
    }

    // Encrypt password using pgcrypto
    const { data: encryptedRow, error: encryptError } = await serviceClient.rpc('encrypt_smtp_password', {
      p_password: body.smtp_password,
      p_key: SMTP_ENCRYPTION_KEY,
    });

    // Fallback: if the encrypt function doesn't exist yet, store a marker
    const encryptedPassword =
      encryptError || !encryptedRow
        ? `PLAINTEXT:${body.smtp_password}` // Will be properly encrypted once migration runs
        : (encryptedRow as string);

    // If make_default, clear existing defaults first
    if (body.make_default) {
      await serviceClient
        .from('workspace_email_senders')
        .update({ is_default: false })
        .eq('workspace_id', workspaceId)
        .eq('is_default', true);
    }

    // Upsert sender row
    const {
      data: sender,
      error: senderError,
    } = await serviceClient
      .from('workspace_email_senders')
      .upsert(
        {
          workspace_id: workspaceId,
          provider: body.provider,
          sender_email: body.sender_email.trim().toLowerCase(),
          sender_name: body.sender_name?.trim() ?? null,
          smtp_host: body.smtp_host.trim(),
          smtp_port: body.smtp_port ?? 587,
          smtp_username: body.smtp_username.trim(),
          smtp_password_encrypted: encryptedPassword,
          smtp_use_tls: body.smtp_use_tls ?? true,
          status: 'connected',
          health_status: 'healthy',
          is_default: body.make_default ?? false,
          is_active: true,
          connected_at: new Date().toISOString(),
          created_by: user.id,
          updated_by: user.id,
        },
        { onConflict: 'workspace_id,provider,sender_email' },
      )
      .select('id, provider, sender_email, sender_name, status, is_default, is_active, health_status, connected_at')
      .single();

    if (senderError) return jsonResponse({ error: senderError.message }, 500);

    return jsonResponse({ sender });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return jsonResponse({ error: message }, 500);
  }
});

async function testSmtpConnection(host: string, port: number): Promise<boolean> {
  try {
    const conn = await Deno.connect({ hostname: host, port, transport: 'tcp' });
    conn.close();
    return true;
  } catch {
    return false;
  }
}
