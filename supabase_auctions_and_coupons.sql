-- Pocket App - Subastas + Notificaciones + Cupones (por vendedor)
-- Ejecuta este SQL en el SQL Editor de Supabase.
-- Es re-ejecutable (incluye DROP POLICY IF EXISTS donde aplica).

-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_gender') THEN
    CREATE TYPE public.listing_gender AS ENUM ('Mujer', 'Hombre', 'Unisex');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_sale_type') THEN
    CREATE TYPE public.listing_sale_type AS ENUM ('direct', 'auction');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_discount_type') THEN
    CREATE TYPE public.coupon_discount_type AS ENUM ('percent', 'fixed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE public.notification_type AS ENUM ('outbid', 'system');
  END IF;
END$$;

-- 2) Listings: columnas nuevas
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS gender public.listing_gender NULL,
  ADD COLUMN IF NOT EXISTS size TEXT NULL,
  ADD COLUMN IF NOT EXISTS color TEXT NULL,
  ADD COLUMN IF NOT EXISTS category TEXT NULL,
  ADD COLUMN IF NOT EXISTS sale_type public.listing_sale_type NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_fee NUMERIC NOT NULL DEFAULT 0,

  -- Subasta
  ADD COLUMN IF NOT EXISTS auction_start_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS auction_end_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS auction_starting_bid NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auction_bid_increment NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auction_highest_bid NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auction_highest_bidder_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índices útiles
CREATE INDEX IF NOT EXISTS listings_sale_type_idx ON public.listings (sale_type);
CREATE INDEX IF NOT EXISTS listings_featured_idx ON public.listings (is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS listings_auction_end_idx ON public.listings (auction_end_at) WHERE sale_type = 'auction';

-- 3) Pujas
CREATE TABLE IF NOT EXISTS public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS bids_listing_created_idx ON public.bids (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bids_bidder_created_idx ON public.bids (bidder_id, created_at DESC);

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read bids for active auction listings" ON public.bids;
CREATE POLICY "Anyone can read bids for active auction listings"
  ON public.bids
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.status = 'active' AND l.sale_type = 'auction'
    )
  );

-- Insert solo por el propio usuario (la API también validará reglas)
DROP POLICY IF EXISTS "Users can insert their own bids" ON public.bids;
CREATE POLICY "Users can insert their own bids"
  ON public.bids
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = bidder_id);

-- No permitimos UPDATE/DELETE (solo admin/service role si hace falta)

-- 4) Notificaciones (para avisar "te ganaron la puja")
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their notifications" ON public.notifications;
CREATE POLICY "Users can read their notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inserts recomendados solo vía service role (webhooks/API). Si quieres permitir insert propio, agrega policy.

-- 5) Cupones por vendedor
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type public.coupon_discount_type NOT NULL DEFAULT 'percent',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE NULL,
  ends_at TIMESTAMP WITH TIME ZONE NULL,
  max_redemptions INTEGER NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Código único por vendedor
CREATE UNIQUE INDEX IF NOT EXISTS coupons_seller_code_uniq ON public.coupons (seller_id, code);
CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons (code);

CREATE TABLE IF NOT EXISTS public.coupon_listings (
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  PRIMARY KEY (coupon_id, listing_id)
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx ON public.coupon_redemptions (coupon_id, created_at DESC);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Cupones: vendedor administra los suyos
DROP POLICY IF EXISTS "Sellers can read their coupons" ON public.coupons;
CREATE POLICY "Sellers can read their coupons"
  ON public.coupons
  FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can insert their coupons" ON public.coupons;
CREATE POLICY "Sellers can insert their coupons"
  ON public.coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can update their coupons" ON public.coupons;
CREATE POLICY "Sellers can update their coupons"
  ON public.coupons
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can delete their coupons" ON public.coupons;
CREATE POLICY "Sellers can delete their coupons"
  ON public.coupons
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- coupon_listings: solo el vendedor (dueño del cupón) puede gestionar relaciones
DROP POLICY IF EXISTS "Sellers can manage coupon listings" ON public.coupon_listings;
CREATE POLICY "Sellers can manage coupon listings"
  ON public.coupon_listings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.coupons c WHERE c.id = coupon_id AND c.seller_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.coupons c WHERE c.id = coupon_id AND c.seller_id = auth.uid())
  );

-- Redemptions: el comprador puede leer las suyas; inserts preferentemente vía API/service role
DROP POLICY IF EXISTS "Buyers can read their coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Buyers can read their coupon redemptions"
  ON public.coupon_redemptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

-- 6) (Opcional) Orders: campos para cupones (no rompe si ya existen)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC NOT NULL DEFAULT 0;

