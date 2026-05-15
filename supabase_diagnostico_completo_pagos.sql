-- ============================================================
-- DIAGNÓSTICO COMPLETO: Pagos Offline
-- Ejecuta esto para diagnosticar problemas con pagos offline
-- ============================================================

-- 1. Verificar estructura de checkout_sessions
SELECT 
  'ESTRUCTURA CHECKOUT_SESSIONS' as tipo,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'checkout_sessions'
ORDER BY ordinal_position;

-- 2. Contar sesiones offline totales
SELECT 
  'CONTEO SESIONES OFFLINE' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'paid') as paid,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM public.checkout_sessions
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo');

-- 3. Últimas 10 sesiones offline (con detalles)
SELECT 
  'ÚLTIMAS SESIONES OFFLINE' as tipo,
  id,
  payment_method,
  status,
  amount,
  reference_code,
  created_at,
  updated_at,
  array_length(order_ids, 1) as order_ids_count,
  CASE 
    WHEN array_length(order_ids, 1) IS NULL THEN 'Sin order_ids'
    WHEN array_length(order_ids, 1) = 0 THEN 'Array vacío'
    ELSE 'OK'
  END as order_ids_status
FROM public.checkout_sessions
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
ORDER BY created_at DESC
LIMIT 10;

-- 4. Contar órdenes offline
SELECT 
  'CONTEO ÓRDENES OFFLINE' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending_payment') as pending_payment,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'paid') as paid,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
FROM public.orders
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo');

-- 5. Últimas 10 órdenes offline
SELECT 
  'ÚLTIMAS ÓRDENES OFFLINE' as tipo,
  id,
  payment_method,
  status,
  total,
  created_at,
  updated_at
FROM public.orders
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
ORDER BY created_at DESC
LIMIT 10;

-- 6. Órdenes huérfanas (sin sesión) - ÚLTIMAS 24 HORAS
SELECT 
  'ÓRDENES HUÉRFANAS (24H)' as tipo,
  o.id as order_id,
  o.payment_method,
  o.status,
  o.total,
  o.created_at,
  o.updated_at
FROM public.orders o
WHERE o.payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
  AND o.status IN ('pending_payment', 'pending')
  AND o.created_at >= NOW() - INTERVAL '24 hours'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.checkout_sessions cs
    WHERE cs.payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
      AND o.id = ANY(cs.order_ids)
  )
ORDER BY o.created_at DESC
LIMIT 20;

-- 7. Verificar sesiones con order_ids vacíos o NULL
SELECT 
  'SESIONES SIN ORDER_IDS' as tipo,
  id,
  payment_method,
  status,
  amount,
  reference_code,
  created_at,
  CASE 
    WHEN order_ids IS NULL THEN 'NULL'
    WHEN array_length(order_ids, 1) IS NULL THEN 'Array NULL'
    WHEN array_length(order_ids, 1) = 0 THEN 'Array vacío'
    ELSE 'OK'
  END as order_ids_status
FROM public.checkout_sessions
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
  AND (order_ids IS NULL OR array_length(order_ids, 1) IS NULL OR array_length(order_ids, 1) = 0)
ORDER BY created_at DESC
LIMIT 10;

-- 8. Verificar tipo de datos de order_ids
SELECT 
  'TIPO DE DATOS ORDER_IDS' as tipo,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'checkout_sessions'
  AND column_name = 'order_ids';

-- 9. Verificar ENUM checkout_status
SELECT 
  'ENUM CHECKOUT_STATUS' as tipo,
  enumlabel as valor_posible,
  enumsortorder as orden
FROM pg_enum
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'checkout_status'
)
ORDER BY enumsortorder;

-- 10. Resumen final
SELECT 
  'RESUMEN FINAL' as tipo,
  (SELECT COUNT(*) FROM public.checkout_sessions WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')) as sesiones_offline,
  (SELECT COUNT(*) FROM public.orders WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')) as ordenes_offline,
  (SELECT COUNT(*) FROM public.orders o 
   WHERE o.payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
     AND o.status IN ('pending_payment', 'pending')
     AND o.created_at >= NOW() - INTERVAL '24 hours'
     AND NOT EXISTS (
       SELECT 1 FROM public.checkout_sessions cs
       WHERE cs.payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
         AND o.id = ANY(cs.order_ids)
   )) as ordenes_huerfanas_24h;
