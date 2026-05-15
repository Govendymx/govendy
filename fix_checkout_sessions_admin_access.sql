-- ============================================================
-- FIX: Permitir que admins actualicen checkout_sessions
-- Ejecuta esto en Supabase SQL Editor
-- ============================================================

-- Verificar políticas actuales de checkout_sessions
SELECT 
  'POLÍTICAS ACTUALES' as tipo,
  policyname,
  cmd as operacion,
  qual as condicion_using,
  with_check as condicion_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'checkout_sessions'
ORDER BY cmd, policyname;

-- Verificar si hay triggers que puedan estar revirtiendo cambios
SELECT 
  'TRIGGERS' as tipo,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'checkout_sessions'
ORDER BY trigger_name;

-- IMPORTANTE: El service_role key debería hacer bypass de RLS automáticamente
-- Pero si hay problemas, podemos crear una política explícita para admins

-- Verificar si existe la tabla admin_users
SELECT 
  'TABLA ADMIN_USERS' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users')
    THEN '✅ Existe'
    ELSE '❌ No existe'
  END as estado;

-- Crear función helper para verificar si un usuario es admin (si no existe)
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar constraints en checkout_sessions que puedan estar bloqueando updates
SELECT 
  'CONSTRAINTS' as tipo,
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
  AND table_name = 'checkout_sessions'
  AND constraint_type IN ('CHECK', 'FOREIGN KEY', 'UNIQUE', 'PRIMARY KEY')
ORDER BY constraint_name;

-- Verificar si hay algún trigger que modifique el status
-- Nota: Esta query puede no devolver resultados si no hay triggers que modifiquen status
SELECT 
  'TRIGGERS QUE MODIFICAN STATUS' as tipo,
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) IS NOT NULL THEN 'Función encontrada'
    ELSE 'No se pudo obtener definición'
  END as function_status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'public.checkout_sessions'::regclass
  AND (pg_get_functiondef(p.oid) ILIKE '%status%' OR p.proname ILIKE '%status%')
ORDER BY t.tgname;

-- Verificar el tipo ENUM checkout_status
SELECT 
  'ENUM CHECKOUT_STATUS' as tipo,
  enumlabel as valor_posible,
  enumsortorder as orden
FROM pg_enum
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'checkout_status'
)
ORDER BY enumsortorder;

-- IMPORTANTE: Si el service_role key está configurado correctamente,
-- debería hacer bypass de RLS automáticamente. Si no funciona, puede ser:
-- 1. La key no está configurada en las variables de entorno
-- 2. La key es incorrecta (es la anon key en lugar de service_role)
-- 3. Hay algún trigger o constraint que está revirtiendo los cambios

-- Para diagnosticar: ejecuta esto después de intentar actualizar un pago
-- y verifica si el status realmente cambió:
-- SELECT id, status, paid_confirmed_at, updated_at 
-- FROM public.checkout_sessions 
-- WHERE id = 'TU_CHECKOUT_ID_AQUI'
-- ORDER BY updated_at DESC;
