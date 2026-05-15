-- Add custom shipping fields to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS shipping_price numeric DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS shipping_carrier text;
