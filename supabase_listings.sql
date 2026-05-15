-- Pocket App - Listings (publicaciones) para marketplace
-- Ejecuta este SQL en el SQL Editor de Supabase.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    CREATE TYPE public.listing_status AS ENUM ('draft', 'active', 'sold', 'paused', 'blocked');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',

  -- MVP: imágenes en array (min 2, max 56 en UI; la DB no impone el max)
  images TEXT[] NOT NULL DEFAULT '{}'::text[],

  status public.listing_status NOT NULL DEFAULT 'draft',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS listings_seller_id_idx ON public.listings (seller_id);
CREATE INDEX IF NOT EXISTS listings_status_idx ON public.listings (status);
CREATE INDEX IF NOT EXISTS listings_created_at_idx ON public.listings (created_at DESC);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Lectura pública: solo publicaciones activas
DROP POLICY IF EXISTS "Public can read active listings" ON public.listings;
CREATE POLICY "Public can read active listings"
  ON public.listings
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR seller_id = auth.uid());

-- Insert: el vendedor crea sus propias publicaciones
DROP POLICY IF EXISTS "Sellers can create their listings" ON public.listings;
CREATE POLICY "Sellers can create their listings"
  ON public.listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- Update/Delete: solo el vendedor
DROP POLICY IF EXISTS "Sellers can update their listings" ON public.listings;
CREATE POLICY "Sellers can update their listings"
  ON public.listings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can delete their listings" ON public.listings;
CREATE POLICY "Sellers can delete their listings"
  ON public.listings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_listings_updated_at ON public.listings;
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

