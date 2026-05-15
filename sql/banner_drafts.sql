-- ═══════════════════════════════════════════════════════════
-- banner_drafts: Borradores de banners generados por IA
-- Workflow: generating → pending → approved/rejected
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS banner_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt TEXT NOT NULL,
  image_url TEXT,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT DEFAULT '',
  cta_text TEXT DEFAULT 'Ver más',
  cta_href TEXT DEFAULT '/dashboard/live',
  placement TEXT DEFAULT 'live_dashboard',
  status TEXT DEFAULT 'pending' CHECK (status IN ('generating','pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_banner_drafts_status ON banner_drafts(status);
CREATE INDEX IF NOT EXISTS idx_banner_drafts_placement ON banner_drafts(placement);

-- RLS
ALTER TABLE banner_drafts ENABLE ROW LEVEL SECURITY;

-- Los admins pueden leer/escribir todo
CREATE POLICY "admin_all_banner_drafts" ON banner_drafts
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Service role (cron) puede insertar
CREATE POLICY "service_insert_banner_drafts" ON banner_drafts
  FOR INSERT
  WITH CHECK (true);
