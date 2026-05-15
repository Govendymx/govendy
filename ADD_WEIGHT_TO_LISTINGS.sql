-- Agregar columnas de peso y dimensiones a la tabla listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS length_cm NUMERIC(10, 2) DEFAULT 10.0,
  ADD COLUMN IF NOT EXISTS width_cm NUMERIC(10, 2) DEFAULT 10.0,
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(10, 2) DEFAULT 10.0;

COMMENT ON COLUMN public.listings.weight_kg IS 'Peso del producto empacado en kg';
COMMENT ON COLUMN public.listings.length_cm IS 'Largo del paquete en cm';
COMMENT ON COLUMN public.listings.width_cm IS 'Ancho del paquete en cm';
COMMENT ON COLUMN public.listings.height_cm IS 'Alto del paquete en cm';
