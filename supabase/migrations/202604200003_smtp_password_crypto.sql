-- pgcrypto helper function for encrypting SMTP passwords
create or replace function public.encrypt_smtp_password(p_password text, p_key text)
returns text
language sql
security definer
set search_path = public
as $$
  select encode(
    pgp_sym_encrypt(p_password, p_key),
    'base64'
  );
$$;

create or replace function public.decrypt_smtp_password(p_encrypted text, p_key text)
returns text
language sql
security definer
set search_path = public
as $$
  select pgp_sym_decrypt(
    decode(p_encrypted, 'base64'),
    p_key
  );
$$;

-- Only service_role can call decrypt
grant execute on function public.encrypt_smtp_password(text, text) to service_role, authenticated;
grant execute on function public.decrypt_smtp_password(text, text) to service_role;

notify pgrst, 'reload schema';
