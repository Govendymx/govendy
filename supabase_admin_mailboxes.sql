-- Buzón de correo admin: 2–3 cuentas con dominio propio (IMAP + SMTP)
-- Ejecuta en Supabase → SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'admin_mailboxes'
  ) THEN
    ALTER TABLE public.app_settings
      ADD COLUMN admin_mailboxes JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.app_settings.admin_mailboxes IS 'Buzón admin: array de {label, email, imap_host, imap_port, imap_secure, imap_user, imap_pass, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass}. Máx. 4 cuentas.';
