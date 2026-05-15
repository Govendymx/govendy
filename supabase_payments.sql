-- Pocket App - Pagos (MercadoPago / offline) y sesiones de checkout
-- Ejecuta este SQL en Supabase SQL Editor.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkout_status') THEN
    CREATE TYPE public.checkout_status AS ENUM ('created', 'pending', 'paid', 'failed', 'cancelled');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  payment_method TEXT NOT NULL DEFAULT 'mercadopago',
  status public.checkout_status NOT NULL DEFAULT 'created',

  amount NUMERIC NOT NULL DEFAULT 0,

  -- MercadoPago
  mp_preference_id TEXT NULL,
  mp_payment_id TEXT NULL,
  mp_status TEXT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable: borrar políticas si ya existen
DROP POLICY IF EXISTS "Buyer can read own checkout sessions" ON public.checkout_sessions;
DROP POLICY IF EXISTS "Buyer can insert own checkout sessions" ON public.checkout_sessions;
DROP POLICY IF EXISTS "Buyer can update own checkout sessions" ON public.checkout_sessions;

CREATE POLICY "Buyer can read own checkout sessions"
  ON public.checkout_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Buyer can insert own checkout sessions"
  ON public.checkout_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- Updates normalmente se hacen desde webhook (service role), pero permitimos al buyer actualizar campos no críticos si lo necesitas luego.
CREATE POLICY "Buyer can update own checkout sessions"
  ON public.checkout_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_checkout_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_checkout_sessions_updated_at ON public.checkout_sessions;
CREATE TRIGGER update_checkout_sessions_updated_at
  BEFORE UPDATE ON public.checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_checkout_updated_at();

