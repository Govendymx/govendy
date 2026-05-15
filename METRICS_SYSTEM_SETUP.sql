-- ============================================================
-- METRICS SYSTEM SETUP
-- Tables for tracking searches, views, shares, and advanced analytics
-- ============================================================

-- 1. Search Logs
CREATE TABLE IF NOT EXISTS public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON public.search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_query ON public.search_logs USING gin(to_tsvector('spanish', query));

-- 2. Product Views
CREATE TABLE IF NOT EXISTS public.product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  duration_seconds INTEGER DEFAULT 0, -- Time spent on page
  source TEXT, -- 'search', 'home', 'direct', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_views_listing_id ON public.product_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_product_views_created_at ON public.product_views(created_at DESC);

-- 3. Product Shares
CREATE TABLE IF NOT EXISTS public.product_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'whatsapp', 'facebook', 'twitter', 'copy_link', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_shares_listing_id ON public.product_shares(listing_id);
CREATE INDEX IF NOT EXISTS idx_product_shares_created_at ON public.product_shares(created_at DESC);

-- Enable RLS
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow public insert (anon) for tracking
CREATE POLICY "Public can insert search logs" ON public.search_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can insert product views" ON public.product_views FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public can insert product shares" ON public.product_shares FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow admins to read all
CREATE POLICY "Admins can read search logs" ON public.search_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
CREATE POLICY "Admins can read product views" ON public.product_views FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
CREATE POLICY "Admins can read product shares" ON public.product_shares FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Grant permissions
GRANT INSERT ON public.search_logs TO anon, authenticated;
GRANT INSERT ON public.product_views TO anon, authenticated;
GRANT INSERT ON public.product_shares TO anon, authenticated;

GRANT SELECT ON public.search_logs TO authenticated;
GRANT SELECT ON public.product_views TO authenticated;
GRANT SELECT ON public.product_shares TO authenticated;
