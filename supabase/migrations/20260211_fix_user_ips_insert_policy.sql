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
