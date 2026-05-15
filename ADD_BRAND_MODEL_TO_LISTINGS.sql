
-- Agregar columnas brand y model a la tabla listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text;

COMMENT ON COLUMN public.listings.brand IS 'Marca del producto (ej. Samsung, Nike)';
COMMENT ON COLUMN public.listings.model IS 'Modelo del producto (ej. Galaxy S21, Air Force 1)';
