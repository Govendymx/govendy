-- Pocket - Lifecycle de publicaciones (vistas + vigencia 30 días) (idempotente)
-- Ejecuta en Supabase → SQL Editor.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

-- Backfill para registros existentes
UPDATE public.listings
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Si quieres que nuevas publicaciones tengan vigencia automática:
ALTER TABLE public.listings
  ALTER COLUMN expires_at SET DEFAULT (TIMEZONE('utc'::text, NOW()) + INTERVAL '30 days');

CREATE OR REPLACE FUNCTION public.refresh_listing_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el estado es activo, asegurar vigencia
  IF NEW.status = 'active' THEN
    -- Si se está activando ahora, o si su expiración es nula o ya pasó, renovar.
    -- También renovamos si hay un cambio en el título o descripción (edición activa)
    IF OLD.status IS DISTINCT FROM 'active' 
       OR NEW.expires_at IS NULL 
       OR NEW.expires_at <= NOW()
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
    THEN
      IF NEW.sale_type = 'auction' AND NEW.auction_end_at IS NOT NULL THEN
        NEW.expires_at = NEW.auction_end_at + INTERVAL '1 hour';
      ELSE
        NEW.expires_at = TIMEZONE('utc'::text, NOW()) + INTERVAL '30 days';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_listing_expires_at ON public.listings;
CREATE TRIGGER refresh_listing_expires_at
  BEFORE UPDATE OF status, expires_at ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_listing_expires_at();

