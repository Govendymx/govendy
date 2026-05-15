-- Pocket App - Envío gratis + conteo de compartidos + subsidio de envío en órdenes
-- Ejecuta este SQL en Supabase (SQL Editor). Es idempotente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listings'
  ) THEN
    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS free_shipping boolean NOT NULL DEFAULT false;

    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS listings_free_shipping_true_idx
      ON public.listings (free_shipping)
      WHERE free_shipping = true;

    CREATE INDEX IF NOT EXISTS listings_share_count_idx
      ON public.listings (share_count DESC);
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_subsidy numeric NOT NULL DEFAULT 0;
  END IF;
END$$;

