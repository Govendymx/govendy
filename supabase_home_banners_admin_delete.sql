-- Pocket App - Permitir DELETE de home_banners a admins (idempotente)
-- Ejecuta en Supabase → SQL Editor.

-- Asegurar helper is_admin (si ya existe, no pasa nada)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

-- Policy explícita de DELETE (por si tu policy "FOR ALL" no existe o fue modificada)
DROP POLICY IF EXISTS "Admins can delete home banners" ON public.home_banners;
CREATE POLICY "Admins can delete home banners"
  ON public.home_banners
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

