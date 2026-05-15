-- Tabla para almacenar cotizaciones y compras de guías Estafeta
CREATE TABLE IF NOT EXISTS estafeta_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Datos del paquete
  weight_kg NUMERIC(10, 2) NOT NULL CHECK (weight_kg > 0),
  length_cm NUMERIC(10, 2) NOT NULL CHECK (length_cm > 0),
  width_cm NUMERIC(10, 2) NOT NULL CHECK (width_cm > 0),
  height_cm NUMERIC(10, 2) NOT NULL CHECK (height_cm > 0),
  
  -- Datos del remitente
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  sender_between_streets TEXT NOT NULL,
  sender_references TEXT NOT NULL,
  sender_city TEXT NOT NULL,
  sender_state TEXT NOT NULL,
  sender_postal_code TEXT NOT NULL,
  
  -- Datos del destinatario
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  recipient_between_streets TEXT NOT NULL,
  recipient_references TEXT NOT NULL,
  recipient_city TEXT NOT NULL,
  recipient_state TEXT NOT NULL,
  recipient_postal_code TEXT NOT NULL,
  
  -- Costo y pago
  calculated_cost NUMERIC(10, 2) NOT NULL CHECK (calculated_cost >= 0),
  status TEXT NOT NULL DEFAULT 'quote' CHECK (status IN ('quote', 'pending_payment', 'paid', 'processing', 'completed', 'cancelled')),
  
  -- MercadoPago
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  mp_payment_status TEXT,
  
  -- Archivo de guía (subido por admin)
  guide_file_url TEXT,
  guide_uploaded_at TIMESTAMPTZ,
  guide_uploaded_by UUID REFERENCES auth.users(id),
  
  -- Datos adicionales
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_user_id ON estafeta_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_status ON estafeta_quotes(status);
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_created_at ON estafeta_quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_mp_preference_id ON estafeta_quotes(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_mp_payment_id ON estafeta_quotes(mp_payment_id);

-- RLS Policies
ALTER TABLE estafeta_quotes ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view their own quotes" ON estafeta_quotes;
DROP POLICY IF EXISTS "Users can create quotes" ON estafeta_quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON estafeta_quotes;
DROP POLICY IF EXISTS "Admins can view all quotes" ON estafeta_quotes;
DROP POLICY IF EXISTS "Admins can update all quotes" ON estafeta_quotes;

-- Los usuarios pueden ver sus propias cotizaciones
CREATE POLICY "Users can view their own quotes"
  ON estafeta_quotes FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios pueden crear cotizaciones
CREATE POLICY "Users can create quotes"
  ON estafeta_quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios pueden actualizar sus propias cotizaciones (solo si están en quote o pending_payment)
CREATE POLICY "Users can update their own quotes"
  ON estafeta_quotes FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('quote', 'pending_payment'))
  WITH CHECK (auth.uid() = user_id);

-- Los admins pueden ver todas las cotizaciones
CREATE POLICY "Admins can view all quotes"
  ON estafeta_quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- Los admins pueden actualizar todas las cotizaciones
CREATE POLICY "Admins can update all quotes"
  ON estafeta_quotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_estafeta_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_estafeta_quotes_updated_at ON estafeta_quotes;
CREATE TRIGGER trigger_update_estafeta_quotes_updated_at
  BEFORE UPDATE ON estafeta_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_estafeta_quotes_updated_at();

-- Comentarios
COMMENT ON TABLE estafeta_quotes IS 'Cotizaciones y compras de guías de envío Estafeta';
COMMENT ON COLUMN estafeta_quotes.status IS 'Estado: quote (solo cotización), pending_payment (pendiente de pago), paid (pagado), processing (procesando), completed (completado con guía), cancelled (cancelado)';
COMMENT ON COLUMN estafeta_quotes.guide_file_url IS 'URL del archivo de guía subido por el administrador';
COMMENT ON COLUMN estafeta_quotes.guide_uploaded_by IS 'ID del administrador que subió la guía';
