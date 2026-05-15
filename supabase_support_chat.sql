-- Pocket App - Soporte (conversaciones + mensajes) para Admin → Soporte
-- Ejecuta este SQL en Supabase (SQL Editor). Es idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_conversation_status') THEN
    CREATE TYPE public.support_conversation_status AS ENUM ('open', 'closed');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  status public.support_conversation_status NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  -- WhatsApp-like PRO:
  -- Asignación (para que un agente "tome" el chat)
  assigned_admin_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NULL,
  -- No leídos
  last_read_by_admin_at TIMESTAMP WITH TIME ZONE NULL,
  last_read_by_user_at TIMESTAMP WITH TIME ZONE NULL,
  -- Entrega (✓ cuando el usuario recibe el mensaje)
  last_delivered_to_user_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Idempotente: si la tabla ya existía, asegurar columnas PRO
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS last_read_by_admin_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS last_read_by_user_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS last_delivered_to_user_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS support_conversations_status_last_idx
  ON public.support_conversations (status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS support_conversations_created_by_idx
  ON public.support_conversations (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS support_conversations_assigned_status_last_idx
  ON public.support_conversations (assigned_admin_id, status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin' (texto simple para compatibilidad)
  body TEXT NOT NULL DEFAULT '',
  -- Adjuntos (PRO): fotos/archivos
  attachment_url TEXT NULL,
  attachment_name TEXT NULL,
  attachment_mime TEXT NULL,
  attachment_size INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Idempotente: asegurar columnas de adjuntos en mensajes
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT NULL;
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_name TEXT NULL;
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT NULL;
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER NULL;

CREATE INDEX IF NOT EXISTS support_messages_conversation_created_idx
  ON public.support_messages (conversation_id, created_at ASC);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable
DROP POLICY IF EXISTS "Users can read own support conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Users can insert own support conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Admins can read all support conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Admins can update all support conversations" ON public.support_conversations;

DROP POLICY IF EXISTS "Users can read own support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users can insert own support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Admins can read all support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Admins can insert support messages" ON public.support_messages;

-- Conversaciones: el usuario ve las suyas
CREATE POLICY "Users can read own support conversations"
  ON public.support_conversations
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Conversaciones: el usuario crea las suyas
CREATE POLICY "Users can insert own support conversations"
  ON public.support_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Admins: ver todo (si está en admin_users)
CREATE POLICY "Admins can read all support conversations"
  ON public.support_conversations
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Admins: actualizar (cerrar/abrir)
CREATE POLICY "Admins can update all support conversations"
  ON public.support_conversations
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Mensajes: el usuario ve mensajes de sus conversaciones
CREATE POLICY "Users can read own support messages"
  ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
  );

-- Mensajes: el usuario puede enviar en sus conversaciones
CREATE POLICY "Users can insert own support messages"
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    sender_role = 'user' AND
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
  );

-- Admins: leer todos los mensajes
CREATE POLICY "Admins can read all support messages"
  ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Admins: enviar mensajes (sender_role='admin')
CREATE POLICY "Admins can insert support messages"
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    sender_role = 'admin' AND
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- Trigger para updated_at y last_message_at (best-effort)
CREATE OR REPLACE FUNCTION public.support_touch_conversation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_conversations
  SET updated_at = TIMEZONE('utc'::text, NOW()),
      last_message_at = TIMEZONE('utc'::text, NOW())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS support_touch_conversation_trigger ON public.support_messages;
CREATE TRIGGER support_touch_conversation_trigger
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.support_touch_conversation();

