-- Pocket - Agregar campo de peso máximo (KG) a shipping_options (idempotente)
-- Ejecuta esto en Supabase → SQL Editor.

ALTER TABLE public.shipping_options
  ADD COLUMN IF NOT EXISTS max_weight_kg NUMERIC NULL;

-- Comentario
COMMENT ON COLUMN public.shipping_options.max_weight_kg IS 'Peso máximo en kilogramos que acepta esta opción de envío (NULL = sin límite)';
