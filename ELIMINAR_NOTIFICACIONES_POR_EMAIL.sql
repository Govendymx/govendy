-- ============================================
-- ELIMINAR NOTIFICACIONES POR EMAIL
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script elimina las notificaciones de un usuario específico usando su EMAIL
-- 
-- ⚠️ INSTRUCCIONES:
-- 1. Reemplaza 'tu-email@ejemplo.com' con el email real del usuario
-- 2. Ejecuta el script

-- ============================================
-- OPCIÓN 1: Eliminar TODAS las notificaciones (leídas y no leídas)
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- ============================================
-- OPCIÓN 2: Eliminar solo las NO LEÍDAS (recomendado)
-- ============================================
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND is_read = false;

-- ============================================
-- Verificar que se eliminaron
-- ============================================
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

-- Si el resultado muestra 0 en todas las columnas, todas las notificaciones fueron eliminadas.
