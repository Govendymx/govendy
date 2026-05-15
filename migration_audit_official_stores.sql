-- Migration: Add Audit Fields and Official Store Fields to Profiles
-- Description: Adds manual override columns for reputation/sales and fields for official stores.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS manual_reputation_score INTEGER,
ADD COLUMN IF NOT EXISTS manual_sales_count INTEGER,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS is_official_store BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS official_store_name TEXT,
ADD COLUMN IF NOT EXISTS official_store_banner_url TEXT,
ADD COLUMN IF NOT EXISTS official_store_brand_color TEXT;

-- Create index for faster filtering of official stores if needed
CREATE INDEX IF NOT EXISTS idx_profiles_is_official_store ON public.profiles(is_official_store) WHERE is_official_store = true;
