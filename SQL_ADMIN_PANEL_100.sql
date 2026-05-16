-- =============================================================================
-- GoVendy — SQL para panel admin operativo (idempotente, Supabase SQL Editor)
-- =============================================================================

-- ── A) Logística en orders ───────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_label_uploaded_at TIMESTAMPTZ;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_label_uploaded_by UUID;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS label_downloaded_at TIMESTAMPTZ;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_carrier TEXT;
    CREATE INDEX IF NOT EXISTS orders_seller_status_created_idx
      ON public.orders (seller_id, status, created_at DESC);
  END IF;
END$$;

-- ── B) Evidencia de entrega ──────────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_proof_downloaded_at TIMESTAMPTZ;

-- ── C) admin_users ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read own admin row" ON public.admin_users;
CREATE POLICY "Admin can read own admin row"
  ON public.admin_users FOR SELECT
  USING (auth.uid() = user_id);

-- Agregar tu usuario admin (reemplaza el UUID):
-- INSERT INTO public.admin_users (user_id, role) VALUES ('TU-USER-UUID', 'admin')
-- ON CONFLICT (user_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
