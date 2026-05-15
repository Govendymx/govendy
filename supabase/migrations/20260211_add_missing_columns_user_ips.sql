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
