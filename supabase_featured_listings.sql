-- ============================================
-- Migración: Tabla featured_listings para sistema de publicidad
-- ============================================

-- 1. Crear tabla featured_listings
CREATE TABLE IF NOT EXISTS public.featured_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL, -- '7_days', '15_days', '30_days'
  start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled'
  payment_id UUID, -- Referencia a wallet_transactions (opcional si no es FK estricta)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_featured_listings_user_id ON public.featured_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_featured_listings_listing_id ON public.featured_listings(listing_id);
CREATE INDEX IF NOT EXISTS idx_featured_listings_status_end_at ON public.featured_listings(status, end_at);

-- 3. Habilitar RLS
ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
-- Usuarios pueden ver sus propias suscripciones
CREATE POLICY "Users can view own featured listings" ON public.featured_listings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins pueden ver todo (Service Role bypasses RLS, pero por si acaso se usa auth admin)
-- (Opcional, si usas service_role key no es necesario, pero buena práctica)

-- 5. Comentarios
COMMENT ON TABLE public.featured_listings IS 'Registro de publicaciones destacadas (Publicidad)';
COMMENT ON COLUMN public.featured_listings.plan_type IS 'Tipo de plan: 7_days, 15_days, 30_days';
