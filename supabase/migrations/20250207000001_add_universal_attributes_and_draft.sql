-- Add universal attributes
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS country_of_origin TEXT,
ADD COLUMN IF NOT EXISTS warranty TEXT,
ADD COLUMN IF NOT EXISTS main_material TEXT;

-- Handle status enum update for 'draft'
DO $$
BEGIN
  -- Check if listing_status type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'draft';
  END IF;
END $$;
