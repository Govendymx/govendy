-- Pocket - Agregar columna para guardar nombre del administrador que autorizó el pago
-- Ejecuta esto en Supabase → SQL Editor.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_to_seller_by_name TEXT;

-- Índice opcional para búsquedas por nombre del admin
CREATE INDEX IF NOT EXISTS orders_paid_to_seller_by_name_idx
  ON public.orders (paid_to_seller_by_name)
  WHERE paid_to_seller_by_name IS NOT NULL;
