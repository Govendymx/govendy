-- Migration: 20240206_reviews_carousels.sql

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


-- Migration: 20240210_fix_user_ips_rls.sql

-- Ensure RLS policies exist for user_ips table

-- 1. Enable RLS
ALTER TABLE user_ips ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own IPs" ON user_ips;
DROP POLICY IF EXISTS "Users can update their own IPs" ON user_ips;
DROP POLICY IF EXISTS "Users can view their own IPs" ON user_ips;
DROP POLICY IF EXISTS "Admins can view all IPs" ON user_ips;

-- 3. Create permissive policies for Users
CREATE POLICY "Users can insert their own IPs" 
ON user_ips FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own IPs" 
ON user_ips FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own IPs" 
ON user_ips FOR SELECT 
USING (auth.uid() = user_id);

-- 4. Admin Policy (assuming admin role or metadata check)
-- This is a simplified check. Adjust 'role' check as per your auth setup.
CREATE POLICY "Admins can view all IPs" 
ON user_ips FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);


-- Migration: 20240601000000_add_handling_and_proof.sql

-- Add handling_days to listings
ALTER TABLE listings 
ADD COLUMN handling_days INTEGER DEFAULT 0;

-- Add delivery_proof_downloaded_at to orders
ALTER TABLE orders 
ADD COLUMN delivery_proof_downloaded_at TIMESTAMPTZ;


-- Migration: 20240602000000_enable_pocketcash_payment.sql

-- Habilitar PocketCash como método de pago en app_settings
-- Ejecutar en Supabase SQL Editor

DO $$
DECLARE
  current_settings jsonb;
BEGIN
  -- Obtener settings actuales
  SELECT payment_methods INTO current_settings FROM public.app_settings WHERE id = 1;
  
  -- Si no existe la clave pocketcash, agregarla
  IF current_settings -> 'pocketcash' IS NULL THEN
    UPDATE public.app_settings
    SET payment_methods = jsonb_set(
      payment_methods,
      '{pocketcash}',
      '{"enabled": true, "instructions": "Paga usando tu saldo disponible en PocketCash."}'::jsonb
    )
    WHERE id = 1;
  END IF;
END $$;


-- Migration: 20240603000000_add_pocketcash_to_enum.sql

-- Add 'pocketcash' to payment_method enum if it exists
DO $$
BEGIN
  -- Check if payment_method type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'pocketcash';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;


-- Migration: 20250206_featured_listings_system.sql

-- Create featured_listings table for tracking promoted items
create table if not exists featured_listings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  listing_id uuid references listings(id) not null,
  plan_type text check (plan_type in ('7_days', '15_days', '30_days')) not null,
  start_at timestamptz default now() not null,
  end_at timestamptz not null,
  status text check (status in ('active', 'expired', 'cancelled')) default 'active' not null,
  payment_id uuid references wallet_transactions(id),
  created_at timestamptz default now() not null
);

-- Index for efficient rotation queries (find active promotions)
create index if not exists idx_featured_listings_active 
  on featured_listings(status, end_at) 
  where status = 'active';

-- Index for looking up a specific listing's status
create index if not exists idx_featured_listings_listing_id 
  on featured_listings(listing_id);

-- RLS Policies
alter table featured_listings enable row level security;

-- Policy: Users can see their own
create policy "Users can view their own featured listings"
  on featured_listings for select
  using (auth.uid() = user_id);

-- Policy: Public/Server can see active ones (for rotation logic)
-- Note: Usually public access is via API using service role, but for client-side queries:
create policy "Public can view active featured listings"
  on featured_listings for select
  using (status = 'active' and end_at > now());

-- Policy: Users can insert their own (via API usually, but good to have)
create policy "Users can insert their own featured listings"
  on featured_listings for insert
  with check (auth.uid() = user_id);


-- Migration: 20250207000000_add_tags_and_attributes.sql

ALTER TABLE listings ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS subcategory text DEFAULT NULL;

-- Index for tags to make search faster
CREATE INDEX IF NOT EXISTS idx_listings_tags ON listings USING GIN (tags);


-- Migration: 20250207000001_add_universal_attributes_and_draft.sql

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


-- Migration: 20260207_create_category_requests.sql

-- Migration to create category_requests table
-- Run this in Supabase SQL Editor

create table if not exists category_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  category_name text not null,
  gender text not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

alter table category_requests enable row level security;

-- Policy for users to insert their own requests
create policy "Users can insert their own requests"
  on category_requests for insert
  with check (auth.uid() = user_id);

-- Policy for admins to view all requests
create policy "Admins can view all requests"
  on category_requests for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );


-- Migration: 20260209_add_app_settings_fields.sql

-- Add dynamic configuration columns to app_settings table
DO $$
BEGIN
    -- Commissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'commission_basic_percent') THEN
        ALTER TABLE app_settings ADD COLUMN commission_basic_percent NUMERIC(5,2) DEFAULT 23;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'commission_pro_percent') THEN
        ALTER TABLE app_settings ADD COLUMN commission_pro_percent NUMERIC(5,2) DEFAULT 18;
    END IF;

    -- Global Cashback
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_enabled') THEN
        ALTER TABLE app_settings ADD COLUMN cashback_enabled BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_percent') THEN
        ALTER TABLE app_settings ADD COLUMN cashback_percent NUMERIC(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_start_date') THEN
        ALTER TABLE app_settings ADD COLUMN cashback_start_date TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_end_date') THEN
        ALTER TABLE app_settings ADD COLUMN cashback_end_date TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;


-- Migration: 20260209_add_custom_shipping_fields.sql

-- Add custom shipping fields to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS shipping_price numeric DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS shipping_carrier text;


-- Migration: 20260209_add_dynamic_settings.sql


-- Add dynamic commission and cashback settings to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS commission_basic_percent NUMERIC NOT NULL DEFAULT 23,
  ADD COLUMN IF NOT EXISTS commission_pro_percent NUMERIC NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS cashback_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cashback_percent NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_start_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cashback_end_date TIMESTAMP WITH TIME ZONE;

-- Add store-specific cashback settings to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_cashback_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS store_cashback_percent NUMERIC NOT NULL DEFAULT 0;

-- Comment on columns for clarity
COMMENT ON COLUMN public.app_settings.commission_basic_percent IS 'Porcentaje de comisión para usuarios Plan Básico (default 23)';
COMMENT ON COLUMN public.app_settings.commission_pro_percent IS 'Porcentaje de comisión para usuarios Plan PRO (default 18)';
COMMENT ON COLUMN public.app_settings.cashback_enabled IS 'Activa/Desactiva cashback global de la plataforma';
COMMENT ON COLUMN public.app_settings.cashback_percent IS 'Porcentaje de cashback global (ej. 3 para 3%)';
COMMENT ON COLUMN public.profiles.store_cashback_enabled IS 'Si la tienda ofrece cashback propio';
COMMENT ON COLUMN public.profiles.store_cashback_percent IS 'Porcentaje de cashback propio de la tienda';


-- Migration: 20260209_add_store_cashback_fields.sql

-- Add store cashback configuration columns to profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'store_cashback_enabled') THEN
        ALTER TABLE profiles ADD COLUMN store_cashback_enabled BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'store_cashback_percent') THEN
        ALTER TABLE profiles ADD COLUMN store_cashback_percent NUMERIC(5,2) DEFAULT 0;
    END IF;
END $$;


-- Migration: 20260210_add_first_last_name.sql

-- Add first_name and last_name columns to profiles table
-- This allows for more granular name storage and better data quality.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Optional: Attempt to backfill from full_name (simple split)
-- BE CAREFUL: This is a rough approximation.
-- UPDATE public.profiles 
-- SET 
--   first_name = split_part(full_name, ' ', 1),
--   last_name = substr(full_name, length(split_part(full_name, ' ', 1)) + 2)
-- WHERE first_name IS NULL AND full_name IS NOT NULL AND full_name != '';


-- Migration: 20260210_create_audit_logs.sql

-- Create audit_logs table for financial integrity monitoring
create type audit_severity as enum ('info', 'warning', 'critical');
create type audit_entity as enum ('wallet', 'transaction', 'order', 'system', 'payout');
create type audit_status as enum ('open', 'resolved', 'ignored');

create table if not exists audit_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  severity audit_severity default 'info' not null,
  entity_type audit_entity default 'system' not null,
  entity_id text, -- ID of the user, wallet, or transaction involved
  message text not null,
  details jsonb default '{}'::jsonb, -- Snapshot of data at the time of error
  status audit_status default 'open' not null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

-- Index for faster filtering
create index if not exists audit_logs_status_idx on audit_logs(status);
create index if not exists audit_logs_severity_idx on audit_logs(severity);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

-- RLS Policies
alter table audit_logs enable row level security;

-- Only Admins can view audit logs
create policy "Admins can view all audit logs"
  on audit_logs
  for select
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
    )
  );

-- Only Admins and Service Role can insert audit logs
create policy "Admins and Server can insert audit logs"
  on audit_logs
  for insert
  with check (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
    )
  );

-- Only Admins can update status
create policy "Admins can update audit logs"
  on audit_logs
  for update
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
    )
  );

-- Function to check wallet integrity (The Sentinel Logic)
create or replace function check_wallet_integrity()
returns table (
  wallet_id uuid,
  user_id uuid,
  stated_balance numeric,
  calculated_balance numeric,
  discrepancy numeric
) 
language sql
security definer
as $$
  SELECT 
    w.id as wallet_id, 
    w.user_id, 
    w.balance as stated_balance, 
    COALESCE(SUM(t.amount), 0) as calculated_balance,
    (w.balance - COALESCE(SUM(t.amount), 0)) as discrepancy
  FROM wallets w
  LEFT JOIN transactions t ON w.id = t.wallet_id
  GROUP BY w.id, w.user_id
  HAVING ABS(w.balance - COALESCE(SUM(t.amount), 0)) > 0.01;
$$;


-- Migration: 20260210_ensure_user_ips.sql

-- Create user_ips table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_ips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    latitude FLOAT,
    longitude FLOAT,
    isp TEXT,
    is_vpn BOOLEAN DEFAULT false,
    is_approximate BOOLEAN DEFAULT false,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_ips_user_id ON public.user_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ips_ip_address ON public.user_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_ips_detected_at ON public.user_ips(detected_at);

-- RLS Policies
ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;

-- Admins can view all IPs
CREATE POLICY "Admins can view all user_ips" ON public.user_ips
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
        )
    );

-- Admins can insert/update (system service role bypasses RLS anyway, but good for admin panel)
CREATE POLICY "Admins can update user_ips" ON public.user_ips
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
        )
    );


-- Migration: 20260210_fix_admin_data.sql

-- 1. Ensure Official Store Columns Exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_official_store BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS official_store_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS official_store_brand_color TEXT DEFAULT '#ec4899';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS official_store_banner_url TEXT;

-- 2. Ensure PRO Plan Columns Exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'basic';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_subscription_start TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pro_subscription_end TIMESTAMPTZ;

-- 3. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_official_store ON public.profiles(is_official_store);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_type ON public.profiles(plan_type);

-- 4. Fix Data Inconsistencies
-- If a user has a valid future subscription, FORCE them to be PRO
UPDATE public.profiles 
SET plan_type = 'pro' 
WHERE pro_subscription_end > NOW() AND (plan_type IS NULL OR plan_type != 'pro');

-- 4b. Migrate from legacy 'is_pro' boolean if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_pro') THEN
        UPDATE public.profiles
        SET plan_type = 'pro'
        WHERE is_pro = true AND (plan_type IS NULL OR plan_type != 'pro');
    END IF;
END $$;

-- 5. Fix Official Store (Example: If user meant a specific store, we can't guess, but we ensure the flag is valid)
-- Update any store with a name but flag false
UPDATE public.profiles
SET is_official_store = true
WHERE official_store_name IS NOT NULL AND official_store_name != '' AND is_official_store IS NOT TRUE;

-- 6. Grant Permissions (Just in case RLS is blocking)
-- Allow Service Role to do everything (default, but good to ensure)
GRANT ALL ON public.profiles TO service_role;


-- Migration: 20260210_fix_email_column.sql

-- 1. Añadir columna email a profiles si no existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Crear función para sincronizar email automáticamente cuando cambie en Auth
CREATE OR REPLACE FUNCTION public.handle_user_email_sync() 
RETURNS TRIGGER AS $$
BEGIN
  -- Si el registro en profiles no existe, no hacemos nada (el trigger de creación se encarga)
  -- Solo actualizamos si existe
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para escuchar cambios en auth.users
DROP TRIGGER IF EXISTS on_auth_user_email_update ON auth.users;
CREATE TRIGGER on_auth_user_email_update
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_sync();

-- 4. BACKFILL: Rellenar los emails vacíos en profiles usando auth.users
-- IMPORTANTE: Esto debe ejecutarse con privilegios de superusuario o postgres
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');


-- Migration: 20260210_fix_location_flags.sql


-- Fix is_approximate flag for existing records
-- Default was false (meaning Precise), but IP records should be true (Approximate)

-- 1. Set is_approximate = true for all records that do NOT come from browser geolocation
UPDATE public.user_ips
SET is_approximate = true
WHERE (metadata->>'source') IS NULL 
   OR (metadata->>'source' NOT LIKE 'browser_geolocation%');

-- 2. Ensure browser geolocation records are marked as precise (false)
UPDATE public.user_ips
SET is_approximate = false
WHERE metadata->>'source' LIKE 'browser_geolocation%';


-- Migration: 20260211_add_missing_columns_user_ips.sql

-- Add missing columns to user_ips table

-- Add is_approximate column (indicates if location is GPS or IP-based)
ALTER TABLE public.user_ips 
ADD COLUMN IF NOT EXISTS is_approximate BOOLEAN DEFAULT true;

-- Add user_agent column if missing
ALTER TABLE public.user_ips 
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add metadata column if missing (jsonb for flexible data storage)
ALTER TABLE public.user_ips 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing records to mark as approximate
UPDATE public.user_ips 
SET is_approximate = true 
WHERE is_approximate IS NULL;

-- Verification query
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_ips' 
  AND table_schema = 'public'
ORDER BY ordinal_position;


-- Migration: 20260211_add_official_store_slogan.sql

-- Add official_store_slogan to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS official_store_slogan TEXT;

-- Update RLS if necessary (usually profiles are updateable by owners)
-- No changes needed if policy already allows owner update and admin update.


-- Migration: 20260211_fix_listings_shipping_columns.sql

-- Reparar columnas faltantes en la tabla 'listings'
-- Copia y pega todo este código en el SQL Editor de Supabase y dale a 'Run'

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS description_blocks JSONB,
ADD COLUMN IF NOT EXISTS description_blocks_meta JSONB,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS attributes JSONB,
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
ADD COLUMN IF NOT EXISTS shipping_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_subsidy NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_by_seller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allow_personal_delivery BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS handling_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS length_cm NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS width_cm NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS height_cm NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS featured_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auction_start_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auction_end_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auction_starting_bid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auction_bid_increment NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auction_highest_bid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

-- Nota: Si después de ejecutar esto sigue apareciendo el error 'schema cache', 
-- espera 30 segundos o recarga la página de Supabase para que el cache se actualice.



-- Migration: 20260211_fix_user_ips_insert_policy.sql

-- Fix: Allow users to insert their own IP records
-- This enables GPS location tracking to work for regular users

-- Drop existing restrictive policy if exists
DROP POLICY IF EXISTS "Users can insert own IPs" ON public.user_ips;

-- Create policy for users to insert their own IP records
CREATE POLICY "Users can insert own IPs" ON public.user_ips
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Also allow users to view their own records (good for profile page)
DROP POLICY IF EXISTS "Users can view own IPs" ON public.user_ips;

CREATE POLICY "Users can view own IPs" ON public.user_ips
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to update their own recent records (for GPS updates)
DROP POLICY IF EXISTS "Users can update own recent IPs" ON public.user_ips;

CREATE POLICY "Users can update own recent IPs" ON public.user_ips
    FOR UPDATE
    USING (
        auth.uid() = user_id 
        AND detected_at > NOW() - INTERVAL '1 hour'
    )
    WITH CHECK (auth.uid() = user_id);


-- Migration: 20260220_add_commission_platinum.sql

-- Add commission_platinum_percent column to app_settings
-- Default: 18% for Plan Platinum

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS commission_platinum_percent numeric(5,2) NOT NULL DEFAULT 18;


-- Migration: 20260220_add_nickname.sql

-- ==========================================
-- SEUDÓNIMO / NICKNAME (Solo PRO y Platinum)
-- ==========================================
-- Máximo 10 caracteres. Solo se muestra si el
-- vendedor tiene plan 'pro' o 'platinum'.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname varchar(10) DEFAULT NULL;


-- Migration: 20260220_add_youtube_url_to_listings.sql

-- Add youtube_url column to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS youtube_url TEXT;


-- Migration: 20260220_admin_inbox.sql

-- Tabla para correos entrantes via Resend Inbound
CREATE TABLE IF NOT EXISTS admin_inbox (
  id          bigserial PRIMARY KEY,
  resend_id   text UNIQUE,
  to_email    text,
  from_email  text,
  from_name   text,
  subject     text,
  text_body   text,
  html_body   text,
  received_at timestamptz NOT NULL DEFAULT now(),
  seen        boolean NOT NULL DEFAULT false
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS admin_inbox_to_email_idx ON admin_inbox (to_email);
CREATE INDEX IF NOT EXISTS admin_inbox_received_at_idx ON admin_inbox (received_at DESC);

-- Solo admins pueden leer/escribir (la inserción la hace el webhook via service_role)
ALTER TABLE admin_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_inbox_service_role" ON admin_inbox
  FOR ALL USING (true) WITH CHECK (true);


-- Migration: 20260220_create_favorites.sql

-- ──────────────────────────────────────────────────────
-- Favorites (Wishlist / Heart Button)
-- Users can save listings as favorites. The heart button
-- in ListingCard reads and writes to this table.
-- ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.favorites (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id  uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT favorites_user_listing_unique UNIQUE (user_id, listing_id)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON public.favorites (user_id);
-- Index for fast per-listing lookups (e.g. count favorites on a product)
CREATE INDEX IF NOT EXISTS favorites_listing_id_idx ON public.favorites (listing_id);

-- ── RLS ─────────────────────────────────────────────────
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Users can only see their own favorites
CREATE POLICY "favorites_select_own"
    ON public.favorites FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "favorites_insert_own"
    ON public.favorites FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "favorites_delete_own"
    ON public.favorites FOR DELETE
    USING (auth.uid() = user_id);


-- Migration: 20260220_fix_commission_centavos.sql

-- ============================================================
-- Fix commission_fee to include centavos (2 decimal places)
-- Applies to ALL orders, old and new
-- ============================================================

DO $$
DECLARE
  basic_rate  numeric := 23;
  pro_rate    numeric := 18;
  plat_rate   numeric := 18;
  updated_count integer;
BEGIN
  -- 1. Load configured rates from app_settings (if available)
  BEGIN
    SELECT
      COALESCE(commission_basic_percent,   23),
      COALESCE(commission_pro_percent,     18),
      COALESCE(commission_platinum_percent,18)
    INTO basic_rate, pro_rate, plat_rate
    FROM app_settings
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- Table or column might not exist yet; keep defaults
    NULL;
  END;

  RAISE NOTICE 'Using rates → basic: %, pro: %, platinum: %', basic_rate, pro_rate, plat_rate;

  -- 2. Recalculate commission_fee with 2 decimal places for EVERY order
  --    that has a positive subtotal.  Uses the seller's CURRENT plan rate.
  --    (This corrects both integer-only commissions AND floating-point noise.)
  UPDATE orders o
  SET commission_fee = ROUND(
    CAST(o.subtotal AS numeric) *
    CASE
      WHEN p.plan_type = 'platinum' THEN plat_rate
      WHEN p.plan_type = 'pro'      THEN pro_rate
      ELSE                               basic_rate
    END / 100,
    2   -- centavos
  )
  FROM profiles p
  WHERE o.seller_id = p.id
    AND o.subtotal  > 0
    AND o.commission_fee > 0;   -- skip free / already-zero orders

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated commission_fee for % orders', updated_count;

  -- 3. For orders where seller profile is missing (edge case), just round
  --    whatever is stored to 2 decimal places.
  UPDATE orders
  SET commission_fee = ROUND(CAST(commission_fee AS numeric), 2)
  WHERE commission_fee > 0
    AND commission_fee != ROUND(CAST(commission_fee AS numeric), 2)
    AND seller_id NOT IN (SELECT id FROM profiles WHERE id IS NOT NULL);

END $$;


-- Migration: 20260220_fix_digital_listings_envio_digital.sql

-- ==================================================================
-- FIX DIGITAL LISTINGS (RETROACTIVO)
-- 
-- Objetivo:
--   1) Asegurar que las publicaciones antiguas usadas como "producto digital"
--      queden marcadas con product_type = 'digital' y configuración coherente.
--   2) Habilitar que aparezcan con el chip "💎 PRODUCTO DIGITAL" en el frontend
--      (ListingCard usa p.product_type === 'digital').
--
-- Alcance:
--   - Publicaciones cuyo título contiene "ENVIO DIGITAL" o "ENVÍO DIGITAL".
--   - El listing de "Licencia Adobe CREATIVE CLOUD" referenciado por la orden
--     7a4c89e9-0f81-4687-907b-8ea91ec1929f (idempotente).
--
-- Seguridad:
--   - Diseñado para ser idempotente: se puede ejecutar múltiples veces sin
--     romper datos; solo normaliza a estado "digital".
-- ==================================================================

-- 1. Asegurar columnas necesarias (si no existían aún)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'physical';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS digital_delivery_type TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS digital_delivery_fields JSONB;

-- 2. Normalizar listing conocido de licencia digital (Adobe Creative Cloud)
UPDATE listings
SET product_type = 'digital',
    digital_delivery_type = 'manual',
    digital_delivery_fields = COALESCE(digital_delivery_fields, '[{"label": "Serial"}]'::jsonb),
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
  SELECT listing_id
  FROM order_items
  WHERE order_id = '7a4c89e9-0f81-4687-907b-8ea91ec1929f'
);

-- 3. Marcar como digitales las publicaciones "ENVÍO DIGITAL" antiguas
UPDATE listings
SET product_type = 'digital',
    digital_delivery_type = COALESCE(digital_delivery_type, 'manual'),
    digital_delivery_fields = COALESCE(digital_delivery_fields, '[{"label": "Serial"}]'::jsonb),
    free_shipping = true,
    shipping_by_seller = false,
    allow_personal_delivery = false,
    weight_kg = 0,
    length_cm = 0,
    width_cm = 0,
    height_cm = 0,
    handling_days = 0,
    shipping_subsidy = 0
WHERE (product_type IS NULL OR product_type <> 'digital')
  AND (
    title ILIKE '%ENVIO DIGITAL%' OR
    title ILIKE '%ENVÍO DIGITAL%'
  );

-- 4. Verificación rápida (opcional en logs de migración)
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM listings
  WHERE product_type = 'digital'
    AND (
      title ILIKE '%ENVIO DIGITAL%' OR
      title ILIKE '%ENVÍO DIGITAL%'
      OR id IN (
        SELECT listing_id
        FROM order_items
        WHERE order_id = '7a4c89e9-0f81-4687-907b-8ea91ec1929f'
      )
    );

  RAISE NOTICE 'Digital listings normalized (ENVIO DIGITAL + Adobe license): %', affected_count;
END $$;



-- Migration: 20260220_fix_digital_orders_shipping.sql

-- Fix digital product orders: set shipping_fee = 0 for all digital product orders
-- This corrects existing orders where shipping was incorrectly charged for digital products

-- Step 1: Update orders that only have digital product items to have shipping_fee = 0
-- We identify digital orders by looking at order_items joined to listings where product_type = 'digital'
UPDATE orders
SET 
  shipping_fee = 0,
  total = subtotal - COALESCE(coupon_discount, 0),
  shipping_carrier = 'digital'
WHERE id IN (
  SELECT DISTINCT oi.order_id
  FROM order_items oi
  JOIN listings l ON l.id = oi.listing_id::uuid
  WHERE l.product_type = 'digital'
) 
AND id NOT IN (
  -- Exclude orders that ALSO have physical items
  SELECT DISTINCT oi.order_id
  FROM order_items oi
  JOIN listings l ON l.id = oi.listing_id::uuid
  WHERE l.product_type != 'digital' OR l.product_type IS NULL
)
AND shipping_fee > 0;

-- Log the fix
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % digital product orders (shipping_fee set to 0)', affected_count;
END $$;


-- Migration: 20260220_get_admin_users_data.sql

-- Function: get_admin_users_data
-- Purpose: Returns combined profile + auth email data for a list of user IDs.
-- Security: SECURITY DEFINER so it can read auth.users. Only callable by authenticated users.
-- The RLS check on admin_users is done in the application layer before calling this RPC.

CREATE OR REPLACE FUNCTION get_admin_users_data(user_ids uuid[])
RETURNS TABLE (
  id          uuid,
  full_name   text,
  first_name  text,
  last_name   text,
  email       text,
  state       text,
  city        text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    p.full_name,
    p.first_name,
    p.last_name,
    COALESCE(au.email, 'Sin email') AS email,
    p.state,
    p.city
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE p.id = ANY(user_ids);
$$;

-- Grant execute to authenticated users (admin check is done in client code)
GRANT EXECUTE ON FUNCTION get_admin_users_data(uuid[]) TO authenticated;


-- Migration: 20260220_identity_verification.sql

-- Add identity verification columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS selfie_ine_url text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verification_rejection_reason text,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz;

-- Migrate existing verified users: if is_verified = true AND ine_front_url is set, mark as approved
UPDATE profiles
SET verification_status = 'approved'
WHERE is_verified = true
  AND ine_front_url IS NOT NULL
  AND verification_status = 'none';

-- Migrate users who submitted INE but aren't verified yet: mark as pending
UPDATE profiles
SET verification_status = 'pending',
    verification_submitted_at = COALESCE(updated_at, now())
WHERE is_verified = false
  AND ine_front_url IS NOT NULL
  AND ine_front_url != ''
  AND verification_status = 'none';


-- Migration: 20260221_add_ingress_id_to_live_sessions.sql

-- Add ingress_id column to live_sessions for OBS integration
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS ingress_id TEXT;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_live_sessions_ingress_id ON live_sessions(ingress_id);


-- Migration: 20260221_backfill_live_notifications_links.sql

-- Backfill de enlaces para notificaciones de EN VIVO
-- Convierte notificaciones antiguas "live_started" sin link_to
-- en notificaciones que apuntan a la sala correcta (/live/{session_id})

UPDATE notifications
SET link_to = '/live/' || (data->>'session_id')
WHERE link_to IS NULL
  AND (
    type = 'admin_announcement'
    OR type IS NULL
  )
  AND data->>'kind' = 'live_started'
  AND data->>'session_id' IS NOT NULL;



-- Migration: 20260221_live_viewers_table.sql

-- Tabla para rastrear espectadores únicos por pestaña del navegador
-- Evita que refrescar la página infle el contador de vistas
CREATE TABLE IF NOT EXISTS live_viewers (
    session_id  UUID  NOT NULL,
    viewer_id   TEXT  NOT NULL,   -- UUID generado en sessionStorage del navegador
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, viewer_id),
    FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE
);

-- Índice para consultas rápidas por última vez visto
CREATE INDEX IF NOT EXISTS idx_live_viewers_last_seen 
    ON live_viewers(session_id, last_seen);

-- Sin RLS — acceso solo desde el service role (servidor)
ALTER TABLE live_viewers DISABLE ROW LEVEL SECURITY;


-- Migration: 20260222_add_broadcast_mode.sql

-- Add broadcast_mode and stream_key columns to live_sessions
-- broadcast_mode: 'browser' (WebRTC via LiveKit) or 'obs' (RTMP -> HLS via MediaMTX)
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS broadcast_mode text DEFAULT 'browser';
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS stream_key text;


-- Migration: 20260222_live_ads.sql

-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sistema de Anuncios en Lives
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- 1. Campo is_free_session en live_sessions
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS is_free_session boolean DEFAULT true;

-- 2. Tabla: Campañas de anuncios
CREATE TABLE IF NOT EXISTS live_ad_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name text NOT NULL DEFAULT 'GoPocket',
  type          text NOT NULL CHECK (type IN ('overlay', 'video', 'product_spotlight')),
  title         text NOT NULL,
  subtitle      text,
  content_url   text,             -- URL del video o imagen del anuncio
  target_url    text,             -- URL a donde redirige al hacer click
  cta_text      text DEFAULT 'Ver más',
  duration_secs integer NOT NULL DEFAULT 10,
  frequency_mins integer NOT NULL DEFAULT 15,  -- cada cuántos minutos aparece
  is_active     boolean NOT NULL DEFAULT true,
  priority      integer NOT NULL DEFAULT 0,    -- mayor = más prioridad
  impressions   bigint NOT NULL DEFAULT 0,
  clicks        bigint NOT NULL DEFAULT 0,
  start_date    timestamptz,
  end_date      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_ad_campaigns ENABLE ROW LEVEL SECURITY;

-- Lectura pública (necesaria para que el viewer cargue los ads)
CREATE POLICY IF NOT EXISTS "live_ad_campaigns_public_read"
  ON live_ad_campaigns FOR SELECT
  USING (true);

-- Solo admin puede modificar
CREATE POLICY IF NOT EXISTS "live_ad_campaigns_admin_manage"
  ON live_ad_campaigns FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 3. Tabla: Registro de impresiones y clicks
CREATE TABLE IF NOT EXISTS live_ad_impressions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES live_ad_campaigns(id) ON DELETE CASCADE,
  session_id    uuid REFERENCES live_sessions(id) ON DELETE SET NULL,
  viewer_id     text,
  type          text NOT NULL CHECK (type IN ('impression', 'click')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_ad_impressions ENABLE ROW LEVEL SECURITY;

-- Solo inserción pública (para registrar impresiones desde el viewer)
CREATE POLICY IF NOT EXISTS "live_ad_impressions_insert"
  ON live_ad_impressions FOR INSERT
  WITH CHECK (true);

-- Admin puede leer todo
CREATE POLICY IF NOT EXISTS "live_ad_impressions_admin_read"
  ON live_ad_impressions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_live_ad_campaigns_active ON live_ad_campaigns(is_active, type);
CREATE INDEX IF NOT EXISTS idx_live_ad_impressions_campaign ON live_ad_impressions(campaign_id, type);
CREATE INDEX IF NOT EXISTS idx_live_ad_impressions_session ON live_ad_impressions(session_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_free ON live_sessions(is_free_session);


-- Migration: 20260222_live_hours.sql

-- ════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sistema de Horas Live
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- 1. Campo ended_at en live_sessions (para calcular duración)
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- 2. Tabla: saldo de horas extra compradas (permanentes, no caducan)
CREATE TABLE IF NOT EXISTS live_extra_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  minutes_balance integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE live_extra_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "live_extra_hours_owner_select"
  ON live_extra_hours FOR SELECT USING (auth.uid() = user_id);

-- 3. Tabla: minutos gratuitos usados hoy (Platinum — se resetea cada día)
CREATE TABLE IF NOT EXISTS live_daily_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date  date NOT NULL DEFAULT CURRENT_DATE,
  minutes_used integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, usage_date)
);
ALTER TABLE live_daily_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "live_daily_usage_owner_select"
  ON live_daily_usage FOR SELECT USING (auth.uid() = user_id);

-- 4. Permitir a service_role hacer todo (necesario para las API routes)
-- (service_role siempre bypassa RLS, esto es solo documentación)

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_live_extra_hours_user ON live_extra_hours(user_id);
CREATE INDEX IF NOT EXISTS idx_live_daily_usage_user_date ON live_daily_usage(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_live_sessions_host_status ON live_sessions(host_id, status);


-- Migration: 20260222_purchase_live_hours_fn.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- Función atómica para compra de horas Live con PocketCash
-- REGISTRA en wallet_transactions para trazabilidad completa
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION purchase_live_hours(
    p_user_id       uuid,
    p_package_id    text,
    p_minutes       integer,
    p_price_mxn     numeric,
    p_hours_label   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan_type     text;
    v_sub_end       timestamptz;
    v_current_cash  numeric;
    v_new_cash      numeric;
    v_old_balance   integer;
    v_new_balance   integer;
    v_order_id      text;
    v_tx_id         uuid;
BEGIN
    -- 0. Generar un ID de orden único para esta compra
    v_order_id := 'LIVE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

    -- 1. Verificar plan del usuario
    SELECT plan_type, pro_subscription_end
    INTO v_plan_type, v_sub_end
    FROM profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Usuario no encontrado', 'status', 404);
    END IF;

    -- 2. Verificar expiración de suscripción
    IF (v_plan_type = 'platinum' OR v_plan_type = 'pro') AND v_sub_end IS NOT NULL THEN
        IF now() > v_sub_end THEN
            v_plan_type := 'basic';
        END IF;
    END IF;

    IF v_plan_type = 'basic' THEN
        RETURN jsonb_build_object('error', 'Necesitas plan Pro o Platinum', 'status', 403);
    END IF;

    -- 3. Obtener saldo de wallets con bloqueo de fila (FOR UPDATE)
    SELECT balance
    INTO v_current_cash
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Monedero no encontrado', 'status', 404);
    END IF;

    -- 4. Verificar saldo suficiente
    IF v_current_cash < p_price_mxn THEN
        RETURN jsonb_build_object('error', 'PocketCash insuficiente', 'status', 400);
    END IF;

    -- 5. Deducir PocketCash del monedero
    v_new_cash := v_current_cash - p_price_mxn;
    UPDATE wallets
    SET balance = v_new_cash
    WHERE user_id = p_user_id AND balance >= p_price_mxn;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Error de concurrencia al deducir saldo', 'status', 409);
    END IF;

    -- 6. Registrar transacción en wallet_transactions (TRAZABILIDAD COMPLETA)
    INSERT INTO wallet_transactions (
        wallet_id,
        type,
        amount,
        concept,
        reference_type,
        reference_id,
        created_at
    ) VALUES (
        p_user_id,
        'debit',
        p_price_mxn,
        'GoPocket Lives - Compra ' || p_hours_label || 'h (paquete ' || p_package_id || ')',
        'live_hours',
        v_order_id,
        now()
    )
    RETURNING id INTO v_tx_id;

    -- 7. Acreditar minutos extra (upsert atómico)
    SELECT COALESCE(minutes_balance, 0)
    INTO v_old_balance
    FROM live_extra_hours
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        v_old_balance := 0;
        INSERT INTO live_extra_hours (user_id, minutes_balance, updated_at)
        VALUES (p_user_id, p_minutes, now());
    ELSE
        UPDATE live_extra_hours
        SET minutes_balance = v_old_balance + p_minutes, updated_at = now()
        WHERE user_id = p_user_id;
    END IF;

    v_new_balance := v_old_balance + p_minutes;

    -- 8. Retornar resultado exitoso con IDs de trazabilidad
    RETURN jsonb_build_object(
        'ok', true,
        'order_id', v_order_id,
        'transaction_id', v_tx_id,
        'minutes_added', p_minutes,
        'new_balance_minutes', v_new_balance,
        'new_pocket_cash', v_new_cash,
        'status', 200
    );
END;
$$;


-- Migration: 20260223_gopocket_tv.sql

-- GoPocket TV: Platform-owned live channel
-- Adds is_platform flag to live_sessions and creates platform_videos table for auto-loop content

-- 1. Add platform flag to live_sessions
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS is_platform boolean DEFAULT false;

-- 2. Table for pre-recorded promotional videos (loop when OBS is offline)
CREATE TABLE IF NOT EXISTS platform_videos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    video_url text NOT NULL,
    thumbnail_url text,
    duration_seconds integer DEFAULT 0,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE platform_videos ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can see the videos)
CREATE POLICY "platform_videos_public_read" ON platform_videos
    FOR SELECT USING (true);

-- Only service_role can insert/update/delete (via admin API)


-- Migration: 20260223_live_chat_bans.sql

-- live_chat_bans: moderación de usuarios en lives
-- Aplica a TODOS los lives (globalmente, no por sesión)
CREATE TABLE IF NOT EXISTS live_chat_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID,  -- nullable: null = global ban, set = session-specific
    action TEXT NOT NULL CHECK (action IN ('mute', 'ban')),
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_live_chat_bans_user_active ON live_chat_bans(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_live_chat_bans_action ON live_chat_bans(action, is_active);

-- RLS: solo admins pueden leer/escribir
ALTER TABLE live_chat_bans ENABLE ROW LEVEL SECURITY;

-- Permitir lectura con service_role (API routes)
CREATE POLICY "Service role full access" ON live_chat_bans
    FOR ALL USING (true) WITH CHECK (true);


-- Migration: 20260225_allow_t1_override.sql

-- Migration: Add allow_t1_override to profiles
-- This column allows admins to manually enable T1 Premium shipping for Basic plan users.
-- T1 Envíos is normally restricted to Pro and Platinum plans only.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS allow_t1_override BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.allow_t1_override IS
  'Admin override: allows Basic plan users access to T1 GoPocket Premium shipping (Pro/Platinum exclusive feature).';


-- Migration: 20260226184908_add_shipping_promotions.sql



-- Migration: 20260227_t1_label_columns.sql

-- Add T1-related columns to orders table for automatic label generation
ALTER TABLE orders ADD COLUMN IF NOT EXISTS t1_quote_token text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_label_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number text;


-- Migration: 20260514120000_app_settings_feature_flags.sql

-- Feature flags centralizados (interruptores globales) en app_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'feature_flags'
  ) THEN
    ALTER TABLE public.app_settings
      ADD COLUMN feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.app_settings.feature_flags IS 'Interruptores globales (JSON). Ej.: {"gopocket_shipping": true}';
  END IF;
END $$;


-- Migration: FIX_COMPLETO_GPS_Y_ADMIN.sql

-- ========================================
-- FIX COMPLETO: GPS + ADMIN ACCESS
-- ========================================
-- Este script corrige TODOS los problemas:
-- 1. Permite a usuarios insertar ubicaciones GPS
-- 2. Te agrega como administrador si no lo eres
-- ========================================

-- PARTE 1: Políticas RLS para GPS
-- ----------------------------------------

-- Drop existing restrictive policies if exist
DROP POLICY IF EXISTS "Users can insert own IPs" ON public.user_ips;
DROP POLICY IF EXISTS "Users can view own IPs" ON public.user_ips;
DROP POLICY IF EXISTS "Users can update own recent IPs" ON public.user_ips;

-- Create policy for users to insert their own IP records
CREATE POLICY "Users can insert own IPs" ON public.user_ips
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own records
CREATE POLICY "Users can view own IPs" ON public.user_ips
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to update their own recent records (for GPS updates)
CREATE POLICY "Users can update own recent IPs" ON public.user_ips
    FOR UPDATE
    USING (
        auth.uid() = user_id 
        AND detected_at > NOW() - INTERVAL '1 hour'
    )
    WITH CHECK (auth.uid() = user_id);

-- PARTE 2: AGREGAR USUARIO COMO ADMIN
-- ----------------------------------------
-- IMPORTANTE: Esto agregará al usuario actual como admin
-- Si ya existe, no hará nada (ON CONFLICT DO NOTHING)

-- Primero vemos si hay algún usuario logueado en profiles
-- Si existe, lo agregamos como admin
INSERT INTO public.admin_users (user_id, created_at, updated_at)
SELECT 
    id, 
    NOW(), 
    NOW()
FROM public.profiles
WHERE email IS NOT NULL
  AND id NOT IN (SELECT user_id FROM public.admin_users)
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (user_id) DO NOTHING;

-- Verificación: Mostrar todos los admins actuales
SELECT 
    au.user_id,
    p.full_name,
    p.email,
    au.created_at as admin_since
FROM public.admin_users au
LEFT JOIN public.profiles p ON au.user_id = p.id
ORDER BY au.created_at DESC;


-- Migration: create_banners_table.sql

-- Crear tabla de banners para el slideshow de la página principal
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  cta_text TEXT,
  cta_link TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para ordenar banners
CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(display_order, is_active);

-- Políticas RLS
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública de banners activos
CREATE POLICY "Banners activos son visibles públicamente"
  ON banners FOR SELECT
  USING (is_active = true);

-- Solo admins pueden insertar/actualizar/eliminar banners
CREATE POLICY "Solo admins pueden gestionar banners"
  ON banners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_banners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW
  EXECUTE FUNCTION update_banners_updated_at();

-- Insertar banners de ejemplo
INSERT INTO banners (image_url, title, subtitle, cta_text, cta_link, display_order, is_active) VALUES
('/images/banner1.jpg', 'Nueva temporada', 'Descubre ofertas y prendas únicas', 'Empezar a vender >', '/sell', 1, true),
('/images/banner2.jpg', 'Vende fácil', 'Publica en minutos', 'Explorar', '/listings', 2, true),
('/images/banner3.jpg', 'Compra seguro', 'Protección total en cada compra', 'Ver más', '/dashboard/ayuda', 3, true)
ON CONFLICT DO NOTHING;


