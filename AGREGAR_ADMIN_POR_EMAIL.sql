-- ============================================
-- AGREGAR ADMINISTRADOR POR EMAIL (Más Fácil)
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- PASO 1: Ver todos los usuarios con su email y user_id
-- Busca tu email en esta lista y copia el user_id
SELECT 
  id as user_id,
  email,
  created_at as fecha_registro
FROM auth.users
ORDER BY created_at DESC;

-- PASO 2: Ver usuarios que YA son administradores
SELECT 
  au.user_id,
  au.role,
  au.created_at as admin_desde,
  u.email
FROM public.admin_users au
LEFT JOIN auth.users u ON u.id = au.user_id
ORDER BY au.created_at DESC;

-- PASO 3: Agregar administrador por EMAIL (más fácil que por UUID)
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
-- Ejemplo: 'alejandro@ejemplo.com'
INSERT INTO public.admin_users (user_id, role)
SELECT 
  u.id as user_id,
  'admin' as role
FROM auth.users u
WHERE u.email = 'tu-email@ejemplo.com'  -- ⚠️ REEMPLAZA ESTO con tu email
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin';

-- PASO 4: Verificar que se agregó correctamente
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con el mismo email del PASO 3
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
WHERE u.email = 'tu-email@ejemplo.com'  -- ⚠️ REEMPLAZA ESTO con tu email
ORDER BY au.created_at DESC;
