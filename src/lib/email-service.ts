import { getSupabaseClient } from './supabaseClient';

/* ─── Types ──────────────────────────────────────────────────────────── */

export type EmailProvider =
  | 'google'
  | 'microsoft'
  | 'zoho'
  | 'hostinger'
  | 'godaddy'
  | 'smtp';

export interface EmailSender {
  id: string;
  provider: EmailProvider;
  sender_email: string;
  sender_name: string | null;
  status: 'pending' | 'connected' | 'failed' | 'disabled';
  is_default: boolean;
  is_active: boolean;
  health_status: 'unknown' | 'healthy' | 'degraded' | 'failed';
  connected_at: string | null;
  last_used_at: string | null;
}

export interface EmailAutomationSettings {
  workspace_id: string;
  is_enabled: boolean;
  timezone: string;
  stop_on_reply: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailSequenceStep {
  id: string;
  workspace_id: string;
  step_order: number;
  delay_hours: number;
  subject_template: string;
  body_template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountSettingsGetResponse {
  automation: EmailAutomationSettings | null;
  senders: EmailSender[];
  sequence_steps: EmailSequenceStep[];
}

/* ─── Provider metadata ───────────────────────────────────────────────── */

export interface ProviderMeta {
  id: EmailProvider;
  label: string;
  description: string;
  authMethod: 'oauth' | 'smtp';
  color: string;
  icon: string; // emoji fallback
  smtpDefaults?: { host: string; port: number };
  docsUrl?: string;
}

export const EMAIL_PROVIDERS: ProviderMeta[] = [
  {
    id: 'google',
    label: 'Google Workspace',
    description: 'Connect via OAuth 2.0. Works with Gmail and Google Workspace accounts.',
    authMethod: 'oauth',
    color: '#EA4335',
    icon: '🔴',
    docsUrl: 'https://workspace.google.com',
  },
  {
    id: 'microsoft',
    label: 'Microsoft 365',
    description: 'Connect via OAuth 2.0. Works with Outlook and Microsoft 365 accounts.',
    authMethod: 'oauth',
    color: '#0078D4',
    icon: '🔵',
    docsUrl: 'https://microsoft.com/microsoft-365',
  },
  {
    id: 'zoho',
    label: 'Zoho Mail',
    description: 'Connect via SMTP. Zoho Mail for business with custom domain.',
    authMethod: 'smtp',
    color: '#E42527',
    icon: '🟠',
    smtpDefaults: { host: 'smtp.zoho.com', port: 587 },
    docsUrl: 'https://www.zoho.com/mail',
  },
  {
    id: 'hostinger',
    label: 'Hostinger',
    description: 'Connect via SMTP. Hostinger web hosting email service.',
    authMethod: 'smtp',
    color: '#673DE6',
    icon: '🟣',
    smtpDefaults: { host: 'smtp.hostinger.com', port: 587 },
    docsUrl: 'https://www.hostinger.com',
  },
  {
    id: 'godaddy',
    label: 'GoDaddy',
    description: 'Connect via SMTP. GoDaddy professional email hosting.',
    authMethod: 'smtp',
    color: '#00A4A6',
    icon: '🟢',
    smtpDefaults: { host: 'smtpout.secureserver.net', port: 587 },
    docsUrl: 'https://www.godaddy.com/email/professional-business-email',
  },
  {
    id: 'smtp',
    label: 'Custom SMTP',
    description: 'Connect via any SMTP server. For advanced or self-hosted setups.',
    authMethod: 'smtp',
    color: '#64748B',
    icon: '⚙️',
    smtpDefaults: { host: '', port: 587 },
  },
];

export function getProviderMeta(provider: EmailProvider): ProviderMeta {
  return EMAIL_PROVIDERS.find((p) => p.id === provider) ?? EMAIL_PROVIDERS[EMAIL_PROVIDERS.length - 1];
}

/* ─── API calls ───────────────────────────────────────────────────────── */

export async function fetchAccountSettings(): Promise<AccountSettingsGetResponse> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke<AccountSettingsGetResponse>('account-settings-get');

  if (error) throw new Error(error.message);
  if (!data) throw new Error('No data returned from account-settings-get.');
  return data;
}

export interface SmtpSenderInput {
  provider: EmailProvider;
  sender_email: string;
  sender_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls: boolean;
}

export async function addSmtpSender(input: SmtpSenderInput & { make_default?: boolean }): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb.functions.invoke('account-settings-sender-add', { body: input });
  if (error) throw new Error(error.message);
}

export async function initiateOauth(provider: 'google' | 'microsoft'): Promise<string> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke<{ redirect_url: string }>('email-oauth?action=initiate', {
    body: { provider },
  });
  if (error) throw new Error(error.message);
  if (!data?.redirect_url) throw new Error('No redirect URL returned.');
  return data.redirect_url;
}

export async function enrollLead(recordId: string): Promise<{ followup_id: string; steps_scheduled: number; message: string }> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.functions.invoke<{ followup_id: string; steps_scheduled: number; message: string }>(
    'email-enroll-lead',
    { body: { record_id: recordId } },
  );
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No response from enroll function.');
  return data;
}

export async function updateAutomationSettings(
  workspaceId: string,
  patch: Partial<Pick<EmailAutomationSettings, 'is_enabled' | 'timezone' | 'stop_on_reply'>>,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('workspace_email_automation_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId);
  if (error) throw new Error(error.message);
}

export async function updateSequenceStep(
  stepId: string,
  patch: Partial<Pick<EmailSequenceStep, 'delay_hours' | 'subject_template' | 'body_template' | 'is_active'>>,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('workspace_email_sequence_steps')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', stepId);
  if (error) throw new Error(error.message);
}

export async function addSequenceStep(
  workspaceId: string,
  step: Pick<EmailSequenceStep, 'step_order' | 'delay_hours' | 'subject_template' | 'body_template'>,
): Promise<void> {
  const { error } = await getSupabaseClient().from('workspace_email_sequence_steps').insert({
    workspace_id: workspaceId,
    ...step,
    is_active: true,
  });
  if (error) throw new Error(error.message);
}

export async function deleteSequenceStep(stepId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('workspace_email_sequence_steps').delete().eq('id', stepId);
  if (error) throw new Error(error.message);
}

/* ─── Template helpers ────────────────────────────────────────────────── */

export interface TemplateVariable {
  token: string;
  label: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { token: '{{lead_full_name}}', label: 'Lead Full Name', example: 'John Smith' },
  { token: '{{lead_first_name}}', label: 'Lead First Name', example: 'John' },
  { token: '{{lead_email}}', label: 'Lead Email', example: 'john@example.com' },
  { token: '{{lead_phone}}', label: 'Lead Phone', example: '+1 555-000-1234' },
  { token: '{{workspace_name}}', label: 'Business Name', example: 'Acme Realty' },
  { token: '{{sender_name}}', label: 'Sender Name', example: 'Jane Doe' },
  { token: '{{sender_email}}', label: 'Sender Email', example: 'jane@acmerealty.com' },
  { token: '{{unsubscribe_link}}', label: 'Unsubscribe Link', example: 'https://...' },
];

export function renderTemplatePreview(template: string, workspaceName = 'Your Business'): string {
  const replacements: Record<string, string> = {
    '{{lead_full_name}}': 'John Smith',
    '{{lead_first_name}}': 'John',
    '{{lead_email}}': 'john@example.com',
    '{{lead_phone}}': '+1 555-000-1234',
    '{{workspace_name}}': workspaceName,
    '{{sender_name}}': 'Jane Doe',
    '{{sender_email}}': 'jane@yourbusiness.com',
    '{{unsubscribe_link}}': 'https://example.com/unsubscribe',
  };
  return Object.entries(replacements).reduce((t, [k, v]) => t.replaceAll(k, v), template);
}

export function delayLabel(hours: number): string {
  if (hours === 0) return 'Immediately';
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} after last step`;
  const days = Math.round(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} after last step`;
}
