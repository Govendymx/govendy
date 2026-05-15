-- ============================================================
-- fix_auction_historical_subsidies.sql
-- Corrige órdenes de subastas donde se aplicó doble subsidio.
-- El shipping_price del listing ya incluye el subsidio restado.
-- La orden debe reflejar ese precio directamente como shipping_fee.
-- ============================================================

BEGIN;

WITH corrected AS (
  SELECT
    o.id                         AS order_id,
    o.subtotal,
    o.shipping_fee               AS old_fee,
    o.shipping_subsidy           AS old_subsidy,
    o.total                      AS old_total,
    l.shipping_price             AS correct_fee,   -- precio neto ya con subsidio descontado
    l.shipping_subsidy           AS correct_subsidy
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN listings    l  ON l.id = oi.listing_id
  WHERE l.sale_type = 'auction'
    AND l.shipping_price > 0
    AND l.shipping_subsidy > 0
    -- El fee actual es menor que el precio publicado (evidencia de doble resta)
    AND o.shipping_fee < l.shipping_price
    AND o.status NOT IN ('cancelled', 'refunded')
)
UPDATE orders o
SET
  shipping_fee     = c.correct_fee,
  shipping_subsidy = c.correct_subsidy,
  total            = c.subtotal + c.correct_fee
FROM corrected c
WHERE o.id = c.order_id;

-- Verificar los cambios
SELECT
  o.id,
  l.title,
  o.subtotal,
  o.shipping_fee,
  o.shipping_subsidy,
  o.total,
  o.status
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN listings    l  ON l.id = oi.listing_id
WHERE l.sale_type = 'auction'
  AND l.shipping_subsidy > 0
ORDER BY o.created_at DESC
LIMIT 20;

COMMIT;
