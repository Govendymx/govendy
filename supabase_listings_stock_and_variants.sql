-- Pocket App - Stock y variantes de color para listings
-- Ejecuta este SQL en el SQL Editor de Supabase.
-- Es idempotente.

-- Agregar columna stock (cantidad disponible)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS stock INTEGER NULL;

COMMENT ON COLUMN public.listings.stock IS 'Cantidad disponible del producto (NULL = ilimitado)';

-- Agregar columna color_variants (array de colores disponibles)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS color_variants TEXT[] NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.listings.color_variants IS 'Array de colores disponibles como variantes del producto (máximo 12)';

-- Crear función para validar que color_variants no tenga más de 12 elementos
CREATE OR REPLACE FUNCTION public.validate_color_variants()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.color_variants IS NOT NULL AND array_length(NEW.color_variants, 1) > 12 THEN
    RAISE EXCEPTION 'color_variants no puede tener más de 12 colores';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para validar color_variants
DROP TRIGGER IF EXISTS trg_validate_color_variants ON public.listings;
CREATE TRIGGER trg_validate_color_variants
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_color_variants();
