-- Agregar configuración de precios Estafeta a app_settings
-- Ejecuta este SQL en Supabase SQL Editor

DO $$
BEGIN
  -- Agregar columna para configuración de precios Estafeta (JSONB)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_settings' 
    AND column_name = 'estafeta_config'
  ) THEN
    ALTER TABLE public.app_settings
    ADD COLUMN estafeta_config JSONB DEFAULT jsonb_build_object(
      'enabled', true,
      'weight_ranges', jsonb_build_array(
        jsonb_build_object('max_weight_kg', 1, 'price', 168),
        jsonb_build_object('max_weight_kg', 5, 'price', 170),
        jsonb_build_object('max_weight_kg', 10, 'price', 225),
        jsonb_build_object('max_weight_kg', 15, 'price', 240),
        jsonb_build_object('max_weight_kg', 20, 'price', 260),
        jsonb_build_object('max_weight_kg', 25, 'price', 275),
        jsonb_build_object('max_weight_kg', 30, 'price', 295),
        jsonb_build_object('max_weight_kg', 35, 'price', 295),
        jsonb_build_object('max_weight_kg', 40, 'price', 310),
        jsonb_build_object('max_weight_kg', 45, 'price', 385),
        jsonb_build_object('max_weight_kg', 50, 'price', 435),
        jsonb_build_object('max_weight_kg', 55, 'price', 465),
        jsonb_build_object('max_weight_kg', 60, 'price', 485)
      )
    );
  END IF;
END$$;

-- Comentario sobre la estructura
COMMENT ON COLUMN public.app_settings.estafeta_config IS 'Configuración de precios Estafeta: {enabled: boolean, weight_ranges: [{max_weight_kg: número, price: número}]}';
