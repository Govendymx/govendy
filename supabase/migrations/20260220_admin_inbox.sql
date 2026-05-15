-- Tabla para correos entrantes via Resend Inbound
CREATE TABLE IF NOT EXISTS admin_inbox (
  id          bigserial PRIMARY KEY,
  resend_id   text UNIQUE,
  to_email    text,
  from_email  text,
  from_name   text,
  subject     text,
  text_body   text,
  html_body   text,
  received_at timestamptz NOT NULL DEFAULT now(),
  seen        boolean NOT NULL DEFAULT false
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS admin_inbox_to_email_idx ON admin_inbox (to_email);
CREATE INDEX IF NOT EXISTS admin_inbox_received_at_idx ON admin_inbox (received_at DESC);

-- Solo admins pueden leer/escribir (la inserción la hace el webhook via service_role)
ALTER TABLE admin_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_inbox_service_role" ON admin_inbox
  FOR ALL USING (true) WITH CHECK (true);
