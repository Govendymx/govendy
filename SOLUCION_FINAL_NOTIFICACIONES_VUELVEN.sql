-- ============================================
-- SOLUCIÓN FINAL: Notificaciones que Vuelven a Aparecer
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- 
-- ⚠️ PROBLEMA: Las notificaciones se eliminan pero vuelven a aparecer después de 2 segundos
-- ⚠️ CAUSA: Notificaciones con fechas FUTURAS que se "activan" automáticamente
-- 
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
-- Ejecuta cada paso por separado para evitar timeouts

-- ============================================
-- PASO 1: Ver notificaciones con fechas FUTURAS (CRÍTICO)
-- ============================================
-- Estas son las que causan que vuelvan a aparecer
-- Ejecuta esto PRIMERO para ver qué notificaciones tienen fechas futuras
SELECT 
  id,
  type,
  title,
  created_at,
  NOW() as ahora,
  created_at - NOW() as tiempo_restante,
  '⚠️ FECHA FUTURA - SE ACTIVARÁ AUTOMÁTICAMENTE' as problema
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at > NOW()
ORDER BY created_at DESC;

-- ============================================
-- PASO 2: ELIMINAR notificaciones con fechas FUTURAS (OBLIGATORIO)
-- ============================================
-- ⚠️ ESTO ES LO MÁS IMPORTANTE
-- Las notificaciones con fechas futuras se "activan" cuando llega su fecha
-- Ejecuta este paso DESPUÉS de ver el PASO 1
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at > NOW();

-- ============================================
-- PASO 3: Eliminar todas las notificaciones NO LEÍDAS
-- ============================================
-- Ejecuta este paso DESPUÉS del PASO 2
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read = false;

-- ============================================
-- PASO 4: Verificar que se eliminaron TODAS
-- ============================================
-- Ejecuta este paso para verificar
SELECT 
  'VERIFICACIÓN FINAL' as estado,
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras,
  CASE 
    WHEN COUNT(*) FILTER (WHERE created_at > NOW()) > 0 THEN '⚠️ AÚN HAY FECHAS FUTURAS'
    WHEN COUNT(*) FILTER (WHERE is_read = false) > 0 THEN '⚠️ AÚN HAY NO LEÍDAS'
    ELSE '✅ TODAS ELIMINADAS CORRECTAMENTE'
  END as resultado
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- ============================================
-- PASO 5: Si aún hay notificaciones, eliminarlas TODAS (nuclear option)
-- ============================================
-- ⚠️ SOLO ejecuta esto si el PASO 4 muestra que aún hay notificaciones
-- Esto elimina TODAS las notificaciones (leídas y no leídas)
-- Descomenta las siguientes líneas si es necesario:
-- DELETE FROM public.notifications 
-- WHERE user_id = (
--   SELECT id FROM auth.users 
--   WHERE email = 'tu-email@ejemplo.com'
--   LIMIT 1
-- );
