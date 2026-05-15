-- Script para verificar si los triggers de notificaciones están instalados
-- Ejecuta esto en Supabase SQL Editor

-- 1. Verificar si existen las funciones
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname IN (
  'notify_seller_on_new_order',
  'notify_seller_on_order_paid'
)
ORDER BY proname;

-- 2. Verificar si existen los triggers
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname IN (
  'trg_notify_seller_on_new_order',
  'trg_notify_seller_on_order_paid'
)
ORDER BY tgname;

-- 3. Verificar notificaciones recientes de compras/ventas
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  is_read,
  created_at,
  data->>'kind' as kind,
  data->>'orderId' as order_id
FROM public.notifications
WHERE 
  (type IN ('new_sale', 'sale_paid', 'payment_approved') 
   OR data->>'kind' IN ('new_sale', 'sale_paid', 'payment_approved'))
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Verificar órdenes recientes
SELECT 
  id,
  buyer_id,
  seller_id,
  status,
  created_at,
  updated_at
FROM public.orders
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Verificar si hay órdenes sin notificaciones correspondientes
SELECT 
  o.id as order_id,
  o.seller_id,
  o.buyer_id,
  o.status,
  o.created_at,
  COUNT(n.id) FILTER (WHERE n.data->>'kind' = 'new_sale' OR n.type = 'new_sale') as new_sale_notifications,
  COUNT(n2.id) FILTER (WHERE (n2.data->>'kind' = 'sale_paid' OR n2.type = 'sale_paid') AND o.status = 'paid') as sale_paid_notifications
FROM public.orders o
LEFT JOIN public.notifications n ON n.user_id = o.seller_id 
  AND (
    n.data->>'orderId' = o.id::text 
    OR (n.data->>'orderId' IS NOT NULL AND (n.data->>'orderId')::uuid = o.id)
  )
LEFT JOIN public.notifications n2 ON n2.user_id = o.seller_id 
  AND (
    n2.data->>'orderId' = o.id::text 
    OR (n2.data->>'orderId' IS NOT NULL AND (n2.data->>'orderId')::uuid = o.id)
  )
WHERE o.created_at > NOW() - INTERVAL '7 days'
GROUP BY o.id, o.seller_id, o.buyer_id, o.status, o.created_at
ORDER BY o.created_at DESC
LIMIT 10;
