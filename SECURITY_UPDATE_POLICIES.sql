
-- Allow admins to update user_ips (for manual location correction)
DROP POLICY IF EXISTS "Admins can update user_ips" ON public.user_ips;
CREATE POLICY "Admins can update user_ips" ON public.user_ips
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );

-- Allow admins to update security_alerts (for status updates)
DROP POLICY IF EXISTS "Admins can update security_alerts" ON public.security_alerts;
CREATE POLICY "Admins can update security_alerts" ON public.security_alerts
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    );
