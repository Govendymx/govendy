-- Fix digital product orders: set shipping_fee = 0 for all digital product orders
-- This corrects existing orders where shipping was incorrectly charged for digital products

-- Step 1: Update orders that only have digital product items to have shipping_fee = 0
-- We identify digital orders by looking at order_items joined to listings where product_type = 'digital'
UPDATE orders
SET 
  shipping_fee = 0,
  total = subtotal - COALESCE(coupon_discount, 0),
  shipping_carrier = 'digital'
WHERE id IN (
  SELECT DISTINCT oi.order_id
  FROM order_items oi
  JOIN listings l ON l.id = oi.listing_id::uuid
  WHERE l.product_type = 'digital'
) 
AND id NOT IN (
  -- Exclude orders that ALSO have physical items
  SELECT DISTINCT oi.order_id
  FROM order_items oi
  JOIN listings l ON l.id = oi.listing_id::uuid
  WHERE l.product_type != 'digital' OR l.product_type IS NULL
)
AND shipping_fee > 0;

-- Log the fix
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % digital product orders (shipping_fee set to 0)', affected_count;
END $$;
