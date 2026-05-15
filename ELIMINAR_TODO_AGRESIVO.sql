-- ============================================
-- ELIMINAR TODO - VERSIÓN AGRESIVA
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script elimina TODAS las notificaciones sin importar su estado
-- 
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real

-- ============================================
-- PASO 1: Ver cuántas notificaciones tienes ANTES de eliminar
-- ============================================
SELECT 
  'ANTES DE ELIMINAR' as estado,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas,
  COUNT(*) FILTER (WHERE is_read IS NULL) as is_read_null
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- ============================================
-- PASO 2: ELIMINAR TODAS LAS NOTIFICACIONES (SIN EXCEPCIÓN)
-- ============================================
-- ⚠️ Esto elimina TODAS las notificaciones (leídas, no leídas, con problemas, etc.)
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- ============================================
-- PASO 3: Verificar que se eliminaron TODAS
-- ============================================
SELECT 
  'DESPUÉS DE ELIMINAR' as estado,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- Si el resultado muestra total = 0, todas las notificaciones fueron eliminadas.
