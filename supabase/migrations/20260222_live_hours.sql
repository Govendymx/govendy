-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sistema de Horas Live
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- 1. Campo ended_at en live_sessions (para calcular duración)
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- 2. Tabla: saldo de horas extra compradas (permanentes, no caducan)
CREATE TABLE IF NOT EXISTS live_extra_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  minutes_balance integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE live_extra_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "live_extra_hours_owner_select"
  ON live_extra_hours FOR SELECT USING (auth.uid() = user_id);

-- 3. Tabla: minutos gratuitos usados hoy (Platinum — se resetea cada día)
CREATE TABLE IF NOT EXISTS live_daily_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date  date NOT NULL DEFAULT CURRENT_DATE,
  minutes_used integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, usage_date)
);
ALTER TABLE live_daily_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "live_daily_usage_owner_select"
  ON live_daily_usage FOR SELECT USING (auth.uid() = user_id);

-- 4. Permitir a service_role hacer todo (necesario para las API routes)
-- (service_role siempre bypassa RLS, esto es solo documentación)

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_live_extra_hours_user ON live_extra_hours(user_id);
CREATE INDEX IF NOT EXISTS idx_live_daily_usage_user_date ON live_daily_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_live_sessions_host_status ON live_sessions(host_id, status);
