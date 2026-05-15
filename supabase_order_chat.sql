-- Pocket App - Chat comprador ↔ vendedor por operación (order)
-- Ejecuta este SQL en Supabase (SQL Editor). Es idempotente.

CREATE TABLE IF NOT EXISTS public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS order_messages_order_created_idx
  ON public.order_messages (order_id, created_at DESC);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable
DROP POLICY IF EXISTS "Participants can read order messages" ON public.order_messages;
DROP POLICY IF EXISTS "Participants can send order messages" ON public.order_messages;

-- Leer: solo buyer/seller de esa orden
CREATE POLICY "Participants can read order messages"
  ON public.order_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Insert: solo buyer/seller y el sender_id debe ser el mismo usuario
CREATE POLICY "Participants can send order messages"
  ON public.order_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

