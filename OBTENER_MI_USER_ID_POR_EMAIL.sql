-- ============================================
-- OBTENER MI USER ID POR EMAIL
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- 
-- ⚠️ INSTRUCCIONES:
-- 1. Reemplaza 'tu-email@ejemplo.com' con tu email real
-- 2. Ejecuta el script
-- 3. Copia el UUID que aparece en la columna "user_id"
-- 4. Usa ese UUID en otros scripts que lo requieran

-- ============================================
-- Buscar usuario por email
-- ============================================
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
SELECT 
  id as user_id,
  email,
  created_at as fecha_registro
FROM auth.users
WHERE email = 'tu-email@ejemplo.com';

-- ============================================
-- Ver también tus notificaciones actuales
-- ============================================
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
SELECT 
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);
