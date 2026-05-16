-- =============================================================================
-- GoVendy — Carrito (cart_items) — migración completa e idempotente
-- Ejecutar en Supabase → SQL Editor (una sola vez)
--
-- Corrige: tabla faltante, columnas selected_color / selected_size,
-- constraint UNIQUE compatible con variantes, y políticas RLS.
-- =============================================================================

-- ── 1) Tabla base ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ── 2) Columnas usadas por la app ─────────────────────────────────────────────
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS selected_color TEXT NULL;

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS selected_size TEXT NULL;

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ NULL;

COMMENT ON TABLE public.cart_items IS 'Ítems del carrito por usuario (con variantes de color/talla opcionales).';
COMMENT ON COLUMN public.cart_items.selected_color IS 'Color elegido cuando el listing tiene color_variants.';
COMMENT ON COLUMN public.cart_items.selected_size IS 'Talla elegida cuando el listing tiene size_variants / size_stock.';
COMMENT ON COLUMN public.cart_items.last_reminder_at IS 'Último recordatorio de carrito abandonado enviado.';

-- ── 3) Índices de consulta ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS cart_items_user_id_idx
  ON public.cart_items (user_id);

CREATE INDEX IF NOT EXISTS cart_items_listing_id_idx
  ON public.cart_items (listing_id);

-- ── 4) Unicidad por usuario + listing + variantes (NULL-safe) ─────────────────
-- PostgreSQL trata NULL como distintos en UNIQUE clásico; este índice evita duplicados.
ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_user_id_listing_id_key;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_user_id_listing_id_selected_color_key;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_user_id_listing_id_selected_color_selected_size_key;

DROP INDEX IF EXISTS public.cart_items_user_listing_variant_uidx;

CREATE UNIQUE INDEX cart_items_user_listing_variant_uidx
  ON public.cart_items (
    user_id,
    listing_id,
    COALESCE(selected_color, ''),
    COALESCE(selected_size, '')
  );

-- ── 5) updated_at automático ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_cart_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cart_items_updated_at();

-- ── 6) RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own cart items" ON public.cart_items;
CREATE POLICY "Users can read their own cart items"
  ON public.cart_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own cart items" ON public.cart_items;
CREATE POLICY "Users can insert their own cart items"
  ON public.cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cart items" ON public.cart_items;
CREATE POLICY "Users can update their own cart items"
  ON public.cart_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own cart items" ON public.cart_items;
CREATE POLICY "Users can delete their own cart items"
  ON public.cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- ── 7) Columnas de listings que usa /api/cart/add ───────────────────────────
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS stock INTEGER NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS color_variants TEXT[] NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS size_variants TEXT[] NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS size_stock JSONB NULL;

-- ── 8) Verificación (opcional: revisar resultado en el panel de resultados) ───
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'cart_items'
-- ORDER BY ordinal_position;
