import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/server.ts';

// OAuth configuration via Supabase secrets
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET') ?? '';
const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_OAUTH_CLIENT_ID') ?? '';
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_OAUTH_CLIENT_SECRET') ?? '';
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://coreflow.app';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MICROSOFT_AUTH_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = btoa(String.fromCharCode(...random))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // For simplicity, use plain challenge (real: SHA256)
  const codeChallenge = codeVerifier;
  return { codeVerifier, codeChallenge };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authContext = await authenticateRequest(request);
    if (authContext instanceof Response) return authContext;

    const { serviceClient, user } = authContext;

    const url = new URL(request.url);
    const action = url.searchParams.get('action'); // 'initiate' | 'callback'

    // ── Resolve workspace ──
    const { data: memberRow } = await serviceClient
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle();

    if (!memberRow) return jsonResponse({ error: 'Admin access required.' }, 403);
    const workspaceId = memberRow.workspace_id;

    if (action === 'initiate') {
      const body = (await request.json()) as { provider: 'google' | 'microsoft' };
      const provider = body.provider;

      if (!['google', 'microsoft'].includes(provider)) {
        return jsonResponse({ error: 'Invalid OAuth provider.' }, 400);
      }

      const clientId = provider === 'google' ? GOOGLE_CLIENT_ID : MICROSOFT_CLIENT_ID;
      if (!clientId) {
        return jsonResponse(
          {
            error: `OAuth not configured. Set ${
              provider === 'google' ? 'GOOGLE_OAUTH_CLIENT_ID' : 'MICROSOFT_OAUTH_CLIENT_ID'
            } in Supabase secrets.`,
          },
          503,
        );
      }

      const { codeVerifier, codeChallenge } = generatePKCE();
      const state = crypto.randomUUID();
      const redirectUri = `${APP_BASE_URL}/email/oauth-callback`;

      // Store session
      await serviceClient.from('email_oauth_sessions').insert({
        workspace_id: workspaceId,
        user_id: user.id,
        provider,
        state,
        code_verifier: codeVerifier,
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
        return_path: '/email',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
      });

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'plain',
        access_type: 'offline',
        prompt: 'consent',
      });

      if (provider === 'google') {
        params.set('scope', 'https://www.googleapis.com/auth/gmail.send email profile');
        return jsonResponse({ redirect_url: `${GOOGLE_AUTH_URL}?${params}` });
      } else {
        params.set(
          'scope',
          'https://graph.microsoft.com/Mail.Send offline_access email profile',
        );
        params.delete('access_type');
        params.delete('prompt');
        params.set('prompt', 'select_account');
        return jsonResponse({ redirect_url: `${MICROSOFT_AUTH_URL}?${params}` });
      }
    }

    if (action === 'callback') {
      const body = (await request.json()) as { code: string; state: string };
      const { code, state } = body;

      if (!code || !state) return jsonResponse({ error: 'Missing code or state.' }, 400);

      // Look up session
      const { data: session, error: sessionError } = await serviceClient
        .from('email_oauth_sessions')
        .select('*')
        .eq('state', state)
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .maybeSingle();

      if (sessionError || !session) return jsonResponse({ error: 'Invalid or expired OAuth session.' }, 400);

      if (new Date(session.expires_at) < new Date()) {
        await serviceClient
          .from('email_oauth_sessions')
          .update({ status: 'expired' })
          .eq('id', session.id);
        return jsonResponse({ error: 'OAuth session expired. Please try again.' }, 400);
      }

      const provider = session.provider as 'google' | 'microsoft';
      const clientId = provider === 'google' ? GOOGLE_CLIENT_ID : MICROSOFT_CLIENT_ID;
      const clientSecret = provider === 'google' ? GOOGLE_CLIENT_SECRET : MICROSOFT_CLIENT_SECRET;
      const tokenUrl = provider === 'google' ? GOOGLE_TOKEN_URL : MICROSOFT_TOKEN_URL;

      // Exchange code for tokens
      const tokenResp = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: session.redirect_uri,
          client_id: clientId,
          client_secret: clientSecret,
          code_verifier: session.code_verifier,
        }),
      });

      const tokenData = await tokenResp.json() as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
      };

      if (!tokenResp.ok || !tokenData.access_token) {
        await serviceClient
          .from('email_oauth_sessions')
          .update({ status: 'failed', error_text: tokenData.error ?? 'Token exchange failed' })
          .eq('id', session.id);
        return jsonResponse({ error: `OAuth token exchange failed: ${tokenData.error ?? 'unknown'}` }, 400);
      }

      // Fetch user email from provider
      let senderEmail = '';
      let senderName = '';
      if (provider === 'google') {
        const profileResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profileData = await profileResp.json() as { email?: string; name?: string };
        senderEmail = profileData.email ?? '';
        senderName = profileData.name ?? '';
      } else {
        const profileResp = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profileData = await profileResp.json() as { mail?: string; displayName?: string };
        senderEmail = profileData.mail ?? '';
        senderName = profileData.displayName ?? '';
      }

      if (!senderEmail) {
        return jsonResponse({ error: 'Could not retrieve email address from OAuth provider.' }, 400);
      }

      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

      // Upsert sender
      const { data: sender, error: senderError } = await serviceClient
        .from('workspace_email_senders')
        .upsert(
          {
            workspace_id: workspaceId,
            provider,
            sender_email: senderEmail.toLowerCase(),
            sender_name: senderName || senderEmail,
            oauth_access_token_encrypted: tokenData.access_token,
            oauth_refresh_token_encrypted: tokenData.refresh_token ?? null,
            oauth_token_expires_at: expiresAt,
            oauth_scope: session.code_challenge,
            status: 'connected',
            health_status: 'healthy',
            is_active: true,
            connected_at: new Date().toISOString(),
            created_by: user.id,
            updated_by: user.id,
          },
          { onConflict: 'workspace_id,provider,sender_email' },
        )
        .select('id, sender_email, sender_name, provider, status')
        .single();

      if (senderError) {
        return jsonResponse({ error: senderError.message }, 500);
      }

      // Mark session complete
      await serviceClient
        .from('email_oauth_sessions')
        .update({ status: 'completed', consumed_at: new Date().toISOString() })
        .eq('id', session.id);

      return jsonResponse({ sender, return_path: session.return_path });
    }

    return jsonResponse({ error: 'Invalid action. Use ?action=initiate or ?action=callback' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return jsonResponse({ error: message }, 500);
  }
});
