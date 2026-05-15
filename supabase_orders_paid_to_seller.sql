-- Pocket - Agregar columna para marcar cuando se pagó al vendedor (idempotente)
-- Ejecuta esto en Supabase → SQL Editor.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_to_seller_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_to_seller_by UUID;

-- Índice para filtrar rápido "qué ya se pagó"
CREATE INDEX IF NOT EXISTS orders_paid_to_seller_at_idx
  ON public.orders (paid_to_seller_at DESC)
  WHERE paid_to_seller_at IS NOT NULL;
