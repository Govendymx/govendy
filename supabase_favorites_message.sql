-- Pocket App - Mensaje configurable para página de favoritos
-- Ejecuta este SQL en el SQL Editor de Supabase.
-- Es idempotente.

-- Agregar columna favorites_message a app_settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'favorites_message') THEN
        ALTER TABLE public.app_settings ADD COLUMN favorites_message TEXT NULL;
    END IF;
END $$;

-- Establecer valor por defecto si no existe
UPDATE public.app_settings
SET favorites_message = 'No esperas mas y aprovecha estas ofertas antes de que te las ganen'
WHERE id = 1 AND favorites_message IS NULL;

COMMENT ON COLUMN public.app_settings.favorites_message IS 'Mensaje motivacional que aparece en la página de favoritos para incentivar compras';
