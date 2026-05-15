-- Costo de la guía de devolución (descuento a comprador o vendedor)
-- Ejecuta en Supabase → SQL Editor

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS return_guide_cost NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.disputes.return_guide_cost IS 'Costo de la guía (MXN). Se descuenta a comprador o vendedor según return_guide_charged_to.';
