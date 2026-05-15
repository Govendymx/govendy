-- Pocket - ID público para publicaciones (legible para buscar/soporte)
-- Ejecuta en Supabase → SQL Editor. (idempotente)

-- ID público derivado del UUID para que sea estable y sin lógica extra en el server.
-- Ejemplo: PCK-1A2B3C4D5E
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS public_id TEXT
  GENERATED ALWAYS AS ('PCK-' || upper(substr(replace(id::text, '-', ''), 1, 10))) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS listings_public_id_ux ON public.listings (public_id);

