-- Pocket App - Estados de usuario (Admin) (idempotente)
-- Permite suspender/bloquear usuarios y guardar notas administrativas.

CREATE TABLE IF NOT EXISTS public.user_admin_states (
  user_id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | banned
  suspended_until TIMESTAMP WITH TIME ZONE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_by UUID
);

ALTER TABLE public.user_admin_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own admin state" ON public.user_admin_states;
DROP POLICY IF EXISTS "Admins can read all admin states" ON public.user_admin_states;
DROP POLICY IF EXISTS "Admins can upsert admin states" ON public.user_admin_states;

-- Usuario: puede ver su estado (para mostrar avisos en la app)
CREATE POLICY "Users can read own admin state"
  ON public.user_admin_states
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin: puede leer todo
CREATE POLICY "Admins can read all admin states"
  ON public.user_admin_states
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Admin: puede crear/actualizar estados
CREATE POLICY "Admins can upsert admin states"
  ON public.user_admin_states
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update admin states" ON public.user_admin_states;
CREATE POLICY "Admins can update admin states"
  ON public.user_admin_states
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

