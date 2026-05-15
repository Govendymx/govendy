-- ============================================
-- LIMPIAR TODAS LAS NOTIFICACIONES
-- ============================================
-- ⚠️ ATENCIÓN: Este script elimina TODAS las notificaciones de TODOS los usuarios
-- Ejecuta este SQL en Supabase → SQL Editor
-- 
-- IMPORTANTE: Este script es IRREVERSIBLE. Asegúrate de hacer backup si necesitas
-- conservar alguna notificación antes de ejecutarlo.

-- ============================================
-- 1. Eliminar TODAS las notificaciones
-- ============================================
DELETE FROM public.notifications;

-- ============================================
-- 2. Verificar que se eliminaron todas
-- ============================================
SELECT COUNT(*) as total_notificaciones_restantes FROM public.notifications;

-- Si el resultado es 0, todas las notificaciones fueron eliminadas correctamente.
-- Si hay algún error, verifica que la tabla existe y que tienes permisos.
