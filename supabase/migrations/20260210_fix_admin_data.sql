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
