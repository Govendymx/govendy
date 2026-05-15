-- Pocket App - Lecturas de chat por orden (para "pendiente de contestar") (idempotente)
-- Ejecuta este SQL en Supabase (SQL Editor).

CREATE TABLE IF NOT EXISTS public.order_chat_reads (
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (order_id, user_id)
);

CREATE INDEX IF NOT EXISTS order_chat_reads_user_idx
  ON public.order_chat_reads (user_id, last_read_at DESC);

ALTER TABLE public.order_chat_reads ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable
DROP POLICY IF EXISTS "Users can read own order chat reads" ON public.order_chat_reads;
DROP POLICY IF EXISTS "Users can upsert own order chat reads" ON public.order_chat_reads;
DROP POLICY IF EXISTS "Admins can read all order chat reads" ON public.order_chat_reads;

-- Leer: solo buyer/seller de esa orden (y el registro del propio usuario)
CREATE POLICY "Users can read own order chat reads"
  ON public.order_chat_reads
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Insert/Update: solo su propio registro y debe ser participante
CREATE POLICY "Users can upsert own order chat reads"
  ON public.order_chat_reads
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Admin: ver todo (para auditoría)
CREATE POLICY "Admins can read all order chat reads"
  ON public.order_chat_reads
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

