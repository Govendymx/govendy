-- Pocket - Tabla de retiros a vendedores (MercadoPago)
-- Ejecuta en Supabase → SQL Editor.
-- Usada por /api/payouts/withdraw para registrar retiros y evitar doble pago.

CREATE TABLE IF NOT EXISTS public.seller_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  order_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  mp_transfer_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seller_withdrawals_seller_status_idx
  ON public.seller_withdrawals (seller_id, status);
CREATE INDEX IF NOT EXISTS seller_withdrawals_created_idx
  ON public.seller_withdrawals (created_at DESC);

ALTER TABLE public.seller_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can read own withdrawals" ON public.seller_withdrawals;
CREATE POLICY "Sellers can read own withdrawals"
  ON public.seller_withdrawals FOR SELECT
  USING (auth.uid() = seller_id);

COMMENT ON TABLE public.seller_withdrawals IS 'Retiros a vendedores vía MercadoPago; order_ids = órdenes incluidas en el retiro';
