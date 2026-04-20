import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SMTP_ENCRYPTION_KEY = Deno.env.get('EMAIL_SMTP_ENCRYPTION_KEY') ?? 'coreflow-smtp-secret-key';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authContext = await authenticateRequest(request);
    if (authContext instanceof Response) return authContext;

    const { serviceClient } = authContext;

    // Claim up to 20 due steps atomically
    const { data: duSteps, error: claimError } = await serviceClient.rpc(
      'claim_due_record_email_followup_steps',
      { p_limit: 20 },
    );

    if (claimError) {
      return jsonResponse({ error: claimError.message, processed: 0 }, 500);
    }

    const steps = (duSteps ?? []) as {
      id: string;
      workspace_id: string;
      followup_id: string;
      sender_id: string | null;
      step_order: number;
      subject_rendered: string;
      body_rendered: string;
      attempt_count: number;
      max_attempts: number;
      lock_token: string;
    }[];

    if (steps.length === 0) {
      return jsonResponse({ processed: 0, message: 'No due steps.' });
    }

    let sent = 0;
    let failed = 0;

    for (const step of steps) {
      try {
        await processEmailStep(serviceClient, step);
        sent++;
      } catch (err) {
        failed++;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        const nextAttempt = step.attempt_count + 1;
        const willRetry = nextAttempt < step.max_attempts;

        await serviceClient
          .from('record_email_followup_steps')
          .update({
            status: willRetry ? 'pending' : 'failed',
            attempt_count: nextAttempt,
            next_retry_at: willRetry
              ? new Date(Date.now() + nextAttempt * 15 * 60 * 1000).toISOString()
              : null,
            last_error: errMsg,
            lock_token: null,
            locked_at: null,
            claim_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', step.id);

        // Log delivery event
        await serviceClient.from('email_delivery_events').insert({
          workspace_id: step.workspace_id,
          followup_id: step.followup_id,
          followup_step_id: step.id,
          sender_id: step.sender_id,
          event_type: 'send_failed',
          error_text: errMsg,
          request_payload: { step_id: step.id, attempt: nextAttempt },
        });
      }
    }

    return jsonResponse({ processed: steps.length, sent, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    return jsonResponse({ error: message }, 500);
  }
});

async function processEmailStep(
  serviceClient: ReturnType<typeof createClient>,
  step: {
    id: string;
    workspace_id: string;
    followup_id: string;
    sender_id: string | null;
    subject_rendered: string;
    body_rendered: string;
    attempt_count: number;
  },
) {
  if (!step.sender_id) throw new Error('No sender assigned to this step.');

  // Fetch sender with decrypted password
  const { data: sender, error: senderError } = await serviceClient
    .from('workspace_email_senders')
    .select('*')
    .eq('id', step.sender_id)
    .single();

  if (senderError || !sender) throw new Error('Sender not found.');
  if (!sender.is_active) throw new Error('Sender is disabled.');

  // Decrypt SMTP password
  let smtpPassword = '';
  if (sender.smtp_password_encrypted) {
    if (sender.smtp_password_encrypted.startsWith('PLAINTEXT:')) {
      smtpPassword = sender.smtp_password_encrypted.slice('PLAINTEXT:'.length);
    } else {
      const { data: decrypted, error: decryptError } = await serviceClient.rpc('decrypt_smtp_password', {
        p_encrypted: sender.smtp_password_encrypted,
        p_key: SMTP_ENCRYPTION_KEY,
      });
      if (decryptError) throw new Error('Failed to decrypt SMTP password.');
      smtpPassword = decrypted as string;
    }
  }

  // Fetch lead info for reply-to
  const { data: followup } = await serviceClient
    .from('record_email_followups')
    .select('record_id, workspace_id')
    .eq('id', step.followup_id)
    .maybeSingle();

  let leadEmail = '';
  if (followup?.record_id) {
    const { data: record } = await serviceClient
      .from('records')
      .select('email')
      .eq('id', followup.record_id)
      .maybeSingle();
    leadEmail = (record as Record<string, string>)?.email ?? '';
  }

  if (!leadEmail) throw new Error('Lead email address not found.');

  // Send via SMTP using Deno SMTP (platform-level TCP)
  await sendViaSmtp({
    host: sender.smtp_host,
    port: sender.smtp_port ?? 587,
    username: sender.smtp_username,
    password: smtpPassword,
    useTls: sender.smtp_use_tls ?? true,
    from: sender.sender_email,
    fromName: sender.sender_name ?? sender.sender_email,
    to: leadEmail,
    subject: step.subject_rendered,
    body: step.body_rendered,
  });

  // Mark step as sent
  await serviceClient
    .from('record_email_followup_steps')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      attempt_count: step.attempt_count + 1,
      lock_token: null,
      locked_at: null,
      claim_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', step.id);

  // Log delivery event
  await serviceClient.from('email_delivery_events').insert({
    workspace_id: step.workspace_id,
    followup_id: step.followup_id,
    followup_step_id: step.id,
    sender_id: step.sender_id,
    event_type: 'sent',
    provider: sender.provider,
    request_payload: { to: leadEmail, subject: step.subject_rendered },
  });
}

// ─── Minimal SMTP sender over raw TCP ───────────────────────────────────────
async function sendViaSmtp(opts: {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
}) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const conn = await Deno.connect({ hostname: opts.host, port: opts.port, transport: 'tcp' });

  async function read(): Promise<string> {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    return decoder.decode(buf.subarray(0, n ?? 0));
  }

  async function send(cmd: string) {
    await conn.write(encoder.encode(cmd + '\r\n'));
  }

  try {
    await read(); // 220 greeting
    await send('EHLO coreflow');
    await read(); // EHLO response

    if (opts.useTls && opts.port !== 465) {
      await send('STARTTLS');
      const tlsResp = await read();
      if (!tlsResp.startsWith('220')) throw new Error('STARTTLS rejected: ' + tlsResp);
      // note: Deno.startTls works for upgraded connections
    }

    await send('AUTH LOGIN');
    await read();
    await send(btoa(opts.username));
    await read();
    await send(btoa(opts.password));
    const authResp = await read();
    if (!authResp.startsWith('235')) throw new Error('SMTP auth failed: ' + authResp);

    await send(`MAIL FROM:<${opts.from}>`);
    await read();
    await send(`RCPT TO:<${opts.to}>`);
    await read();
    await send('DATA');
    await read();

    const message = [
      `From: "${opts.fromName}" <${opts.from}>`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      opts.body,
      `.`,
    ].join('\r\n');

    await conn.write(encoder.encode(message + '\r\n'));
    const dataResp = await read();
    if (!dataResp.startsWith('250')) throw new Error('SMTP DATA error: ' + dataResp);

    await send('QUIT');
    await read();
  } finally {
    conn.close();
  }
}
