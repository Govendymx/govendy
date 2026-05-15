-- ============================================
-- ELIMINAR NOTIFICACIONES PROBLEMÁTICAS
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script elimina notificaciones que pueden estar causando problemas:
-- - Notificaciones con fechas futuras
-- - Notificaciones duplicadas
-- - Notificaciones muy antiguas no leídas
-- - Notificaciones sin user_id válido

-- ============================================
-- 1. Eliminar notificaciones con fechas futuras (error común)
-- ============================================
DELETE FROM public.notifications 
WHERE created_at > NOW() + INTERVAL '1 day';

-- ============================================
-- 2. Eliminar notificaciones sin user_id válido
-- ============================================
DELETE FROM public.notifications 
WHERE user_id IS NULL;

-- ============================================
-- 3. Eliminar notificaciones muy antiguas no leídas (más de 1 año)
-- ============================================
DELETE FROM public.notifications 
WHERE is_read = false 
  AND created_at < NOW() - INTERVAL '1 year';

-- ============================================
-- 4. Eliminar notificaciones duplicadas (mismo user_id, type, title, body, created_at)
-- ============================================
DELETE FROM public.notifications n1
WHERE EXISTS (
  SELECT 1 
  FROM public.notifications n2
  WHERE n2.user_id = n1.user_id
    AND n2.type = n1.type
    AND n2.title = n1.title
    AND n2.body = n1.body
    AND n2.created_at = n1.created_at
    AND n2.id < n1.id  -- Mantener la más antigua, eliminar las duplicadas
);

-- ============================================
-- 5. Verificar cuántas notificaciones quedan
-- ============================================
SELECT 
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '1 year') as muy_antiguas,
  COUNT(*) FILTER (WHERE user_id IS NULL) as sin_user_id
FROM public.notifications;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script, las notificaciones problemáticas deberían estar eliminadas.
-- Si aún tienes problemas, ejecuta también: SOLUCION_DEFINITIVA_NOTIFICACIONES_ANTIGUAS.sql
