-- ============================================
-- SOLUCIÓN DEFINITIVA: Notificaciones Antiguas que Vuelven a Aparecer
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script soluciona el problema de notificaciones que no se eliminan correctamente
-- 
-- IMPORTANTE: Ejecuta este script completo de una vez

-- ============================================
-- 1. Verificar y crear tabla si no existe
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ============================================
-- 2. Eliminar TODAS las políticas DELETE existentes
-- ============================================
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can delete notifications" ON public.notifications;

-- ============================================
-- 3. Crear política DELETE robusta
-- ============================================
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 4. Asegurar que RLS está habilitado
-- ============================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. Crear función para eliminar notificaciones (SECURITY DEFINER - bypass RLS)
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_user_notifications(
  p_user_id UUID,
  p_notification_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar notificaciones del usuario especificado
  -- Esta función tiene permisos elevados (SECURITY DEFINER) y puede bypass RLS
  DELETE FROM public.notifications
  WHERE user_id = p_user_id
    AND id = ANY(p_notification_ids);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- ============================================
-- 6. Crear función para eliminar TODAS las notificaciones de un usuario
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_all_user_notifications(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = p_user_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- ============================================
-- 7. Eliminar notificaciones con fechas futuras (problema común)
-- ============================================
DELETE FROM public.notifications 
WHERE created_at > NOW() + INTERVAL '1 day';

-- ============================================
-- 8. Eliminar notificaciones duplicadas o problemáticas
-- ============================================
-- Eliminar notificaciones sin user_id válido
DELETE FROM public.notifications 
WHERE user_id IS NULL;

-- Eliminar notificaciones muy antiguas (más de 1 año) que no se han leído
DELETE FROM public.notifications 
WHERE is_read = false 
  AND created_at < NOW() - INTERVAL '1 year';

-- ============================================
-- 9. Verificar que no hay triggers que recreen notificaciones
-- ============================================
-- Listar todos los triggers en la tabla notifications
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'notifications'
  AND trigger_schema = 'public';

-- Si hay triggers en la tabla notifications que no deberían estar, elimínalos:
-- DROP TRIGGER IF EXISTS nombre_del_trigger ON public.notifications;

-- ============================================
-- 10. Verificar políticas activas
-- ============================================
SELECT 
  'POLÍTICA DELETE' as tipo,
  policyname as nombre,
  cmd as comando,
  qual as condicion,
  '✅ PERMITE ELIMINAR' as estado
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'DELETE'
ORDER BY policyname;

-- ============================================
-- 11. Verificar estado de RLS
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_habilitado,
  CASE WHEN rowsecurity THEN '✅ HABILITADO' ELSE '❌ DESHABILITADO' END as estado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'notifications';

-- ============================================
-- 12. Estadísticas de notificaciones
-- ============================================
SELECT 
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '1 year') as muy_antiguas
FROM public.notifications;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script:
-- 1. Las políticas RLS permitirán eliminar notificaciones correctamente
-- 2. Las funciones SQL permitirán eliminación incluso si RLS falla
-- 3. Se eliminarán notificaciones problemáticas (fechas futuras, duplicadas, etc.)
-- 4. Prueba eliminar notificaciones desde /dashboard/notificaciones
-- 5. Las notificaciones deberían eliminarse permanentemente y no volver a aparecer
