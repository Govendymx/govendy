-- Crear tabla para almacenar las solicitudes de planes y verificación
CREATE TABLE IF NOT EXISTS public.plan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_plan TEXT NOT NULL, -- 'pro', 'platinum', 'verification'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'contacted', 'resolved', 'rejected'
  contact_preference TEXT, -- 'whatsapp', 'email', 'phone'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;

-- Políticas
-- Usuarios pueden ver sus propias solicitudes
CREATE POLICY "Users can view their own requests"
  ON public.plan_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Usuarios pueden insertar sus propias solicitudes
CREATE POLICY "Users can insert their own requests"
  ON public.plan_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Administradores pueden ver y editar todas las solicitudes
CREATE POLICY "Admins can view and edit plan requests"
  ON public.plan_requests
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- Trigger para updated_at (opcional, si tienes la función handle_updated_at)
-- CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.plan_requests
--   FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
