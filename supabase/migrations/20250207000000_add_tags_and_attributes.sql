ALTER TABLE listings ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS subcategory text DEFAULT NULL;

-- Index for tags to make search faster
CREATE INDEX IF NOT EXISTS idx_listings_tags ON listings USING GIN (tags);
