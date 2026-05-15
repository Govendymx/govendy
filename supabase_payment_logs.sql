-- ============================================================
-- TABLA DE LOGS DE PAGOS
-- Sistema de auditoría y análisis de pagos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL,
  external_reference TEXT,
  status TEXT NOT NULL, -- 'success' | 'error'
  stage TEXT NOT NULL, -- 'validation', 'processing', 'notification', etc.
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON public.payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_external_ref ON public.payment_logs(external_reference);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status ON public.payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created ON public.payment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_stage ON public.payment_logs(stage);

-- Comentarios
COMMENT ON TABLE public.payment_logs IS 'Logs de auditoría para todos los pagos procesados en el sistema';
COMMENT ON COLUMN public.payment_logs.payment_id IS 'ID del pago (MercadoPago ID o checkout ID)';
COMMENT ON COLUMN public.payment_logs.external_reference IS 'Referencia externa (checkout_id, order_id, etc.)';
COMMENT ON COLUMN public.payment_logs.stage IS 'Etapa del proceso donde ocurrió el log (validation, processing, notification, etc.)';
COMMENT ON COLUMN public.payment_logs.metadata IS 'Datos adicionales del log en formato JSON';

-- RLS: Solo admins pueden leer logs
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden leer logs
DROP POLICY IF EXISTS "Admins can read payment logs" ON public.payment_logs;
CREATE POLICY "Admins can read payment logs"
  ON public.payment_logs
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
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_logs') as tabla_creada,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'payment_logs') as indices_creados;
