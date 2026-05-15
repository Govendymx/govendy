-- Sistema mejorado de mensajes por sección
-- Permite múltiples mensajes con HTML, vigencia y más opciones

-- Agregar columna para mensajes por sección (JSONB)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_settings' 
    AND column_name = 'section_messages'
  ) THEN
    ALTER TABLE public.app_settings
    ADD COLUMN section_messages JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Estructura esperada de section_messages:
-- {
--   "favoritos": {
--     "message": "Texto del mensaje",
--     "html": false,
--     "is_active": true,
--     "starts_at": null,
--     "ends_at": null,
--     "style": {
--       "background_color": "#fff3cd",
--       "text_color": "#856404",
--       "border_color": "#ffc107"
--     }
--   },
--   "dashboard": { ... },
--   "ventas": { ... }
-- }

COMMENT ON COLUMN public.app_settings.section_messages IS 'Mensajes configurables por seccion con estructura JSONB';
