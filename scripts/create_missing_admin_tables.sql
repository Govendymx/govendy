-- ============================================================
-- GoVendy: Tablas faltantes que causan errores en el admin
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. seller_withdrawals (causa error 500 en /admin/retiros y /admin/finanzas)
CREATE TABLE IF NOT EXISTS public.seller_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'transfer',
  payment_details JSONB DEFAULT '{}',
  admin_notes TEXT,
  reference_number TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para seller_withdrawals
CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_seller_id ON public.seller_withdrawals(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_status ON public.seller_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_seller_withdrawals_created_at ON public.seller_withdrawals(created_at DESC);

-- RLS para seller_withdrawals
ALTER TABLE public.seller_withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sellers can view own withdrawals" ON public.seller_withdrawals;
DROP POLICY IF EXISTS "Sellers can request withdrawals" ON public.seller_withdrawals;

CREATE POLICY "Sellers can view own withdrawals"
  ON public.seller_withdrawals FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can request withdrawals"
  ON public.seller_withdrawals FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- 2. audit_logs (causa "No hay actividad reciente" en /admin)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- Sólo admins pueden leer audit logs
DROP POLICY IF EXISTS "Admin can read audit logs" ON public.audit_logs;
CREATE POLICY "Admin can read audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
    )
  );

-- 3. admin_floating_messages (causa error 500 en el header del admin)
CREATE TABLE IF NOT EXISTS public.admin_floating_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  section TEXT NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_floating_messages_section ON public.admin_floating_messages(section);
CREATE INDEX IF NOT EXISTS idx_admin_floating_messages_active ON public.admin_floating_messages(is_active);

ALTER TABLE public.admin_floating_messages ENABLE ROW LEVEL SECURITY;
-- Todos los usuarios autenticados pueden leer mensajes flotantes (para mostrarlos en el admin)
DROP POLICY IF EXISTS "Authenticated can read floating messages" ON public.admin_floating_messages;
CREATE POLICY "Authenticated can read floating messages"
  ON public.admin_floating_messages FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================================
-- VERIFICACION
-- ============================================================
SELECT 
  tablename,
  CASE WHEN tablename IS NOT NULL THEN '✅ Creada' ELSE '❌ Error' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('seller_withdrawals', 'audit_logs', 'admin_floating_messages')
ORDER BY tablename;
