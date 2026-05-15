-- ============================================
-- ELIMINAR NOTIFICACIONES - PASO A PASO (VERSIÓN SIMPLE)
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- 
-- ⚠️ INSTRUCCIONES:
-- 1. Reemplaza 'tu-email@ejemplo.com' con tu email real
-- 2. Ejecuta SOLO el PASO 1 primero
-- 3. Luego ejecuta el PASO 2
-- 4. Finalmente ejecuta el PASO 3 para verificar

-- ============================================
-- PASO 1: Eliminar notificaciones NO LEÍDAS
-- ============================================
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
-- Ejecuta SOLO este bloque primero
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read = false;
