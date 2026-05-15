-- ============================================
-- CORREGIR RLS PARA admin_users
-- Ejecuta esto en Supabase → SQL Editor
-- Esto permite que los administradores puedan leer su propio registro
-- ============================================

-- Verificar políticas RLS actuales
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'admin_users';

-- Eliminar políticas existentes (si es necesario)
DROP POLICY IF EXISTS "Admin can read own admin row" ON public.admin_users;

-- Crear política que permite a los usuarios leer su propio registro de admin
-- Esto es necesario para que el frontend pueda verificar si un usuario es admin
CREATE POLICY "Admin can read own admin row"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Verificar que la política se creó correctamente
SELECT 
  'POLÍTICA CREADA' as estado,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'admin_users';

-- Verificar que puedes leer tu propio registro
-- ⚠️ REEMPLAZA 'TU_USER_ID_AQUI' con tu user_id
-- Ejemplo: '4fcaca5a-3e25-465a-baeb-c771bc497df8'
SELECT 
  au.user_id,
  au.role,
  au.created_at as admin_desde,
  u.email,
  CASE 
    WHEN au.user_id IS NOT NULL THEN '✅ ES ADMINISTRADOR'
    ELSE '❌ NO ES ADMINISTRADOR'
  END as estado
FROM auth.users u
LEFT JOIN public.admin_users au ON au.user_id = u.id
WHERE u.id = 'TU_USER_ID_AQUI'  -- ⚠️ REEMPLAZA ESTO con tu user_id
  OR u.email = 'arturoalejandro031187@gmail.com';  -- O usa tu email directamente
