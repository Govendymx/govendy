-- ============================================
-- ELIMINAR NOTIFICACIONES DIRECTAMENTE (BYPASS RLS)
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script elimina las notificaciones directamente desde la BD
-- 
-- ⚠️ IMPORTANTE: 
-- - Si estás autenticado como usuario, usa OPCIÓN 1 (usa auth.uid() automáticamente)
-- - Si ejecutas como admin/postgres, usa OPCIÓN 2 (especifica el user_id)

-- ============================================
-- OPCIÓN 1: Eliminar usando auth.uid() (si estás autenticado)
-- ============================================
-- Esta opción funciona si ejecutas el SQL desde la aplicación o como usuario autenticado
DELETE FROM public.notifications 
WHERE user_id = auth.uid() 
  AND is_read = false;

-- ============================================
-- OPCIÓN 2: Eliminar especificando user_id (si ejecutas como admin/postgres)
-- ============================================
-- ⚠️ REEMPLAZA 'TU_USER_ID_AQUI' con el UUID de tu usuario
-- Para obtener tu user_id, ejecuta primero: OBTENER_MI_USER_ID.sql
-- O busca tu email en: SELECT id, email FROM auth.users WHERE email = 'tu-email@ejemplo.com';

-- Descomenta y ejecuta esta línea (reemplaza el UUID):
-- DELETE FROM public.notifications 
-- WHERE user_id = 'TU_USER_ID_AQUI'::uuid
--   AND is_read = false;

-- ============================================
-- OPCIÓN 3: Eliminar por email (más fácil si no tienes el UUID)
-- ============================================
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
-- Descomenta y ejecuta estas líneas:
-- DELETE FROM public.notifications 
-- WHERE user_id = (
--   SELECT id FROM auth.users 
--   WHERE email = 'tu-email@ejemplo.com'
--   LIMIT 1
-- )
-- AND is_read = false;

-- ============================================
-- PASO 4: Eliminar también notificaciones problemáticas (fechas futuras)
-- ============================================
-- OPCIÓN 1: Si estás autenticado
DELETE FROM public.notifications 
WHERE user_id = auth.uid() 
  AND created_at > NOW() + INTERVAL '1 day';

-- OPCIÓN 2: Si ejecutas como admin (reemplaza el UUID o descomenta la opción por email)
-- DELETE FROM public.notifications 
-- WHERE user_id = 'TU_USER_ID_AQUI'::uuid
--   AND created_at > NOW() + INTERVAL '1 day';

-- OPCIÓN 3: Por email (descomenta y reemplaza el email)
-- DELETE FROM public.notifications 
-- WHERE user_id = (
--   SELECT id FROM auth.users 
--   WHERE email = 'tu-email@ejemplo.com'
--   LIMIT 1
-- )
-- AND created_at > NOW() + INTERVAL '1 day';

-- ============================================
-- PASO 5: Verificar que se eliminaron
-- ============================================
-- OPCIÓN 1: Si estás autenticado
SELECT 
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras
FROM public.notifications
WHERE user_id = auth.uid();

-- OPCIÓN 2: Si ejecutas como admin (reemplaza el UUID)
-- SELECT 
--   COUNT(*) as total_notificaciones,
--   COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
--   COUNT(*) FILTER (WHERE is_read = true) as leidas,
--   COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras
-- FROM public.notifications
-- WHERE user_id = 'TU_USER_ID_AQUI'::uuid;

-- OPCIÓN 3: Por email (descomenta y reemplaza el email)
-- SELECT 
--   COUNT(*) as total_notificaciones,
--   COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
--   COUNT(*) FILTER (WHERE is_read = true) as leidas,
--   COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras
-- FROM public.notifications
-- WHERE user_id = (
--   SELECT id FROM auth.users 
--   WHERE email = 'tu-email@ejemplo.com'
--   LIMIT 1
-- );

-- ============================================
-- FUNCIÓN AUXILIAR (opcional - para uso desde la aplicación)
-- ============================================
-- Esta función se crea automáticamente cuando la API la necesita
-- No es necesario ejecutarla manualmente

CREATE OR REPLACE FUNCTION public.delete_my_unread_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
  my_user_id UUID;
BEGIN
  -- Obtener el ID del usuario autenticado
  my_user_id := auth.uid();
  
  IF my_user_id IS NULL THEN
    -- Si no hay usuario autenticado, retornar 0 sin error
    RETURN 0;
  END IF;
  
  -- Eliminar TODAS las notificaciones no leídas del usuario
  -- Esta función tiene permisos elevados (SECURITY DEFINER) y puede bypass RLS
  DELETE FROM public.notifications
  WHERE user_id = my_user_id
    AND is_read = false;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;
