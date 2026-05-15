-- ==================================================================
-- FIX: Add digital product columns to listings table
-- and fix existing "Licencia Adobe CREATIVE CLOUD" listing
-- ==================================================================
-- SAFE TO RUN MULTIPLE TIMES (uses IF NOT EXISTS)
-- ==================================================================

-- 1. Add product_type column (default 'physical' for existing listings)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'physical';

-- 2. Add digital_delivery_type column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS digital_delivery_type TEXT;

-- 3. Add digital_delivery_fields column (JSONB array of {label: string})
ALTER TABLE listings ADD COLUMN IF NOT EXISTS digital_delivery_fields JSONB;

-- 4. Fix the existing listing for "Licencia Adobe CREATIVE CLOUD"
-- First, find and update the listing linked to order 7a4c89e9-0f81-4687-907b-8ea91ec1929f
UPDATE listings
SET product_type = 'digital',
    digital_delivery_type = 'manual',
    digital_delivery_fields = '[{"label": "Serial"}]'::jsonb,
    free_shipping = true,
    shipping_by_seller = false,
    allow_personal_delivery = false,
    weight_kg = 0,
    length_cm = 0,
    width_cm = 0,
    height_cm = 0,
    handling_days = 0,
    shipping_subsidy = 0
WHERE id IN (
    SELECT listing_id FROM order_items WHERE order_id = '7a4c89e9-0f81-4687-907b-8ea91ec1929f'
);

-- 5. Verify
SELECT id, title, product_type, digital_delivery_type, digital_delivery_fields
FROM listings
WHERE id IN (
    SELECT listing_id FROM order_items WHERE order_id = '7a4c89e9-0f81-4687-907b-8ea91ec1929f'
);
