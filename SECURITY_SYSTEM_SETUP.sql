-- Enable RLS
-- Create table for storing User IP history
CREATE TABLE IF NOT EXISTS public.user_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    country TEXT,
    city TEXT,
    region TEXT,
    isp TEXT,
    latitude FLOAT,
    longitude FLOAT,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_ips_user_id ON public.user_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ips_ip_address ON public.user_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_ips_detected_at ON public.user_ips(detected_at);

-- Create table for Security Alerts/Logs
CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- e.g., 'IP_MATCH_BLOCK', 'SUSPICIOUS_LOGIN', 'MULTIPLE_ACCOUNTS'
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- If 2 users involved
    ip_address TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved', 'ignored')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for alerts
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON public.security_alerts(type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status);

-- RLS Policies
ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can view all
CREATE POLICY "Admins can view all user_ips" ON public.user_ips
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can view all security_alerts" ON public.security_alerts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can insert security_alerts" ON public.security_alerts
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
        OR 
        -- Allow system/service role (handled by bypass RLS in code usually, but for authenticated users triggering alerts via API)
        auth.uid() IS NOT NULL
    );

-- Users can insert their own IP (via API)
CREATE POLICY "Users can insert own ip" ON public.user_ips
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own IP history (optional, maybe for security page in profile)
CREATE POLICY "Users can view own ip" ON public.user_ips
    FOR SELECT USING (auth.uid() = user_id);

-- RPC Function to check shared IPs
CREATE OR REPLACE FUNCTION public.check_shared_ip(uid1 UUID, uid2 UUID, days INT)
RETURNS TABLE (ip_address TEXT, count1 BIGINT, count2 BIGINT) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user1_ips AS (
    SELECT DISTINCT u1.ip_address
    FROM public.user_ips u1
    WHERE u1.user_id = uid1
      AND u1.detected_at > (NOW() - (days || ' days')::INTERVAL)
  ),
  user2_ips AS (
    SELECT DISTINCT u2.ip_address
    FROM public.user_ips u2
    WHERE u2.user_id = uid2
      AND u2.detected_at > (NOW() - (days || ' days')::INTERVAL)
  )
  SELECT u1.ip_address, 1::BIGINT, 1::BIGINT
  FROM user1_ips u1
  JOIN user2_ips u2 ON u1.ip_address = u2.ip_address;
END;
$$ LANGUAGE plpgsql;
