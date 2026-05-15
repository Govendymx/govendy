-- Pocket App - Logística de órdenes (idempotente)
-- Agrega columnas para guía PDF, rastreo y eventos de envío.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_label_uploaded_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_label_uploaded_by UUID;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS label_downloaded_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS tracking_number TEXT;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_carrier TEXT;

    CREATE INDEX IF NOT EXISTS orders_seller_status_created_idx
      ON public.orders (seller_id, status, created_at DESC);
  END IF;
END$$;

