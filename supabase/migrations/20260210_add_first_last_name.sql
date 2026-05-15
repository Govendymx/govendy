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
