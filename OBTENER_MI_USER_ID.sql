-- ============================================
-- OBTENER MI USER ID
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script te muestra tu ID de usuario actual

-- ============================================
-- OPCIÓN 1: Si estás autenticado en Supabase
-- ============================================
SELECT 
  auth.uid() as mi_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as mi_email;

-- ============================================
-- OPCIÓN 2: Ver todos los usuarios y sus emails
-- ============================================
-- ⚠️ Solo funciona si tienes permisos de administrador
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- OPCIÓN 3: Buscar tu usuario por email
-- ============================================
-- Reemplaza 'tu-email@ejemplo.com' con tu email
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'tu-email@ejemplo.com';

-- ============================================
-- OPCIÓN 4: Ver tus notificaciones actuales
-- ============================================
SELECT 
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas
FROM public.notifications
WHERE user_id = auth.uid();
