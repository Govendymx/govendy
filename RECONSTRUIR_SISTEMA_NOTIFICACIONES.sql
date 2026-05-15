-- ============================================
-- RECONSTRUCCIÓN COMPLETA: Sistema de Notificaciones
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Esto reconstruirá completamente el sistema de notificaciones
-- para garantizar que se puedan eliminar permanentemente
-- 
-- IMPORTANTE: Ejecuta este script completo de una vez

-- ============================================
-- 1. Crear/Verificar tabla notifications
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  message TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ============================================
-- 2. Asegurar que RLS está habilitado
-- ============================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Eliminar TODAS las políticas existentes
-- ============================================
DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

-- ============================================
-- 4. Crear políticas RLS (SELECT, INSERT, DELETE)
-- ============================================

-- SELECT: Usuarios pueden leer sus propias notificaciones
CREATE POLICY "Users can read their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: Cualquiera autenticado puede insertar (para triggers y APIs)
CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- DELETE: Usuarios pueden eliminar sus propias notificaciones
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

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
-- 7. Crear índices para mejor rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON public.notifications(user_id, is_read) WHERE is_read = false;

-- ============================================
-- 8. Verificar que las políticas están activas
-- ============================================
SELECT 
  'POLÍTICAS RLS' as tipo,
  policyname as nombre,
  cmd as comando,
  qual as condicion,
  '✅ ACTIVA' as estado
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- ============================================
-- 9. Verificar que RLS está habilitado
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
-- 10. Verificar que las funciones existen
-- ============================================
SELECT 
  'FUNCIONES' as tipo,
  routine_name as nombre,
  routine_type as tipo_funcion,
  '✅ EXISTE' as estado
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('delete_user_notifications', 'delete_all_user_notifications')
ORDER BY routine_name;

-- ============================================
-- 11. Verificar que no hay triggers que recreen notificaciones
-- ============================================
SELECT 
  'TRIGGERS' as tipo,
  trigger_name as nombre,
  event_manipulation as evento,
  event_object_table as tabla,
  action_statement as accion
FROM information_schema.triggers
WHERE event_object_table = 'notifications'
  AND trigger_schema = 'public';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script:
-- 1. Los usuarios podrán eliminar sus propias notificaciones PERMANENTEMENTE
-- 2. Las notificaciones eliminadas NO volverán a aparecer al recargar
-- 3. La función delete_user_notifications puede usarse como respaldo
-- 4. La función delete_all_user_notifications permite eliminar todas las notificaciones de un usuario
-- 5. Prueba eliminar notificaciones desde /dashboard/notificaciones
-- 6. Recarga la página y verifica que las notificaciones eliminadas NO vuelven
-- 
-- NOTA: Si después de ejecutar este script las notificaciones aún no se eliminan,
-- verifica que SUPABASE_SERVICE_ROLE_KEY esté configurada correctamente en tu .env
