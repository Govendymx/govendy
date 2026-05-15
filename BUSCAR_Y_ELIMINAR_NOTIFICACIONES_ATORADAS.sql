-- ============================================
-- BUSCAR Y ELIMINAR NOTIFICACIONES ATORADAS
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script busca y elimina TODAS las notificaciones problemáticas
-- 
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
-- Ejecuta cada paso por separado para ver qué encuentra

-- ============================================
-- PASO 1: Ver TODAS tus notificaciones (diagnóstico)
-- ============================================
SELECT 
  id,
  type,
  title,
  created_at,
  is_read,
  CASE 
    WHEN created_at > NOW() THEN '⚠️ FECHA FUTURA'
    WHEN created_at < NOW() - INTERVAL '1 year' THEN '⚠️ MUY ANTIGUA'
    WHEN is_read IS NULL THEN '⚠️ IS_READ NULL'
    ELSE '✅ OK'
  END as estado
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
ORDER BY created_at DESC
LIMIT 100;

-- ============================================
-- PASO 2: Contar notificaciones por estado
-- ============================================
SELECT 
  'TOTAL' as categoria,
  COUNT(*) as cantidad
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)

UNION ALL

SELECT 
  'NO LEÍDAS' as categoria,
  COUNT(*) as cantidad
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read = false

UNION ALL

SELECT 
  'FECHAS FUTURAS' as categoria,
  COUNT(*) as cantidad
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at > NOW()

UNION ALL

SELECT 
  'MUY ANTIGUAS (>1 año)' as categoria,
  COUNT(*) as cantidad
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at < NOW() - INTERVAL '1 year'

UNION ALL

SELECT 
  'IS_READ NULL' as categoria,
  COUNT(*) as cantidad
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read IS NULL;

-- ============================================
-- PASO 3: ELIMINAR notificaciones con fechas FUTURAS (CRÍTICO)
-- ============================================
-- ⚠️ ESTAS SON LAS QUE CAUSAN QUE VUELVAN A APARECER
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at > NOW();

-- ============================================
-- PASO 4: ELIMINAR todas las notificaciones NO LEÍDAS
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read = false;

-- ============================================
-- PASO 5: ELIMINAR notificaciones con IS_READ NULL
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read IS NULL;

-- ============================================
-- PASO 6: ELIMINAR notificaciones muy antiguas (>1 año)
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at < NOW() - INTERVAL '1 year';

-- ============================================
-- PASO 7: ELIMINAR TODAS las notificaciones (OPCIÓN NUCLEAR)
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
-- PASO 8: Verificar que se eliminaron
-- ============================================
SELECT 
  'VERIFICACIÓN FINAL' as estado,
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras,
  COUNT(*) FILTER (WHERE is_read IS NULL) as is_read_null,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '1 year') as muy_antiguas
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- Si todos los valores son 0, todas las notificaciones fueron eliminadas correctamente.
