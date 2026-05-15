-- ============================================
-- AGREGAR ADMINISTRADOR - Versión Directa
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- Ver todos los usuarios y sus emails
-- Busca tu email y copia el user_id (columna id)
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Ver administradores actuales
SELECT 
  au.user_id,
  u.email,
  au.role,
  au.created_at as admin_desde
FROM public.admin_users au
LEFT JOIN auth.users u ON u.id = au.user_id
ORDER BY au.created_at DESC;

-- Para agregar un administrador, ejecuta ESTA consulta:
-- Reemplaza 'TU_EMAIL_AQUI' con tu email real
-- Ejemplo: INSERT INTO public.admin_users (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'alejandro@ejemplo.com'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
