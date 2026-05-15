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
