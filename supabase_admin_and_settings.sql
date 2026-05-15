-- Pocket App - Admin + Settings (MercadoPago / Transferencia / Depósito / OXXO)
-- Ejecuta este SQL en el SQL Editor de Supabase.
-- Nota: Ajusta permisos/roles según tu caso. Este esquema está pensado para:
-- - Usuarios autenticados: pueden LEER configuración para checkout
-- - Admins: pueden EDITAR configuración

-- 1) Tabla de admins
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Solo el propio admin puede verse (y los admins gestionan esta tabla desde SQL o con service role)
DROP POLICY IF EXISTS "Admin can read own admin row" ON public.admin_users;
CREATE POLICY "Admin can read own admin row"
  ON public.admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- IMPORTANTE:
-- Para evitar que cualquiera se vuelva admin, NO damos políticas de INSERT/UPDATE/DELETE desde el cliente.
-- Agrega admins manualmente desde Supabase SQL:
-- INSERT INTO public.admin_users (user_id) VALUES ('<uuid>');


-- 2) Tabla de configuración global (single-row)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_rate NUMERIC NOT NULL DEFAULT 0.05,          -- 5% por defecto
  cancel_penalty_rate NUMERIC NOT NULL DEFAULT 0.03,      -- 3% por cancelación
  featured_price NUMERIC NOT NULL DEFAULT 25.00,          -- $25 por destacados
  shipping_base NUMERIC NOT NULL DEFAULT 180.00,          -- $180 base
  shipping_extended NUMERIC NOT NULL DEFAULT 200.00,      -- +$200 zona extendida
  payment_methods JSONB NOT NULL DEFAULT jsonb_build_object(
    'mercadopago', jsonb_build_object('enabled', true),
    'bank_transfer', jsonb_build_object(
      'enabled', true,
      'bank_name', '',
      'account_holder', '',
      'clabe', '',
      'instructions', ''
    ),
    'bank_deposit', jsonb_build_object(
      'enabled', true,
      'bank_name', '',
      'account_holder', '',
      'account_number', '',
      'instructions', ''
    ),
    'oxxo', jsonb_build_object(
      'enabled', true,
      'instructions', ''
    )
  ),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Asegurar single-row
INSERT INTO public.app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Helper: ¿es admin?
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

-- Lectura: cualquier usuario autenticado puede leer settings (necesario para checkout)
DROP POLICY IF EXISTS "Authenticated users can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Escritura: solo admins
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
CREATE POLICY "Admins can update app settings"
  ON public.app_settings
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

