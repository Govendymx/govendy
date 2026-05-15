-- Margen/ganancia configurable sobre el costo de envío (ej. cotización T1, Envia, etc.)
-- Ejecuta en Supabase → SQL Editor

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS shipping_markup_percent NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_markup_fixed NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.app_settings.shipping_markup_percent IS 'Margen % sobre costo de envío (ej. 0.10 = 10%). Se aplica: costo * (1 + valor)';
COMMENT ON COLUMN public.app_settings.shipping_markup_fixed IS 'Margen fijo en MXN que se suma al costo de envío (ej. 20).';
