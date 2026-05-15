-- ==================================================================
-- GoPocket: Unified Schema Verification & Migration Script
-- ==================================================================
-- This script ensures all required tables, enums, and columns exist.
-- It uses IF NOT EXISTS / DO blocks so it's SAFE to run multiple times.
-- Run this after deployments or when things seem "desconfigured".
-- ==================================================================

-- ==========================================
-- 1. ENUMS
-- ==========================================

-- wallet_reference_type (needed for gift cards, topups, payouts, etc.)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_reference_type') THEN
        CREATE TYPE wallet_reference_type AS ENUM ('order', 'gift_card', 'payout', 'topup', 'deposit', 'refund', 'adjustment');
    ELSE
        -- Add missing enum values
        BEGIN ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'gift_card'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'payout'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'topup'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'deposit'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'refund'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        BEGIN ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'adjustment'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END IF;
END$$;

-- ==========================================
-- 2. CORE TABLES
-- ==========================================

-- admin_users: Who is an admin
CREATE TABLE IF NOT EXISTS admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- profiles: Basic user profiles
-- (Assuming this already exists from Supabase auth setup)

-- wallets: User PocketCash balances
CREATE TABLE IF NOT EXISTS wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    balance NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- wallet_transactions: Ledger of all wallet movements
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    reference_type TEXT,
    reference_id TEXT,
    description TEXT,
    balance_after NUMERIC(12, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. GIFT CARDS
-- ==========================================

CREATE TABLE IF NOT EXISTS gift_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'pending_payment', 'cancelled', 'expired')),
    purchased_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_email TEXT,
    message TEXT,
    payment_method TEXT,
    payment_reference TEXT,
    for_self BOOLEAN DEFAULT FALSE,
    template TEXT DEFAULT 'general',
    redeemed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_purchased_by ON gift_cards(purchased_by);
CREATE INDEX IF NOT EXISTS idx_gift_cards_redeemed_by ON gift_cards(redeemed_by);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);

-- ==========================================
-- 4. REVIEWS
-- ==========================================

CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

-- ==========================================
-- 5. COUPONS
-- ==========================================

CREATE TABLE IF NOT EXISTS coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL,
    min_purchase NUMERIC(10, 2) DEFAULT 0,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. NOTIFICATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(user_id, created_at DESC);

-- ==========================================
-- 7. GOPOCKET LIVE (Platinum exclusive)
-- ==========================================

CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
    viewer_count INTEGER DEFAULT 0,
    product_ids UUID[],
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_host ON live_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);

CREATE TABLE IF NOT EXISTS live_chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_chat_session ON live_chat_messages(session_id, created_at);

-- ==========================================
-- 8. LISTING REPORTS (Moderation system)
-- ==========================================

CREATE TABLE IF NOT EXISTS listing_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    comment TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'ignored')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_reports_listing ON listing_reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_reports_status ON listing_reports(status);

ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'listing_reports' AND policyname = 'Users can report listings') THEN
        CREATE POLICY "Users can report listings" ON listing_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
    END IF;
END$$;

-- Users can see their own reports
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'listing_reports' AND policyname = 'Users see own reports') THEN
        CREATE POLICY "Users see own reports" ON listing_reports FOR SELECT USING (auth.uid() = reporter_id);
    END IF;
END$$;

-- Admins can do everything (handled by service role or specific policy if needed)
-- For now, relying on service role for admin side.

-- ==========================================
-- 9. SCHEMA PATCHES (Ensure critical relationships)
-- ==========================================

-- Ensure listings table has the correct foreign key for seller_id to profiles(id)
-- This is critical for PostgREST joins like .select('*, seller:seller_id(*)')
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'listings') THEN
        -- Check if any FK exists for seller_id
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint con 
            JOIN pg_class rel ON rel.oid = con.conrelid 
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public' 
            AND rel.relname = 'listings' 
            AND con.contype = 'f'
            AND ARRAY['seller_id']::text[] <@ (
                SELECT array_agg(attname)::text[] 
                FROM pg_attribute 
                WHERE attrelid = rel.oid AND attnum = ANY(con.conkey)
            )
        ) THEN
            -- Attempt to add the FK. We use profiles(id) as the target.
            -- If user_id is the column name in profiles, use that. (Usually id)
            ALTER TABLE listings ADD CONSTRAINT listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END$$;

-- Ensure listings(user_id) also has a FK if it exists (some parts of the app use user_id)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'user_id') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint con 
            JOIN pg_class rel ON rel.oid = con.conrelid 
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public' 
            AND rel.relname = 'listings' 
            AND con.contype = 'f'
            AND ARRAY['user_id']::text[] <@ (
                SELECT array_agg(attname)::text[] 
                FROM pg_attribute 
                WHERE attrelid = rel.oid AND attnum = ANY(con.conkey)
            )
        ) THEN
            ALTER TABLE listings ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END$$;

-- ==========================================
-- 10. RLS POLICIES (Idempotent)
-- ==========================================

-- Enable RLS on key tables (safe to call multiple times)
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;

-- Wallet: users can only see their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'Users see own wallet') THEN
        CREATE POLICY "Users see own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
    END IF;
END$$;

-- Gift Cards: users can see cards they purchased or redeemed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_cards' AND policyname = 'Users see own gift cards') THEN
        CREATE POLICY "Users see own gift cards" ON gift_cards FOR SELECT USING (auth.uid() = purchased_by OR auth.uid() = redeemed_by);
    END IF;
END$$;

-- Notifications: users can only see their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users see own notifications') THEN
        CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
    END IF;
END$$;

-- Live sessions: anyone can read, hosts can insert/update their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'Anyone can view live sessions') THEN
        CREATE POLICY "Anyone can view live sessions" ON live_sessions FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_sessions' AND policyname = 'Hosts manage own sessions') THEN
        CREATE POLICY "Hosts manage own sessions" ON live_sessions FOR ALL USING (auth.uid() = host_id);
    END IF;
END$$;

-- Live chat: anyone can read, logged-in users can post
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_chat_messages' AND policyname = 'Anyone can view chat') THEN
        CREATE POLICY "Anyone can view chat" ON live_chat_messages FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_chat_messages' AND policyname = 'Users can post chat') THEN
        CREATE POLICY "Users can post chat" ON live_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END$$;

-- ==========================================
-- 9. VERIFICATION QUERY
-- ==========================================
-- Run this at the end to confirm everything exists:

SELECT 'Tables:' as section;
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('admin_users', 'wallets', 'wallet_transactions', 'gift_cards', 'reviews', 'coupons', 'notifications', 'live_sessions', 'live_chat_messages')
ORDER BY tablename;

SELECT 'Enum values for wallet_reference_type:' as section;
SELECT unnest(enum_range(NULL::wallet_reference_type)) as value;

-- Done! All schema objects verified.

-- ==========================================
-- TABLA: product_reviews
-- Opiniones/reseñas de productos por compradores verificados
-- ==========================================
CREATE TABLE IF NOT EXISTS product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title TEXT,
    content TEXT,
    images TEXT[] DEFAULT '{}',
    feature_ratings JSONB DEFAULT '{}',
    helpful_count INTEGER DEFAULT 0,
    is_verified_purchase BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'flagged')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(listing_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_product_reviews_listing ON product_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON product_reviews(listing_id, status);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(listing_id, rating);

-- RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Política: cualquiera puede leer reseñas activas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='product_reviews' AND policyname='reviews_select_public'
  ) THEN
    CREATE POLICY reviews_select_public ON product_reviews
      FOR SELECT USING (status = 'active');
  END IF;
END $$;

-- Política: usuario autenticado puede insertar su propia reseña
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='product_reviews' AND policyname='reviews_insert_own'
  ) THEN
    CREATE POLICY reviews_insert_own ON product_reviews
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Política: usuario puede actualizar su propia reseña
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='product_reviews' AND policyname='reviews_update_own'
  ) THEN
    CREATE POLICY reviews_update_own ON product_reviews
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_product_reviews'
  ) THEN
    CREATE TRIGGER set_updated_at_product_reviews
      BEFORE UPDATE ON product_reviews
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- ==========================================
-- TABLA: follows (seguimiento de vendedores por usuarios)
-- ==========================================
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (follower_id, seller_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_seller ON follows(seller_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='follows' AND policyname='Anyone can view follows') THEN
    DROP POLICY "Anyone can view follows" ON follows;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='follows' AND policyname='Users can follow') THEN
    DROP POLICY "Users can follow" ON follows;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='follows' AND policyname='Users can unfollow') THEN
    DROP POLICY "Users can unfollow" ON follows;
  END IF;
END $$;

CREATE POLICY "Anyone can view follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- ==========================================
-- 10. SEARCH LISTINGS RPC (Filtering)
-- ==========================================
DROP FUNCTION IF EXISTS search_listings(text, text[], text[], text[], text[], numeric, numeric, text, integer, integer);

CREATE OR REPLACE FUNCTION search_listings(
  search_query text DEFAULT NULL,
  tags_filter text[] DEFAULT NULL,
  genders_filter text[] DEFAULT NULL,
  categories_filter text[] DEFAULT NULL,
  subcategories_filter text[] DEFAULT NULL,
  min_price numeric DEFAULT NULL,
  max_price numeric DEFAULT NULL,
  sort_by text DEFAULT 'date_desc',
  page int DEFAULT 1,
  page_size int DEFAULT 24
)
RETURNS TABLE (
  id uuid,
  public_id text,
  title text,
  description text,
  price numeric,
  currency text,
  images text[],
  status text,
  seller_id uuid,
  created_at timestamptz,
  condition text,
  free_shipping boolean,
  shipping_by_seller boolean,
  gender text,
  category text,
  subcategory text,
  tags text[],
  size text,
  product_type text,
  seller jsonb,
  total_count bigint
) AS $$
DECLARE
  offset_val int;
BEGIN
  offset_val := (page - 1) * page_size;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      l.id, l.public_id, l.title, l.description, l.price, l.currency, l.images, l.status, l.seller_id, l.created_at, l.condition, l.free_shipping, l.shipping_by_seller, l.gender, l.category, l.subcategory, l.tags, l.size, l.product_type,
      to_jsonb(p) as seller_data
    FROM listings l
    JOIN profiles p ON l.seller_id = p.id
    WHERE l.status = 'active'
    AND (search_query IS NULL OR l.title ILIKE '%' || search_query || '%' OR l.public_id ILIKE '%' || search_query || '%')
    AND (tags_filter IS NULL OR l.tags @> tags_filter)
    AND (genders_filter IS NULL OR l.gender = ANY(genders_filter))
    AND (categories_filter IS NULL OR l.category = ANY(categories_filter))
    AND (subcategories_filter IS NULL OR l.subcategory = ANY(subcategories_filter))
    -- Niños logic: Exclude if gender is Niños/Niñas AND size criteria met
    AND NOT (
       (genders_filter IS NOT NULL AND ('Niños' = ANY(genders_filter) OR 'Niñas' = ANY(genders_filter)))
       AND (
         (l.category ~* 'zapato|calzado|tenis|bota|sandalia' AND l.size ~ '^[0-9.]+$' AND l.size::numeric > 25)
         OR
         (l.category !~* 'zapato|calzado|tenis|bota|sandalia' AND l.size ~ '^[0-9.]+$' AND l.size::numeric > 16)
       )
    )
  ),
  total AS (
    SELECT count(*) as cnt FROM filtered
  )
  SELECT
    f.id, f.public_id, f.title, f.description, f.price, f.currency, f.images, f.status, f.seller_id, f.created_at, f.condition, f.free_shipping, f.shipping_by_seller, f.gender, f.category, f.subcategory, f.tags, f.size, f.product_type,
    f.seller_data as seller,
    t.cnt
  FROM filtered f
  CROSS JOIN total t
  ORDER BY
    CASE WHEN sort_by = 'price_asc' THEN f.price END ASC,
    CASE WHEN sort_by = 'price_desc' THEN f.price END DESC,
    CASE WHEN sort_by = 'date_asc' THEN f.created_at END ASC,
    CASE WHEN sort_by = 'date_desc' THEN f.created_at END DESC,
    f.created_at DESC -- Default tie breaker
  LIMIT page_size OFFSET offset_val;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MIGRATION: Fix NULL product_type for legacy listings
-- Sets 'physical' as default for any listings created before
-- the product_type column existed. Safe to run multiple times.
-- Run this in your Supabase SQL editor after deploying.
-- ============================================================
ALTER TABLE listings
  ALTER COLUMN product_type SET DEFAULT 'physical';

UPDATE listings
SET product_type = 'physical'
WHERE product_type IS NULL;
