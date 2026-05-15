-- Add handling_days to listings
ALTER TABLE listings 
ADD COLUMN handling_days INTEGER DEFAULT 0;

-- Add delivery_proof_downloaded_at to orders
ALTER TABLE orders 
ADD COLUMN delivery_proof_downloaded_at TIMESTAMPTZ;
