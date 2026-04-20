-- Expand the email provider constraint to include Zoho, Hostinger, GoDaddy
-- and enable pgcrypto for password encryption.

create extension if not exists pgcrypto;

-- Drop and recreate the provider check with full list
alter table public.workspace_email_senders
  drop constraint if exists workspace_email_senders_provider_check;

alter table public.workspace_email_senders
  add constraint workspace_email_senders_provider_check
  check (provider in ('google', 'microsoft', 'zoho', 'hostinger', 'godaddy', 'smtp'));

-- Add html_body_template column to sequence steps for rich HTML emails
alter table public.workspace_email_sequence_steps
  add column if not exists html_body_template text,
  add column if not exists use_html boolean not null default false;

-- Add brand settings to workspace_email_automation_settings
alter table public.workspace_email_automation_settings
  add column if not exists brand_logo_url text,
  add column if not exists brand_primary_color text not null default '#6D28D9',
  add column if not exists brand_from_name text,
  add column if not exists send_window_start integer not null default 8,
  add column if not exists send_window_end integer not null default 18,
  add column if not exists send_window_days text[] not null default '{Mon,Tue,Wed,Thu,Fri}';

-- Reload schema cache
notify pgrst, 'reload schema';

-- Grant execute for new functions
grant execute on function public.ensure_workspace_email_automation_defaults(uuid, uuid)
  to service_role, authenticated;
grant execute on function public.claim_due_record_email_followup_steps(integer, timestamptz)
  to service_role;
