-- Tabla para almacenar los métodos de pago configurados por los vendedores
CREATE TABLE IF NOT EXISTS seller_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('mercadopago', 'transferencia', 'oxxo', 'deposito', 'stripe', 'paypal', 'otro')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_seller_payment_methods_seller_id ON seller_payment_methods(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_payment_methods_type ON seller_payment_methods(method_type);

-- Actualizar tabla orders
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS payment_method_type TEXT DEFAULT 'platform' CHECK (payment_method_type IN ('platform', 'direct')),
  ADD COLUMN IF NOT EXISTS buyer_payment_voucher_url TEXT,
  ADD COLUMN IF NOT EXISTS seller_payment_details JSONB;

-- Si no tienes el enum completo de status, actualiza o asume que status es texto.
-- GoVendy usa TEXT con checks o enums? Usualmente texto. No hay constraint restrictivo en el script base a menos que esté definido.

-- Trigger para updated_at en seller_payment_methods
CREATE OR REPLACE FUNCTION update_seller_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_seller_payment_methods_updated_at ON seller_payment_methods;
CREATE TRIGGER trigger_update_seller_payment_methods_updated_at
  BEFORE UPDATE ON seller_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_payment_methods_updated_at();

-- Políticas RLS
ALTER TABLE seller_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payment methods" ON seller_payment_methods;
DROP POLICY IF EXISTS "Users can create payment methods" ON seller_payment_methods;
DROP POLICY IF EXISTS "Users can update their own payment methods" ON seller_payment_methods;
DROP POLICY IF EXISTS "Users can delete their own payment methods" ON seller_payment_methods;
DROP POLICY IF EXISTS "Public can view active payment methods" ON seller_payment_methods;

CREATE POLICY "Users can view their own payment methods"
  ON seller_payment_methods FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Public can view active payment methods"
  ON seller_payment_methods FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can create payment methods"
  ON seller_payment_methods FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update their own payment methods"
  ON seller_payment_methods FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Users can delete their own payment methods"
  ON seller_payment_methods FOR DELETE
  USING (auth.uid() = seller_id);

-- Comentarios
COMMENT ON TABLE seller_payment_methods IS 'Métodos de pago directos configurados por el vendedor para el pago P2P';
COMMENT ON COLUMN orders.payment_method_type IS 'Indica si el pago fue mediante plataforma (mercadopago) o directo al vendedor (direct)';
COMMENT ON COLUMN orders.buyer_payment_voucher_url IS 'URL de la imagen del comprobante de pago subido por el comprador';
COMMENT ON COLUMN orders.seller_payment_details IS 'Snapshot de los datos de pago del vendedor utilizados en esta orden';
