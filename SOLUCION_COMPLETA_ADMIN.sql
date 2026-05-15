-- ============================================
-- SOLUCIÓN COMPLETA: Acceso de Administrador
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- PASO 1: Verificar que tu usuario está en admin_users
SELECT 
  u.id as user_id,
  u.email,
  au.user_id as admin_user_id,
  au.role,
  au.created_at as admin_desde,
  CASE 
    WHEN au.user_id IS NOT NULL THEN '✅ ES ADMINISTRADOR'
    ELSE '❌ NO ES ADMINISTRADOR - Necesitas agregarlo'
  END as estado
FROM auth.users u
LEFT JOIN public.admin_users au ON au.user_id = u.id
WHERE u.email = 'arturoalejandro031187@gmail.com';

-- PASO 2: Si no está, agregarlo (ejecuta esto solo si el PASO 1 muestra "NO ES ADMINISTRADOR")
-- INSERT INTO public.admin_users (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'arturoalejandro031187@gmail.com'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- PASO 3: Verificar y corregir políticas RLS
-- Eliminar política existente
DROP POLICY IF EXISTS "Admin can read own admin row" ON public.admin_users;

-- Crear política que permite a los usuarios autenticados leer su propio registro
-- Esto es CRÍTICO para que el frontend pueda verificar si un usuario es admin
CREATE POLICY "Admin can read own admin row"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- PASO 4: Verificar que la política se creó correctamente
SELECT 
  'POLÍTICA RLS' as tipo,
  policyname,
  cmd as operacion,
  CASE 
    WHEN qual LIKE '%auth.uid()%' THEN '✅ Usa auth.uid() correctamente'
    ELSE '⚠️ Revisar condición'
  END as estado
FROM pg_policies
WHERE tablename = 'admin_users';

-- PASO 5: Verificar función is_admin()
SELECT 
  'FUNCIÓN IS_ADMIN' as tipo,
  routine_name,
  routine_type,
  CASE 
    WHEN routine_name = 'is_admin' THEN '✅ Existe'
    ELSE '❌ No existe'
  END as estado
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin';

-- PASO 6: Verificar todos los administradores
SELECT 
  'TODOS LOS ADMINISTRADORES' as tipo,
  au.user_id,
  u.email,
  au.role,
  au.created_at as admin_desde
FROM public.admin_users au
LEFT JOIN auth.users u ON u.id = au.user_id
ORDER BY au.created_at DESC;
