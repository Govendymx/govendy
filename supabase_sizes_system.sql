-- ============================================
-- Sistema de Tallas de Ropa y Calzado
-- Ejecutar en Supabase → SQL Editor
-- ============================================

-- 1. Stock por talla (JSONB)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS size_stock JSONB NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.listings.size_stock IS
  'Stock por talla: {"SCH": 5, "CH": 3, "M": 10} para ropa o {"20": 3, "20.5": 5} para calzado';

-- 2. Tipo de talla
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS size_type TEXT NULL;

COMMENT ON COLUMN public.listings.size_type IS
  'Tipo de talla: "clothing" (ropa) o "shoes" (calzado). NULL si no aplica.';

-- 3. Índice opcional
CREATE INDEX IF NOT EXISTS listings_size_type_idx
  ON public.listings (size_type)
  WHERE size_type IS NOT NULL;

-- 4. order_items.selected_size (para historial de compra)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS selected_size TEXT NULL;

COMMENT ON COLUMN public.order_items.selected_size IS
  'Talla seleccionada al momento de la compra (snapshot para historial)';

-- 5. cart_items.selected_size (ya suele existir; asegurar)
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS selected_size TEXT NULL;
