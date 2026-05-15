-- Actualizar configuración de Estafeta a sistema de rangos de peso con precios fijos
-- Ejecuta este SQL en Supabase SQL Editor si ya tienes la columna estafeta_config

-- Actualizar la configuración existente con los nuevos rangos (PRECIOS ACTUALIZADOS FEB 2026)
UPDATE public.app_settings
SET estafeta_config = jsonb_build_object(
  'enabled', COALESCE((estafeta_config->>'enabled')::boolean, true),
  'weight_ranges', jsonb_build_array(
    jsonb_build_object('max_weight_kg', 1, 'price', 175),
    jsonb_build_object('max_weight_kg', 5, 'price', 195),
    jsonb_build_object('max_weight_kg', 10, 'price', 235),
    jsonb_build_object('max_weight_kg', 15, 'price', 255),
    jsonb_build_object('max_weight_kg', 20, 'price', 275),
    jsonb_build_object('max_weight_kg', 25, 'price', 300),
    jsonb_build_object('max_weight_kg', 30, 'price', 325),
    jsonb_build_object('max_weight_kg', 35, 'price', 340),
    jsonb_build_object('max_weight_kg', 40, 'price', 355),
    jsonb_build_object('max_weight_kg', 45, 'price', 385),
    jsonb_build_object('max_weight_kg', 50, 'price', 415),
    jsonb_build_object('max_weight_kg', 55, 'price', 435),
    jsonb_build_object('max_weight_kg', 60, 'price', 455)
  )
)
WHERE id = 1;

-- Actualizar el comentario
COMMENT ON COLUMN public.app_settings.estafeta_config IS 'Configuración de precios Estafeta: {enabled: boolean, weight_ranges: [{max_weight_kg: número, price: número}]}';
