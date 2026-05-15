-- Add youtube_url column to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS youtube_url TEXT;
