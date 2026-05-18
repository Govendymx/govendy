-- ============================================================
-- GoVendy: Tablas de Tracking para Métricas Avanzadas
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. search_logs: Registra búsquedas de usuarios
CREATE TABLE IF NOT EXISTS public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_query ON public.search_logs(query);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON public.search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON public.search_logs(user_id);
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read search logs" ON public.search_logs;
CREATE POLICY "Admins can read search logs"
  ON public.search_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Anyone can insert search logs" ON public.search_logs;
CREATE POLICY "Anyone can insert search logs"
  ON public.search_logs FOR INSERT WITH CHECK (true);

-- 2. product_views: Registra vistas de productos
CREATE TABLE IF NOT EXISTS public.product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'direct',
  duration_seconds INTEGER DEFAULT 0,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_views_listing_id ON public.product_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_product_views_created_at ON public.product_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_views_user_id ON public.product_views(user_id);
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read product views" ON public.product_views;
CREATE POLICY "Admins can read product views"
  ON public.product_views FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Anyone can insert product views" ON public.product_views;
CREATE POLICY "Anyone can insert product views"
  ON public.product_views FOR INSERT WITH CHECK (true);

-- 3. product_shares: Registra compartidos de productos
CREATE TABLE IF NOT EXISTS public.product_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_shares_listing_id ON public.product_shares(listing_id);
CREATE INDEX IF NOT EXISTS idx_product_shares_created_at ON public.product_shares(created_at DESC);
ALTER TABLE public.product_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read product shares" ON public.product_shares;
CREATE POLICY "Admins can read product shares"
  ON public.product_shares FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Anyone can insert product shares" ON public.product_shares;
CREATE POLICY "Anyone can insert product shares"
  ON public.product_shares FOR INSERT WITH CHECK (true);

-- 4. user_activity: Heartbeat para usuarios conectados (ya puede existir)
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  page TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON public.user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_last_at ON public.user_activity(last_activity_at DESC);
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can upsert own activity" ON public.user_activity;
CREATE POLICY "Users can upsert own activity"
  ON public.user_activity FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can read all activity" ON public.user_activity;
CREATE POLICY "Admins can read all activity"
  ON public.user_activity FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT tablename, '✅ CREADA' as estado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('search_logs','product_views','product_shares','user_activity')
ORDER BY tablename;
