-- Force PostgREST to reload its schema cache so it becomes aware of
-- ensure_workspace_email_automation_defaults and all other functions
-- added in migration 202604170001_account_email_followups.sql
notify pgrst, 'reload schema';

-- Re-grant execute so the service role can call it via RPC
grant execute on function public.ensure_workspace_email_automation_defaults(uuid, uuid)
  to service_role, authenticated;

grant execute on function public.claim_due_record_email_followup_steps(integer, timestamptz)
  to service_role;
