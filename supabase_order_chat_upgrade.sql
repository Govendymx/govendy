-- Pocket App - Upgrade chat de órdenes: adjuntos + roles + acceso admin (idempotente)
-- Ejecuta este SQL en Supabase (SQL Editor).

-- 1) Columnas nuevas (compatibles)
ALTER TABLE public.order_messages
  ADD COLUMN IF NOT EXISTS sender_role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.order_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) RLS (extender para admins)
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable
DROP POLICY IF EXISTS "Participants can read order messages" ON public.order_messages;
DROP POLICY IF EXISTS "Participants can send order messages" ON public.order_messages;
DROP POLICY IF EXISTS "Participants can read order messages (v2)" ON public.order_messages;
DROP POLICY IF EXISTS "Buyer/Seller can send order messages (v2)" ON public.order_messages;
DROP POLICY IF EXISTS "Admins can read all order messages (v2)" ON public.order_messages;
DROP POLICY IF EXISTS "Admins can send order messages (v2)" ON public.order_messages;

-- Lectura: buyer o seller de la orden
CREATE POLICY "Participants can read order messages (v2)"
  ON public.order_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Lectura: admins pueden leer todo
CREATE POLICY "Admins can read all order messages (v2)"
  ON public.order_messages
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Insert: buyer/seller (rol buyer/seller) y sender_id debe ser el mismo usuario
CREATE POLICY "Buyer/Seller can send order messages (v2)"
  ON public.order_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role IN ('buyer','seller')
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Insert: admin (rol admin)
CREATE POLICY "Admins can send order messages (v2)"
  ON public.order_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'admin'
    AND EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

