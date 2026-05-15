-- Ensure RLS policies exist for user_ips table

-- 1. Enable RLS
ALTER TABLE user_ips ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own IPs" ON user_ips;
DROP POLICY IF EXISTS "Users can update their own IPs" ON user_ips;
DROP POLICY IF EXISTS "Users can view their own IPs" ON user_ips;
DROP POLICY IF EXISTS "Admins can view all IPs" ON user_ips;

-- 3. Create permissive policies for Users
CREATE POLICY "Users can insert their own IPs" 
ON user_ips FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own IPs" 
ON user_ips FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own IPs" 
ON user_ips FOR SELECT 
USING (auth.uid() = user_id);

-- 4. Admin Policy (assuming admin role or metadata check)
-- This is a simplified check. Adjust 'role' check as per your auth setup.
CREATE POLICY "Admins can view all IPs" 
ON user_ips FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
