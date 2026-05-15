-- ============================================================
-- Fix commission_fee to include centavos (2 decimal places)
-- Applies to ALL orders, old and new
-- ============================================================

DO $$
DECLARE
  basic_rate  numeric := 23;
  pro_rate    numeric := 18;
  plat_rate   numeric := 18;
  updated_count integer;
BEGIN
  -- 1. Load configured rates from app_settings (if available)
  BEGIN
    SELECT
      COALESCE(commission_basic_percent,   23),
      COALESCE(commission_pro_percent,     18),
      COALESCE(commission_platinum_percent,18)
    INTO basic_rate, pro_rate, plat_rate
    FROM app_settings
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Table or column might not exist yet; keep defaults
    NULL;
  END;

  RAISE NOTICE 'Using rates → basic: %, pro: %, platinum: %', basic_rate, pro_rate, plat_rate;

  -- 2. Recalculate commission_fee with 2 decimal places for EVERY order
  --    that has a positive subtotal.  Uses the seller's CURRENT plan rate.
  --    (This corrects both integer-only commissions AND floating-point noise.)
  UPDATE orders o
  SET commission_fee = ROUND(
    CAST(o.subtotal AS numeric) *
    CASE
      WHEN p.plan_type = 'platinum' THEN plat_rate
      WHEN p.plan_type = 'pro'      THEN pro_rate
      ELSE                               basic_rate
    END / 100,
    2   -- centavos
  )
  FROM profiles p
  WHERE o.seller_id = p.id
    AND o.subtotal  > 0
    AND o.commission_fee > 0;   -- skip free / already-zero orders

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated commission_fee for % orders', updated_count;

  -- 3. For orders where seller profile is missing (edge case), just round
  --    whatever is stored to 2 decimal places.
  UPDATE orders
  SET commission_fee = ROUND(CAST(commission_fee AS numeric), 2)
  WHERE commission_fee > 0
    AND commission_fee != ROUND(CAST(commission_fee AS numeric), 2)
    AND seller_id NOT IN (SELECT id FROM profiles WHERE id IS NOT NULL);

END $$;
