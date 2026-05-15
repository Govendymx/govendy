-- Script para crear notificaciones faltantes para órdenes existentes
-- Este script crea notificaciones para órdenes que no las tienen

-- 1. Crear notificaciones de "new_sale" para órdenes que no las tienen
INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
SELECT 
  o.seller_id,
  'new_sale',
  'Tienes una venta',
  'Recibiste una compra. Orden: ' || left(o.id::text, 8) || '…',
  jsonb_build_object(
    'kind', 'new_sale',
    'orderId', o.id,
    'status', o.status::text
  ),
  false
FROM public.orders o
WHERE o.created_at > NOW() - INTERVAL '30 days'
  AND o.seller_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.notifications n 
    WHERE n.user_id = o.seller_id 
      AND (
        (n.data->>'orderId' = o.id::text)
        OR (n.data->>'orderId' IS NOT NULL AND (n.data->>'orderId')::uuid = o.id)
      )
      AND (
        n.type = 'new_sale' 
        OR n.data->>'kind' = 'new_sale'
      )
  )
ON CONFLICT DO NOTHING;

-- 2. Crear notificaciones de "sale_paid" para órdenes pagadas que no las tienen
INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
SELECT 
  o.seller_id,
  'sale_paid',
  'Pago acreditado',
  'Se acreditó el pago de una compra. Orden: ' || left(o.id::text, 8) || '…',
  jsonb_build_object(
    'kind', 'sale_paid',
    'orderId', o.id,
    'status', o.status::text
  ),
  false
FROM public.orders o
WHERE o.status = 'paid'
  AND o.created_at > NOW() - INTERVAL '30 days'
  AND o.seller_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.notifications n 
    WHERE n.user_id = o.seller_id 
      AND (
        (n.data->>'orderId' = o.id::text)
        OR (n.data->>'orderId' IS NOT NULL AND (n.data->>'orderId')::uuid = o.id)
      )
      AND (
        n.type = 'sale_paid' 
        OR n.data->>'kind' = 'sale_paid'
      )
  )
ON CONFLICT DO NOTHING;

-- 3. Crear notificaciones de "payment_approved" para compradores de órdenes pagadas
INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
SELECT 
  o.buyer_id,
  'payment_approved',
  '¡Pago acreditado!',
  'Tu pago fue acreditado exitosamente. Orden: ' || left(o.id::text, 8) || '…',
  jsonb_build_object(
    'kind', 'payment_approved',
    'orderId', o.id,
    'status', o.status::text
  ),
  false
FROM public.orders o
WHERE o.status = 'paid'
  AND o.created_at > NOW() - INTERVAL '30 days'
  AND o.buyer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.notifications n 
    WHERE n.user_id = o.buyer_id 
      AND (
        (n.data->>'orderId' = o.id::text)
        OR (n.data->>'orderId' IS NOT NULL AND (n.data->>'orderId')::uuid = o.id)
      )
      AND (
        n.type = 'payment_approved' 
        OR n.data->>'kind' = 'payment_approved'
      )
  )
ON CONFLICT DO NOTHING;

-- 4. Verificar cuántas notificaciones se crearon
SELECT 
  'new_sale' as tipo,
  COUNT(*) as creadas
FROM public.notifications
WHERE created_at > NOW() - INTERVAL '1 minute'
  AND (type = 'new_sale' OR data->>'kind' = 'new_sale')
UNION ALL
SELECT 
  'sale_paid' as tipo,
  COUNT(*) as creadas
FROM public.notifications
WHERE created_at > NOW() - INTERVAL '1 minute'
  AND (type = 'sale_paid' OR data->>'kind' = 'sale_paid')
UNION ALL
SELECT 
  'payment_approved' as tipo,
  COUNT(*) as creadas
FROM public.notifications
WHERE created_at > NOW() - INTERVAL '1 minute'
  AND (type = 'payment_approved' OR data->>'kind' = 'payment_approved');
