-- ============================================================
-- MIGRACIÓN: SISTEMA DE USUARIOS PRO
-- ============================================================

-- 1. Modificar tabla profiles para soporte PRO
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pro_subscription_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pro_subscription_end TIMESTAMPTZ;

-- Índices para búsqueda rápida de usuarios PRO
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro ON public.profiles(is_pro);
CREATE INDEX IF NOT EXISTS idx_profiles_pro_end ON public.profiles(pro_subscription_end);

-- 2. Crear tabla de logs de suscripciones PRO
CREATE TABLE IF NOT EXISTS public.pro_subscription_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  operation_id TEXT NOT NULL, -- Formato: PRO-YYYYMMDD-XXXXX
  action TEXT NOT NULL, -- 'renew', 'expire', 'cancel', 'admin_grant', 'admin_revoke'
  days_added INTEGER NOT NULL DEFAULT 0,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT, -- 'pocket_cash', 'admin_manual'
  previous_end_date TIMESTAMPTZ,
  new_end_date TIMESTAMPTZ,
  admin_id UUID, -- Si fue acción administrativa
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pro_logs_user ON public.pro_subscription_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pro_logs_operation ON public.pro_subscription_logs(operation_id);
CREATE INDEX IF NOT EXISTS idx_pro_logs_created ON public.pro_subscription_logs(created_at DESC);

-- RLS
ALTER TABLE public.pro_subscription_logs ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver logs
DROP POLICY IF EXISTS "Admins can view pro logs" ON public.pro_subscription_logs;
CREATE POLICY "Admins can view pro logs"
  ON public.pro_subscription_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Usuarios pueden ver sus propios logs
DROP POLICY IF EXISTS "Users can view own pro logs" ON public.pro_subscription_logs;
CREATE POLICY "Users can view own pro logs"
  ON public.pro_subscription_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Trigger para actualizar estado is_pro automáticamente
CREATE OR REPLACE FUNCTION update_pro_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la fecha de fin es futura, es PRO. Si es pasada o nula, no es PRO.
  IF NEW.pro_subscription_end > NOW() THEN
    NEW.is_pro := TRUE;
  ELSE
    NEW.is_pro := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_pro_status ON public.profiles;
CREATE TRIGGER trg_update_pro_status
  BEFORE INSERT OR UPDATE OF pro_subscription_end ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_pro_status();

-- 4. Permitir a admins ver todos los perfiles (si no existe ya)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- 5. Vista de auditoría (opcional)
CREATE OR REPLACE VIEW view_pro_users_expiration AS
SELECT 
  id,
  email,
  full_name,
  pro_subscription_start,
  pro_subscription_end,
  EXTRACT(DAY FROM (pro_subscription_end - NOW()))::INTEGER as days_remaining
FROM public.profiles
WHERE is_pro = TRUE;
