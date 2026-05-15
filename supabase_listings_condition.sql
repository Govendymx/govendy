-- Pocket - Agregar campo de condición del artículo en listings (idempotente)
-- Ejecuta esto en Supabase → SQL Editor.

-- Crear enum para condición
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_condition') THEN
    CREATE TYPE public.listing_condition AS ENUM ('nuevo', 'usado', 'casi_nuevo');
  END IF;
END$$;

-- Agregar columna condition
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS condition public.listing_condition NULL;

-- Comentario
COMMENT ON COLUMN public.listings.condition IS 'Condición del artículo: nuevo, usado, casi_nuevo';
