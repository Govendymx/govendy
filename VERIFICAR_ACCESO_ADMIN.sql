-- ============================================
-- VERIFICAR ACCESO DE ADMINISTRADOR
-- Ejecuta esto en Supabase → SQL Editor
-- Verifica si tu usuario tiene acceso de administrador
-- ============================================

-- Verificar tu usuario específico
-- Busca tu email: arturoalejandro031187@gmail.com
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as usuario_desde,
  au.user_id as admin_user_id,
  au.role as admin_role,
  au.created_at as admin_desde,
  CASE 
    WHEN au.user_id IS NOT NULL THEN '✅ ES ADMINISTRADOR'
    ELSE '❌ NO ES ADMINISTRADOR'
  END as estado
FROM auth.users u
LEFT JOIN public.admin_users au ON au.user_id = u.id
WHERE u.email = 'arturoalejandro031187@gmail.com';

-- Verificar todas las políticas RLS de admin_users
SELECT 
  'POLÍTICAS RLS' as tipo,
  policyname,
  cmd as operacion,
  qual as condicion,
  roles
FROM pg_policies
WHERE tablename = 'admin_users';

-- Verificar si la función is_admin() existe y funciona
SELECT 
  'FUNCIÓN IS_ADMIN' as tipo,
  routine_name,
  routine_type,
  data_type as retorna
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'is_admin';

-- Probar la función is_admin() con tu user_id
-- ⚠️ REEMPLAZA 'TU_USER_ID_AQUI' con el user_id que aparece arriba
-- Ejemplo: SELECT public.is_admin() as es_admin_actual;
-- (Nota: esto solo funciona si estás autenticado como ese usuario)
