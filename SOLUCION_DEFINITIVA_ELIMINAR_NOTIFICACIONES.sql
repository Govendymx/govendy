-- ============================================
-- SOLUCIÓN DEFINITIVA: Eliminar Notificaciones
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Esto asegurará que las notificaciones se eliminen PERMANENTEMENTE
-- y NO vuelvan a aparecer al recargar la página
-- 
-- IMPORTANTE: Ejecuta este script completo de una vez para TODOS los usuarios

-- ============================================
-- 1. Verificar que la tabla existe
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
-- 3. Eliminar TODAS las políticas DELETE existentes
-- ============================================
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete notifications" ON public.notifications;

-- ============================================
-- 4. Crear política DELETE (permite a usuarios eliminar sus propias notificaciones)
-- ============================================
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 5. Crear función para eliminar notificaciones (bypass RLS si es necesario)
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
  DELETE FROM public.notifications
  WHERE user_id = p_user_id
    AND id = ANY(p_notification_ids);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- ============================================
-- 6. Verificar que la política está activa
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
-- 7. Verificar que RLS está habilitado
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
-- 8. Verificar que no hay triggers que recreen notificaciones
-- ============================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
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
-- 4. Prueba eliminar notificaciones desde /dashboard/notificaciones
-- 5. Recarga la página y verifica que las notificaciones eliminadas NO vuelven
