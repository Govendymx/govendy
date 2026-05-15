-- Tabla centralizada para registrar eventos operativos y actividad del sistema
-- Para uso del Panel de Administración (Activity Feed)

CREATE TABLE IF NOT EXISTS public.admin_operation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'quote', 'payment_attempt', 'payment_approved', 'shipping_error', 'manual_approval', etc.
  entity_type TEXT NOT NULL, -- 'order', 'estafeta_quote', 'payment', 'user', 'system'
  entity_id TEXT NOT NULL, -- ID de la entidad relacionada (order_id, quote_id, etc.)
  user_id UUID, -- Usuario que originó el evento (puede ser NULL si es webhook)
  admin_id UUID, -- Admin que realizó la acción (si aplica)
  severity TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
  details JSONB DEFAULT '{}'::jsonb, -- Detalles técnicos, mensajes de error, montos, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE, -- Para marcar si el admin ya revisó/actuó
  is_read BOOLEAN DEFAULT FALSE -- Para alertas no leídas
);

-- Índices para búsqueda rápida en el feed
CREATE INDEX IF NOT EXISTS idx_admin_events_created_at ON public.admin_operation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_events_severity ON public.admin_operation_events(severity);
CREATE INDEX IF NOT EXISTS idx_admin_events_type ON public.admin_operation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_events_entity ON public.admin_operation_events(entity_type, entity_id);

-- RLS Policies
ALTER TABLE public.admin_operation_events ENABLE ROW LEVEL SECURITY;

-- Admins pueden ver todo
DROP POLICY IF EXISTS "Admins can view all events" ON public.admin_operation_events;
CREATE POLICY "Admins can view all events"
  ON public.admin_operation_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- Service Role puede insertar (para webhooks y APIs)
-- Nota: Supabase Service Role salta RLS, pero definimos policy para inserts autenticados si fuera necesario
DROP POLICY IF EXISTS "Server can insert events" ON public.admin_operation_events;
CREATE POLICY "Server can insert events"
  ON public.admin_operation_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Permitir inserts autenticados (restringir más si es necesario)

-- Comentarios
COMMENT ON TABLE public.admin_operation_events IS 'Log centralizado de operaciones críticas para el dashboard de administración';
