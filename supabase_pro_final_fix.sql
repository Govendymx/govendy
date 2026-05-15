-- ============================================================
-- SOLUCIÓN FINAL DEFINITIVA: SISTEMA PRO Y ADMIN
-- Ejecuta este script COMPLETO en el Editor SQL de Supabase
-- ============================================================

-- 1. Modificar tabla profiles (Idempotente: no falla si ya existen)
DO $$ 
BEGIN
    -- Columna is_pro
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_pro') THEN
        ALTER TABLE public.profiles ADD COLUMN is_pro boolean DEFAULT false;
    END IF;

    -- Fechas de suscripción
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'pro_subscription_start') THEN
        ALTER TABLE public.profiles ADD COLUMN pro_subscription_start timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'pro_subscription_end') THEN
        ALTER TABLE public.profiles ADD COLUMN pro_subscription_end timestamptz;
    END IF;
END $$;

-- 2. Crear tabla de Logs de Suscripción PRO
CREATE TABLE IF NOT EXISTS public.pro_subscription_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    operation_id text NOT NULL,
    amount decimal(10,2) NOT NULL,
    days_added int NOT NULL,
    payment_method text NOT NULL,
    status text NOT NULL,
    created_at timestamptz DEFAULT now(),
    metadata jsonb
);

-- 3. Habilitar seguridad (RLS)
ALTER TABLE public.pro_subscription_logs ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acceso (CORREGIDO: Usa tabla admin_users)
DROP POLICY IF EXISTS "Admins can view all pro logs" ON public.pro_subscription_logs;

CREATE POLICY "Admins can view all pro logs"
ON public.pro_subscription_logs FOR SELECT
USING (
  -- Verificamos en la tabla admin_users, NO en profiles
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view their own pro logs" ON public.pro_subscription_logs;
CREATE POLICY "Users can view their own pro logs"
ON public.pro_subscription_logs FOR SELECT
USING (auth.uid() = user_id);

-- 5. FUNCIÓN SEGURA para obtener datos de usuario (Arregla "Usuario desconocido")
-- Esta función accede a auth.users para obtener el email real
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
    au.email::text, -- Acceso seguro al email desde auth.users
    p.state,
    p.city,
    COALESCE(p.is_pro, false),
    p.pro_subscription_end
  FROM public.profiles p
  JOIN auth.users au ON p.id = au.id
  WHERE p.id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql;

-- 6. FUNCIÓN OPTIMIZADA para la Tabla de Admin (Lista completa)
CREATE OR REPLACE FUNCTION get_all_profiles_admin()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  is_pro boolean,
  pro_subscription_start timestamptz,
  pro_subscription_end timestamptz
) 
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Verificación de seguridad extra (aunque RLS protege, esto es doble seguridad)
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    au.email::text,
    COALESCE(p.is_pro, false),
    p.pro_subscription_start,
    p.pro_subscription_end
  FROM public.profiles p
  JOIN auth.users au ON p.id = au.id
  ORDER BY p.pro_subscription_end ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql;
