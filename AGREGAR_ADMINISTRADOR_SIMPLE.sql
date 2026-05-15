-- ============================================
-- AGREGAR USUARIO COMO ADMINISTRADOR (Versión Simple)
-- Ejecuta esto en Supabase → SQL Editor
-- NO necesitas reemplazar nada, muestra TODO
-- ============================================

-- Ver todos los usuarios con su email
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Ver usuarios que YA son administradores
SELECT 
  au.user_id,
  au.role,
  au.created_at as admin_desde,
  u.email
FROM public.admin_users au
LEFT JOIN auth.users u ON u.id = au.user_id
ORDER BY au.created_at DESC;

-- Para agregar un usuario como administrador, ejecuta esto:
-- (Reemplaza 'TU_USER_ID_AQUI' con el user_id que quieres hacer admin)
-- INSERT INTO public.admin_users (user_id, role)
-- VALUES ('TU_USER_ID_AQUI', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
