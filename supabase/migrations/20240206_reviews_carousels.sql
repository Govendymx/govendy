-- Product Reviews System Tables

-- 1. Product Reviews
-- Stores the main review data linked to a listing and a user.
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5.0),
  title TEXT,
  content TEXT,
  images TEXT[], -- URLs of uploaded images
  feature_ratings JSONB DEFAULT '{}'::jsonb, -- e.g. {"calidad": 5, "precio": 4}
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_reviews_listing_id ON product_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON product_reviews(created_at DESC);

-- 2. Product Review Votes
-- Stores helpful/unhelpful votes to prevent duplicates.
CREATE TABLE IF NOT EXISTS product_review_votes (
  review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type INTEGER NOT NULL CHECK (vote_type IN (1, -1)), -- 1 = helpful, -1 = not helpful
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (review_id, user_id)
);

-- 3. RLS Policies (Row Level Security)
-- Enable RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_review_votes ENABLE ROW LEVEL SECURITY;

-- Policies for product_reviews
-- Everyone can view active reviews
CREATE POLICY "Reviews are visible to everyone" ON product_reviews
  FOR SELECT USING (status = 'active');

-- Authenticated users can create reviews
CREATE POLICY "Users can create reviews" ON product_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON product_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for product_review_votes
-- Everyone can view votes (aggregated) or check their own
CREATE POLICY "Votes are visible to everyone" ON product_review_votes
  FOR SELECT USING (true);

-- Authenticated users can vote
CREATE POLICY "Users can vote" ON product_review_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can change their vote
CREATE POLICY "Users can update own vote" ON product_review_votes
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can remove their vote
CREATE POLICY "Users can delete own vote" ON product_review_votes
  FOR DELETE USING (auth.uid() = user_id);
