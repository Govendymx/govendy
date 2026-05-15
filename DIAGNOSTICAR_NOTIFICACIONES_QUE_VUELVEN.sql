-- ============================================
-- DIAGNOSTICAR: Notificaciones que Vuelven a Aparecer
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script te ayudará a identificar por qué las notificaciones vuelven a aparecer
-- 
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real

-- ============================================
-- PASO 1: Ver todas tus notificaciones actuales
-- ============================================
SELECT 
  id,
  type,
  title,
  created_at,
  is_read,
  CASE 
    WHEN created_at > NOW() THEN '⚠️ FECHA FUTURA'
    WHEN created_at < NOW() - INTERVAL '1 year' THEN '⚠️ MUY ANTIGUA'
    ELSE '✅ OK'
  END as estado
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- PASO 2: Verificar si hay triggers que crean notificaciones
-- ============================================
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND (trigger_name LIKE '%notif%' OR trigger_name LIKE '%notification%')
ORDER BY trigger_name;

-- ============================================
-- PASO 3: Verificar funciones que crean notificaciones
-- ============================================
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_definition LIKE '%notifications%' 
    OR routine_definition LIKE '%INSERT INTO%notifications%'
  )
ORDER BY routine_name;

-- ============================================
-- PASO 4: Ver notificaciones con fechas futuras (se activan automáticamente)
-- ============================================
SELECT 
  id,
  type,
  title,
  created_at,
  NOW() as ahora,
  created_at - NOW() as diferencia_tiempo
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at > NOW()
ORDER BY created_at DESC;

-- ============================================
-- PASO 5: Eliminar notificaciones con fechas futuras (estas se "activan" automáticamente)
-- ============================================
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at > NOW();

-- ============================================
-- PASO 6: Verificar cuántas notificaciones quedan después de eliminar futuras
-- ============================================
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);
