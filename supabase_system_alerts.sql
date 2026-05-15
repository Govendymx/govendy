-- Sistema de monitoreo y diagnóstico (PROMPT_SISTEMA_MONITOREO_DIAGNOSTICO)
-- Tabla system_alerts: alertas generadas por el diagnóstico

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',

  title TEXT NOT NULL,
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,

  entity_type TEXT NOT NULL,
  entity_id UUID NULL,
  action_url TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'active',
  acknowledged_by UUID NULL REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,

  detected_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS system_alerts_status_idx ON public.system_alerts (status, detected_at DESC);
CREATE INDEX IF NOT EXISTS system_alerts_type_idx ON public.system_alerts (alert_type, status);
CREATE INDEX IF NOT EXISTS system_alerts_entity_idx ON public.system_alerts (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS system_alerts_severity_idx ON public.system_alerts (severity, status);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read system alerts" ON public.system_alerts;
CREATE POLICY "Admins can read system alerts"
  ON public.system_alerts
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update system alerts" ON public.system_alerts;
CREATE POLICY "Admins can update system alerts"
  ON public.system_alerts
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Inserts desde API con service_role (bypasea RLS). No policy INSERT para authenticated.
