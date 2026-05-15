-- Create follows table for user-seller following system
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, seller_id)
);

-- Indices for efficient lookups
CREATE INDEX IF NOT EXISTS idx_follows_seller ON follows(seller_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);

-- RLS policies
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Drop existing policies if they exist, then recreate
  DROP POLICY IF EXISTS "Anyone can view follows" ON follows;
  DROP POLICY IF EXISTS "Users can follow" ON follows;
  DROP POLICY IF EXISTS "Users can unfollow" ON follows;
END $$;

CREATE POLICY "Anyone can view follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);
