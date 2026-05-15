-- Add store_logo_url to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS store_logo_url TEXT;

-- Policy to allow users to update their own profile (already exists usually, but good to remember)
-- Users can already update their own profile based on existing policies.
