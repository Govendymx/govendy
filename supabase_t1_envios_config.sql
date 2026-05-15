-- Agregar configuración de T1 Envíos a app_settings
-- Ejecuta este SQL en Supabase SQL Editor

DO $$
BEGIN
  -- Agregar columna para configuración de T1 Envíos (JSONB)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_settings' 
    AND column_name = 't1_envios_config'
  ) THEN
    ALTER TABLE public.app_settings
    ADD COLUMN t1_envios_config JSONB DEFAULT jsonb_build_object(
      'enabled', false,
      'api_key', '',
      'api_secret', '',
      'endpoint_url', '',
      'test_mode', true
    );
  END IF;
END$$;

-- Comentario sobre la estructura
COMMENT ON COLUMN public.app_settings.t1_envios_config IS 'Configuración de T1 Envíos: {enabled: boolean, api_key: string, api_secret: string, endpoint_url: string, test_mode: boolean}';
