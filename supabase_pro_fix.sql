-- 1. Create/Update PRO related columns in profiles table
DO $$ 
BEGIN
    -- is_pro column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_pro') THEN
        ALTER TABLE public.profiles ADD COLUMN is_pro boolean DEFAULT false;
    END IF;

    -- pro_subscription_start column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'pro_subscription_start') THEN
        ALTER TABLE public.profiles ADD COLUMN pro_subscription_start timestamptz;
    END IF;

    -- pro_subscription_end column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'pro_subscription_end') THEN
        ALTER TABLE public.profiles ADD COLUMN pro_subscription_end timestamptz;
    END IF;
END $$;

-- 2. Create PRO Subscription Logs table
CREATE TABLE IF NOT EXISTS public.pro_subscription_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    operation_id text NOT NULL, -- e.g. PRO-20240210-XXXXX
    amount decimal(10,2) NOT NULL,
    days_added int NOT NULL,
    payment_method text NOT NULL, -- e.g. 'pocket_cash'
    status text NOT NULL, -- 'completed', 'pending', 'failed'
    created_at timestamptz DEFAULT now(),
    metadata jsonb
);

-- 3. Enable RLS on Logs
ALTER TABLE public.pro_subscription_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Logs
DROP POLICY IF EXISTS "Admins can view all pro logs" ON public.pro_subscription_logs;
CREATE POLICY "Admins can view all pro logs"
ON public.pro_subscription_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

DROP POLICY IF EXISTS "Users can view their own pro logs" ON public.pro_subscription_logs;
CREATE POLICY "Users can view their own pro logs"
ON public.pro_subscription_logs FOR SELECT
USING (auth.uid() = user_id);

-- 5. Secure RPC Function to fetch user data including Email (resolves "Usuario desconocido")
CREATE OR REPLACE FUNCTION get_admin_users_data(user_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  first_name text,
  last_name text,
  email text,
  state text,
  city text,
  is_pro boolean,
  pro_expiration timestamptz
) 
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.first_name,
    p.last_name,
    au.email::text,
    p.state,
    p.city,
    COALESCE(p.is_pro, false),
    p.pro_subscription_end
  FROM public.profiles p
  JOIN auth.users au ON p.id = au.id
  WHERE p.id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql;
