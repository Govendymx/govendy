-- ============================================
-- FIX COMPLETO: Eliminar Notificaciones
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Esto asegurará que las notificaciones se puedan eliminar correctamente
-- 
-- IMPORTANTE: Ejecuta este script completo de una vez

-- ============================================
-- 1. Verificar que la tabla existe
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

-- ============================================
-- 3. Crear política DELETE (permite a usuarios eliminar sus propias notificaciones)
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
-- 5. Verificar que la política está activa
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
-- 6. Verificar que RLS está habilitado
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_habilitado,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ACTIVO'
    ELSE '❌ RLS DESACTIVADO'
  END as estado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'notifications';

-- ============================================
-- 7. Verificar todas las políticas de la tabla
-- ============================================
SELECT 
  policyname as nombre,
  cmd as comando,
  roles as roles_permitidos,
  qual as condicion_using,
  with_check as condicion_with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script:
-- 1. Los usuarios podrán eliminar sus propias notificaciones
-- 2. Las notificaciones se eliminarán definitivamente de la base de datos
-- 3. Prueba eliminar notificaciones desde /dashboard/notificaciones
-- 4. Si aún no funciona, verifica los logs en la consola del navegador (F12)
-- 5. Verifica que SUPABASE_SERVICE_ROLE_KEY esté configurada en las variables de entorno del servidor
