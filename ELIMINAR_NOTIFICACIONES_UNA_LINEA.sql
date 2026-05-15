-- ============================================
-- ELIMINAR NOTIFICACIONES - UNA SOLA LÍNEA
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- 
-- ⚠️ INSTRUCCIONES:
-- 1. Reemplaza 'tu-email@ejemplo.com' con tu email real
-- 2. Ejecuta esta línea
-- 3. Si funciona, ejecuta también VERIFICAR_NOTIFICACIONES_ELIMINADAS.sql

-- ============================================
-- Eliminar todas las notificaciones NO LEÍDAS
-- ============================================
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
DELETE FROM public.notifications WHERE user_id = (SELECT id FROM auth.users WHERE email = 'tu-email@ejemplo.com' LIMIT 1) AND is_read = false;
