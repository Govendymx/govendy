-- ============================================
-- ELIMINAR TODAS LAS NOTIFICACIONES NO LEÍDAS
-- ============================================
-- ⚠️ ATENCIÓN: Este script elimina TODAS las notificaciones NO LEÍDAS de TODOS los usuarios
-- Ejecuta este SQL en Supabase → SQL Editor
-- 
-- Si solo quieres eliminar las de un usuario específico, usa:
-- DELETE FROM public.notifications WHERE user_id = 'TU_USER_ID' AND is_read = false;

-- ============================================
-- 1. Eliminar TODAS las notificaciones NO LEÍDAS
-- ============================================
DELETE FROM public.notifications WHERE is_read = false;

-- ============================================
-- 2. Verificar que se eliminaron todas
-- ============================================
SELECT COUNT(*) as total_notificaciones_no_leidas FROM public.notifications WHERE is_read = false;

-- Si el resultado es 0, todas las notificaciones no leídas fueron eliminadas correctamente.
