-- ============================================
-- FIX: Política RLS para Eliminar Notificaciones
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Esto permitirá que los usuarios eliminen sus propias notificaciones

-- ============================================
-- 1. Eliminar política antigua si existe
-- ============================================
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- ============================================
-- 2. Crear política para DELETE
-- ============================================
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 3. Verificar que la política está activa
-- ============================================
SELECT 
  'POLÍTICA DELETE' as tipo,
  policyname as nombre,
  cmd as comando,
  '✅ PERMITE ELIMINAR' as estado
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'DELETE'
ORDER BY policyname;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script:
-- 1. Los usuarios podrán eliminar sus propias notificaciones
-- 2. Las notificaciones se eliminarán definitivamente de la base de datos
-- 3. Prueba eliminar notificaciones desde /dashboard/notificaciones
