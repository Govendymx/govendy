-- ============================================
-- ELIMINAR NOTIFICACIONES PERMANENTEMENTE
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script elimina TODAS las notificaciones, incluyendo las problemáticas
-- 
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
-- Ejecuta cada paso por separado para evitar timeouts

-- ============================================
-- PASO 1: Eliminar notificaciones con fechas FUTURAS (estas se "activan" automáticamente)
-- ============================================
-- ⚠️ ESTO ES CRÍTICO: Las notificaciones con fechas futuras se "activan" cuando llega su fecha
-- Ejecuta este paso PRIMERO
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at > NOW();

-- ============================================
-- PASO 2: Eliminar todas las notificaciones NO LEÍDAS
-- ============================================
-- Ejecuta este paso DESPUÉS del PASO 1
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read = false;

-- ============================================
-- PASO 3: Eliminar notificaciones muy antiguas (más de 1 año)
-- ============================================
-- Ejecuta este paso DESPUÉS del PASO 2
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at < NOW() - INTERVAL '1 year'
AND is_read = false;

-- ============================================
-- PASO 4: Verificar que se eliminaron
-- ============================================
SELECT 
  'VERIFICACIÓN FINAL' as estado,
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '1 year') as muy_antiguas
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- Si el resultado muestra no_leidas = 0 y fechas_futuras = 0, todas fueron eliminadas correctamente.
