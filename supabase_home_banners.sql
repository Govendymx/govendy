-- Pocket App - Banners configurables para Home
-- Ejecuta este SQL en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.home_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  cta_text TEXT NOT NULL DEFAULT '',
  cta_href TEXT NOT NULL DEFAULT '/listings',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS home_banners_active_order_idx ON public.home_banners (is_active, sort_order, created_at DESC);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable: borrar policies si ya existen
DROP POLICY IF EXISTS "Public can read active home banners" ON public.home_banners;
DROP POLICY IF EXISTS "Admins can manage home banners" ON public.home_banners;

-- Lectura pública (solo activos)
CREATE POLICY "Public can read active home banners"
  ON public.home_banners
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Admin: full access
CREATE POLICY "Admins can manage home banners"
  ON public.home_banners
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Trigger updated_at (usa la función existente si ya la tienes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = TIMEZONE('utc'::text, NOW());
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_home_banners_updated_at ON public.home_banners;
CREATE TRIGGER update_home_banners_updated_at
  BEFORE UPDATE ON public.home_banners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

