-- ============================================
-- VERIFICAR Y CORREGIR ACCESO DE ADMINISTRADOR
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- PASO 1: Verificar que la tabla admin_users existe y tiene datos
SELECT 
  'TABLA ADMIN_USERS' as tipo,
  COUNT(*) as total_administradores
FROM public.admin_users;

-- PASO 2: Ver todos los administradores actuales
SELECT 
  au.user_id,
  au.role,
  au.created_at as admin_desde,
  u.email,
  u.created_at as usuario_desde
FROM public.admin_users au
LEFT JOIN auth.users u ON u.id = au.user_id
ORDER BY au.created_at DESC;

-- PASO 3: Verificar políticas RLS de admin_users
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

-- PASO 4: Verificar si hay problemas con RLS
-- Si no puedes leer admin_users desde el cliente, puede ser un problema de RLS
-- Esta consulta verifica si la política permite leer tu propio registro
SELECT 
  'VERIFICACIÓN RLS' as tipo,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Hay políticas RLS configuradas'
    ELSE '❌ No hay políticas RLS (puede ser un problema)'
  END as estado
FROM pg_policies
WHERE tablename = 'admin_users';

-- PASO 5: Si necesitas agregar un administrador, ejecuta esto:
-- (Reemplaza 'TU_USER_ID_AQUI' con el user_id que quieres hacer admin)
-- INSERT INTO public.admin_users (user_id, role)
-- VALUES ('TU_USER_ID_AQUI', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- PASO 6: Verificar función is_admin()
SELECT 
  'FUNCIÓN IS_ADMIN' as tipo,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin';
