-- ============================================
-- AGREGAR USUARIO COMO ADMINISTRADOR
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- PASO 1: Ver todos los usuarios en auth.users
-- Esto te ayudará a encontrar el user_id que necesitas
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;

-- PASO 2: Ver usuarios que YA son administradores
SELECT 
  au.user_id,
  au.role,
  au.created_at as admin_desde,
  u.email
FROM public.admin_users au
LEFT JOIN auth.users u ON u.id = au.user_id
ORDER BY au.created_at DESC;

-- PASO 3: Agregar un usuario como administrador
-- ⚠️ IMPORTANTE: Reemplaza 'TU_USER_ID_AQUI' con el user_id del PASO 1
-- Ejemplo: '65e2306b-c119-48c2-b141-3df37c00878b'
INSERT INTO public.admin_users (user_id, role)
VALUES ('TU_USER_ID_AQUI', 'admin')  -- ⚠️ REEMPLAZA ESTO con un user_id del PASO 1
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin';

-- PASO 4: Verificar que se agregó correctamente
SELECT 
  au.user_id,
  au.role,
  au.created_at as admin_desde,
  u.email
FROM public.admin_users au
LEFT JOIN auth.users u ON u.id = au.user_id
WHERE au.user_id = 'TU_USER_ID_AQUI'  -- ⚠️ REEMPLAZA ESTO con el mismo user_id del PASO 3
ORDER BY au.created_at DESC;
