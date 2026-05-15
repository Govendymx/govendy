-- Add T1-related columns to orders table for automatic label generation
ALTER TABLE orders ADD COLUMN IF NOT EXISTS t1_quote_token text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_label_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number text;
