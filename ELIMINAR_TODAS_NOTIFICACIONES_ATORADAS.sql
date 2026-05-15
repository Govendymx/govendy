-- ============================================
-- ELIMINAR TODAS LAS NOTIFICACIONES ATORADAS
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script elimina TODAS las notificaciones problemáticas de forma agresiva
-- 
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
-- Ejecuta cada paso por separado para ver qué elimina

-- ============================================
-- PASO 1: Ver resumen de notificaciones problemáticas
-- ============================================
SELECT 
  'RESUMEN' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas,
  COUNT(*) FILTER (WHERE is_read IS NULL) as is_read_null,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '1 year') as muy_antiguas
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- ============================================
-- PASO 2: ELIMINAR notificaciones con fechas FUTURAS (CRÍTICO)
-- ============================================
-- Estas son las que causan que vuelvan a aparecer
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at > NOW();

-- ============================================
-- PASO 3: ELIMINAR todas las notificaciones NO LEÍDAS
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read = false;

-- ============================================
-- PASO 4: ELIMINAR notificaciones con IS_READ NULL
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read IS NULL;

-- ============================================
-- PASO 5: ELIMINAR notificaciones muy antiguas (>1 año)
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at < NOW() - INTERVAL '1 year';

-- ============================================
-- PASO 6: ELIMINAR TODAS las notificaciones (OPCIÓN NUCLEAR)
-- ============================================
-- ⚠️ SOLO ejecuta esto si quieres eliminar TODAS (leídas y no leídas)
-- Descomenta las siguientes líneas si es necesario:
-- DELETE FROM public.notifications 
-- WHERE user_id = (
--   SELECT id FROM auth.users 
--   WHERE email = 'tu-email@ejemplo.com'
--   LIMIT 1
-- );

-- ============================================
-- PASO 7: Verificar que se eliminaron TODAS
-- ============================================
SELECT 
  'VERIFICACIÓN FINAL' as estado,
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras,
  COUNT(*) FILTER (WHERE is_read IS NULL) as is_read_null
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- Si todos los valores son 0, todas las notificaciones fueron eliminadas correctamente.
