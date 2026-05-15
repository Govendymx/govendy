
-- Function to check for shared IP history between two users
-- Used for Fraud Prevention (Deep Check)

-- Drop first to allow return type changes if it exists
DROP FUNCTION IF EXISTS check_shared_ip(uuid, uuid, int);

CREATE OR REPLACE FUNCTION check_shared_ip(uid1 UUID, uid2 UUID, days INT DEFAULT 7)
RETURNS TABLE(ip_address TEXT, last_seen1 TIMESTAMPTZ, last_seen2 TIMESTAMPTZ)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t1.ip_address,
    MAX(t1.detected_at) as last_seen1,
    MAX(t2.detected_at) as last_seen2
  FROM user_ips t1
  JOIN user_ips t2 ON t1.ip_address = t2.ip_address
  WHERE t1.user_id = uid1
    AND t2.user_id = uid2
    AND t1.detected_at > (NOW() - (days || ' days')::INTERVAL)
    AND t2.detected_at > (NOW() - (days || ' days')::INTERVAL)
  GROUP BY t1.ip_address;
END;
$$ LANGUAGE plpgsql;

-- Ensure Security Alerts table exists
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    related_user_id UUID REFERENCES auth.users(id),
    ip_address TEXT,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved', 'false_positive')),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Policy for Admin (assuming admin uses service role or specific claim, but for now allow read/write for auth users with admin role logic if needed)
-- Since this is a server-side table mainly populated by API, we might not need public RLS policies if only accessed via Service Role.
-- But for the Admin Panel (client-side), we need Read access for admins.

CREATE POLICY "Admins can view alerts" ON security_alerts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  )
);
