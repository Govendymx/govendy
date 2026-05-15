
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
