-- ============================================================
-- VERIFICACIÓN: Pagos Offline
-- Ejecuta esto para verificar que el esquema está correcto
-- ============================================================

-- 1. Verificar columnas en checkout_sessions
SELECT 
  'CHECKOUT_SESSIONS COLUMNS' as tipo,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'checkout_sessions'
  AND column_name IN (
    'id', 'buyer_id', 'order_ids', 'payment_method', 'status', 
    'amount', 'reference_code', 'offline_instructions', 
    'created_at', 'payment_proof_url', 'payment_proof_uploaded_at',
    'paid_confirmed_at', 'paid_confirmed_by', 'paid_confirmed_by_name'
  )
ORDER BY column_name;

-- 2. Verificar que existen sesiones offline
SELECT 
  'SESIONES OFFLINE EXISTENTES' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'paid') as paid,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
FROM public.checkout_sessions
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo');

-- 3. Mostrar últimas 5 sesiones offline
SELECT 
  'ÚLTIMAS SESIONES OFFLINE' as tipo,
  id,
  payment_method,
  status,
  amount,
  reference_code,
  created_at,
  array_length(order_ids, 1) as order_ids_count
FROM public.checkout_sessions
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
ORDER BY created_at DESC
LIMIT 5;

-- 4. Verificar órdenes con payment_method offline
SELECT 
  'ÓRDENES OFFLINE' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'pending_payment') as pending_payment,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'paid') as paid
FROM public.orders
WHERE payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo');

-- 5. Verificar órdenes offline que NO están en ninguna sesión
SELECT 
  'ÓRDENES HUÉRFANAS' as tipo,
  o.id as order_id,
  o.payment_method,
  o.status,
  o.total,
  o.created_at
FROM public.orders o
WHERE o.payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
  AND o.status IN ('pending_payment', 'pending')
  AND NOT EXISTS (
    SELECT 1 
    FROM public.checkout_sessions cs
    WHERE cs.payment_method IN ('bank_transfer', 'bank_deposit', 'oxxo')
      AND o.id = ANY(cs.order_ids)
  )
ORDER BY o.created_at DESC
LIMIT 10;

-- 6. Verificar que las columnas opcionales existen (si no, se crearán automáticamente)
SELECT 
  'COLUMNAS OPCIONALES' as tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'checkout_sessions' 
      AND column_name = 'paid_confirmed_by_name'
    ) THEN '✅ paid_confirmed_by_name existe'
    ELSE '❌ paid_confirmed_by_name NO existe (se creará automáticamente)'
  END as estado;
