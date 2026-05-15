-- Añade paid_at a orders para registrar cuándo se acreditó el pago (MP, offline, etc.).
-- El webhook de Mercado Pago actualiza este campo al acreditar; reportes y supervisión lo usan.
-- Ejecutar en Supabase SQL Editor si orders aún no tiene la columna.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.paid_at IS 'Cuando se acreditó el pago (ej. webhook MP approved).';

CREATE INDEX IF NOT EXISTS idx_orders_paid_at
  ON public.orders (paid_at DESC)
  WHERE paid_at IS NOT NULL;
