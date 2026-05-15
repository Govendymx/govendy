-- ============================================
-- ELIMINAR MIS NOTIFICACIONES (Usuario Autenticado)
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script elimina las notificaciones del usuario que está autenticado actualmente
-- NO necesitas reemplazar ningún ID, usa automáticamente tu usuario actual

-- ============================================
-- OPCIÓN 1: Eliminar TODAS las notificaciones (leídas y no leídas)
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = auth.uid();

-- ============================================
-- OPCIÓN 2: Eliminar solo las NO LEÍDAS (recomendado)
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = auth.uid() 
  AND is_read = false;

-- ============================================
-- OPCIÓN 3: Eliminar notificaciones problemáticas específicas
-- ============================================
-- Eliminar notificaciones con fechas futuras
DELETE FROM public.notifications 
WHERE user_id = auth.uid() 
  AND created_at > NOW() + INTERVAL '1 day';

-- Eliminar notificaciones muy antiguas no leídas
DELETE FROM public.notifications 
WHERE user_id = auth.uid() 
  AND is_read = false 
  AND created_at < NOW() - INTERVAL '1 year';

-- ============================================
-- Verificar que se eliminaron
-- ============================================
SELECT 
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas
FROM public.notifications
WHERE user_id = auth.uid();

-- Si el resultado muestra 0 en todas las columnas, todas las notificaciones fueron eliminadas.
