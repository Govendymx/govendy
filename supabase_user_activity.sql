-- Pocket App - Tabla de actividad de usuarios (idempotente)
-- Almacena la última actividad de cada usuario para rastrear usuarios conectados

CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id UUID PRIMARY KEY,
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Índice para consultas rápidas de usuarios activos
CREATE INDEX IF NOT EXISTS idx_user_activity_last_activity_at ON public.user_activity(last_activity_at DESC);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can update own activity" ON public.user_activity;
DROP POLICY IF EXISTS "Admins can read all activity" ON public.user_activity;

-- Usuario: puede actualizar su propia actividad
CREATE POLICY "Users can update own activity"
  ON public.user_activity
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin: puede leer toda la actividad
CREATE POLICY "Admins can read all activity"
  ON public.user_activity
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Función para actualizar o insertar actividad (upsert)
CREATE OR REPLACE FUNCTION public.upsert_user_activity(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_activity (user_id, last_activity_at, updated_at)
  VALUES (p_user_id, TIMEZONE('utc'::text, NOW()), TIMEZONE('utc'::text, NOW()))
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    last_activity_at = TIMEZONE('utc'::text, NOW()),
    updated_at = TIMEZONE('utc'::text, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
