-- 1. Primero verificar qué publicaciones están afectadas por el bug (created_at > expires_at)
SELECT 
    id, 
    title, 
    status, 
    sale_type,
    expires_at,
    seller_id,
    created_at,
    updated_at
FROM public.listings 
WHERE status = 'paused' 
  AND expires_at IS NOT NULL
  AND expires_at < NOW()
  AND created_at > expires_at
  AND (sale_type IS NULL OR sale_type <> 'auction')
ORDER BY created_at DESC
LIMIT 50;

-- 2. Reactivar esas publicaciones inconsistentes sin aplicar nueva vigencia de 30 días
UPDATE public.listings 
SET 
    status = 'active',
    expires_at = NULL,
    updated_at = NOW()
WHERE status = 'paused' 
  AND expires_at IS NOT NULL
  AND expires_at < NOW()
  AND created_at > expires_at
  AND (sale_type IS NULL OR sale_type <> 'auction');

-- 3. Verificar los cambios recientes
SELECT 
    COUNT(*) as reactivated_count,
    'Publicaciones reactivadas exitosamente' as message
FROM public.listings 
WHERE status = 'active' 
  AND updated_at > (NOW() - INTERVAL '5 minutes');

ALTER TABLE public.listings
  ALTER COLUMN expires_at DROP DEFAULT;

DROP TRIGGER IF EXISTS refresh_listing_expires_at ON public.listings;

DROP FUNCTION IF EXISTS public.refresh_listing_expires_at();
