-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sistema de Anuncios en Lives
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- 1. Campo is_free_session en live_sessions
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS is_free_session boolean DEFAULT true;

-- 2. Tabla: Campañas de anuncios
CREATE TABLE IF NOT EXISTS live_ad_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name text NOT NULL DEFAULT 'GoPocket',
  type          text NOT NULL CHECK (type IN ('overlay', 'video', 'product_spotlight')),
  title         text NOT NULL,
  subtitle      text,
  content_url   text,             -- URL del video o imagen del anuncio
  target_url    text,             -- URL a donde redirige al hacer click
  cta_text      text DEFAULT 'Ver más',
  duration_secs integer NOT NULL DEFAULT 10,
  frequency_mins integer NOT NULL DEFAULT 15,  -- cada cuántos minutos aparece
  is_active     boolean NOT NULL DEFAULT true,
  priority      integer NOT NULL DEFAULT 0,    -- mayor = más prioridad
  impressions   bigint NOT NULL DEFAULT 0,
  clicks        bigint NOT NULL DEFAULT 0,
  start_date    timestamptz,
  end_date      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_ad_campaigns ENABLE ROW LEVEL SECURITY;

-- Lectura pública (necesaria para que el viewer cargue los ads)
CREATE POLICY IF NOT EXISTS "live_ad_campaigns_public_read"
  ON live_ad_campaigns FOR SELECT
  USING (true);

-- Solo admin puede modificar
CREATE POLICY IF NOT EXISTS "live_ad_campaigns_admin_manage"
  ON live_ad_campaigns FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 3. Tabla: Registro de impresiones y clicks
CREATE TABLE IF NOT EXISTS live_ad_impressions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES live_ad_campaigns(id) ON DELETE CASCADE,
  session_id    uuid REFERENCES live_sessions(id) ON DELETE SET NULL,
  viewer_id     text,
  type          text NOT NULL CHECK (type IN ('impression', 'click')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_ad_impressions ENABLE ROW LEVEL SECURITY;

-- Solo inserción pública (para registrar impresiones desde el viewer)
CREATE POLICY IF NOT EXISTS "live_ad_impressions_insert"
  ON live_ad_impressions FOR INSERT
  WITH CHECK (true);

-- Admin puede leer todo
CREATE POLICY IF NOT EXISTS "live_ad_impressions_admin_read"
  ON live_ad_impressions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_live_ad_campaigns_active ON live_ad_campaigns(is_active, type);
CREATE INDEX IF NOT EXISTS idx_live_ad_impressions_campaign ON live_ad_impressions(campaign_id, type);
CREATE INDEX IF NOT EXISTS idx_live_ad_impressions_session ON live_ad_impressions(session_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_free ON live_sessions(is_free_session);
