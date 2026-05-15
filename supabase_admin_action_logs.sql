-- ============================================================
-- TABLA DE LOGS DE ACCIONES ADMINISTRATIVAS
-- Sistema de auditoría para todas las acciones de administradores
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'suspend_user', 'ban_user', 'delete_user', 'approve_payment', etc.
  target_user_id UUID,
  target_entity_type TEXT, -- 'user', 'order', 'listing', etc.
  target_entity_id TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_action_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON public.admin_action_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_entity ON public.admin_action_logs(target_entity_type, target_entity_id);

-- Comentarios
COMMENT ON TABLE public.admin_action_logs IS 'Logs de auditoría para todas las acciones realizadas por administradores';
COMMENT ON COLUMN public.admin_action_logs.action IS 'Tipo de acción: suspend_user, ban_user, delete_user, approve_payment, etc.';
COMMENT ON COLUMN public.admin_action_logs.target_user_id IS 'ID del usuario afectado (si aplica)';
COMMENT ON COLUMN public.admin_action_logs.target_entity_type IS 'Tipo de entidad afectada: user, order, listing, etc.';
COMMENT ON COLUMN public.admin_action_logs.metadata IS 'Datos adicionales de la acción en formato JSON';

-- RLS: Solo admins pueden leer logs
ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden leer logs
DROP POLICY IF EXISTS "Admins can read action logs" ON public.admin_action_logs;
CREATE POLICY "Admins can read action logs"
  ON public.admin_action_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Política: Service role puede insertar logs (para APIs server-side)
-- Nota: Las APIs usarán service_role, así que no necesitamos política de INSERT para usuarios

-- Verificación final
SELECT 
  '✅ VERIFICACIÓN COMPLETA' as estado,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_action_logs') as tabla_creada,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'admin_action_logs') as indices_creados;
