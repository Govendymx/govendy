-- Asegurar que la columna shipping_subsidy existe en la tabla orders
-- Ejecuta esto en el SQL Editor de Supabase

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_subsidy numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.shipping_subsidy IS 'Monto del envío subsidiado por el vendedor (se resta de sus ganancias)';
