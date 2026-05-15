-- Add official_store_slogan to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS official_store_slogan TEXT;

-- Update RLS if necessary (usually profiles are updateable by owners)
-- No changes needed if policy already allows owner update and admin update.
