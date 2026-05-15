-- ============================================================
-- Sistema de Publicidad y Verificación de Pago
-- ============================================================

-- Tabla de campañas publicitarias
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  ad_type TEXT NOT NULL DEFAULT 'banner', -- banner | featured_listing | sidebar | popup | verification
  placement TEXT NOT NULL, -- home | listings | profile | checkout | all
  image_url TEXT,
  link_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | paused | expired | rejected
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  price_per_day NUMERIC NOT NULL DEFAULT 0,
  total_days INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | refunded
  payment_id TEXT, -- ID del pago en MercadoPago
  views_count INTEGER NOT NULL DEFAULT 0,
  clicks_count INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0, -- Mayor número = mayor prioridad
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_user_id ON public.ad_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON public.ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_placement ON public.ad_campaigns(placement);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_dates ON public.ad_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_active ON public.ad_campaigns(status, start_date, end_date) WHERE status = 'active';

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ad_campaigns
DROP POLICY IF EXISTS "Users can read own campaigns" ON public.ad_campaigns;
DROP POLICY IF EXISTS "Users can create own campaigns" ON public.ad_campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.ad_campaigns;
DROP POLICY IF EXISTS "Public can read active campaigns" ON public.ad_campaigns;
DROP POLICY IF EXISTS "Admins can read all campaigns" ON public.ad_campaigns;
DROP POLICY IF EXISTS "Admins can update all campaigns" ON public.ad_campaigns;

-- Usuario: puede leer sus propias campañas
CREATE POLICY "Users can read own campaigns"
  ON public.ad_campaigns
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Usuario: puede crear sus propias campañas
CREATE POLICY "Users can create own campaigns"
  ON public.ad_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Usuario: puede actualizar sus propias campañas (solo si están pendientes o rechazadas)
CREATE POLICY "Users can update own campaigns"
  ON public.ad_campaigns
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status IN ('pending', 'rejected'))
  WITH CHECK (user_id = auth.uid());

-- Público: puede leer campañas activas
CREATE POLICY "Public can read active campaigns"
  ON public.ad_campaigns
  FOR SELECT
  TO authenticated
  USING (status = 'active' AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));

-- Admin: puede leer todas las campañas
CREATE POLICY "Admins can read all campaigns"
  ON public.ad_campaigns
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Admin: puede actualizar todas las campañas
CREATE POLICY "Admins can update all campaigns"
  ON public.ad_campaigns
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Tabla de pagos de publicidad
CREATE TABLE IF NOT EXISTS public.ad_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'mercadopago', -- mercadopago | bank_transfer | bank_deposit
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | refunded
  mercado_pago_payment_id TEXT,
  mercado_pago_preference_id TEXT,
  external_reference TEXT NOT NULL, -- Para webhook de MercadoPago
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  paid_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_ad_payments_campaign_id ON public.ad_payments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_payments_user_id ON public.ad_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_payments_status ON public.ad_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_ad_payments_external_ref ON public.ad_payments(external_reference);

ALTER TABLE public.ad_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ad_payments
DROP POLICY IF EXISTS "Users can read own payments" ON public.ad_payments;
DROP POLICY IF EXISTS "Admins can read all payments" ON public.ad_payments;

CREATE POLICY "Users can read own payments"
  ON public.ad_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all payments"
  ON public.ad_payments
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Tabla de pagos de verificación
CREATE TABLE IF NOT EXISTS public.verification_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'mercadopago',
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | refunded
  mercado_pago_payment_id TEXT,
  mercado_pago_preference_id TEXT,
  external_reference TEXT NOT NULL,
  verification_granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  paid_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refund_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_verification_payments_user_id ON public.verification_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_payments_status ON public.verification_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_verification_payments_external_ref ON public.verification_payments(external_reference);

ALTER TABLE public.verification_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para verification_payments
DROP POLICY IF EXISTS "Users can read own verification payments" ON public.verification_payments;
DROP POLICY IF EXISTS "Admins can read all verification payments" ON public.verification_payments;

CREATE POLICY "Users can read own verification payments"
  ON public.verification_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all verification payments"
  ON public.verification_payments
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Tabla de estadísticas de publicidad (clicks, views)
CREATE TABLE IF NOT EXISTS public.ad_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- view | click
  user_id UUID REFERENCES auth.users(id),
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_ad_stats_campaign_id ON public.ad_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_stats_created_at ON public.ad_stats(created_at);

ALTER TABLE public.ad_stats ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden leer estadísticas
DROP POLICY IF EXISTS "Admins can read ad stats" ON public.ad_stats;
CREATE POLICY "Admins can read ad stats"
  ON public.ad_stats
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Función para actualizar contadores de campaña
CREATE OR REPLACE FUNCTION public.update_ad_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type = 'view' THEN
    UPDATE public.ad_campaigns
    SET views_count = views_count + 1
    WHERE id = NEW.campaign_id;
  ELSIF NEW.event_type = 'click' THEN
    UPDATE public.ad_campaigns
    SET clicks_count = clicks_count + 1
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ad_campaign_stats ON public.ad_stats;
CREATE TRIGGER trigger_update_ad_campaign_stats
  AFTER INSERT ON public.ad_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ad_campaign_stats();

-- Agregar precio de verificación a app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS verification_price NUMERIC NOT NULL DEFAULT 50.00;

COMMENT ON TABLE public.ad_campaigns IS 'Campañas publicitarias que los usuarios pueden comprar';
COMMENT ON TABLE public.ad_payments IS 'Pagos realizados por campañas publicitarias';
COMMENT ON TABLE public.verification_payments IS 'Pagos realizados para obtener verificación';
COMMENT ON TABLE public.ad_stats IS 'Estadísticas de visualizaciones y clicks de publicidad';
