-- =============================================================================
-- GoVendy — Monedero PocketCash (wallets + wallet_transactions)
-- Idempotente. Ejecutar en Supabase → SQL Editor
-- Coincide con lib/services/wallet (user_id como clave)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency TEXT NOT NULL DEFAULT 'MXN',
  is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_transaction_type') THEN
    CREATE TYPE public.wallet_transaction_type AS ENUM ('credit', 'debit');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_reference_type') THEN
    CREATE TYPE public.wallet_reference_type AS ENUM (
      'order', 'refund', 'admin_gift', 'cashback', 'withdrawal', 'manual_adjustment'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(user_id) ON DELETE CASCADE,
  type public.wallet_transaction_type NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  concept TEXT NOT NULL,
  reference_type public.wallet_reference_type NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id
  ON public.wallet_transactions(wallet_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at
  ON public.wallet_transactions(created_at DESC);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  USING (wallet_id = auth.uid());

DROP POLICY IF EXISTS "Admins can do everything on wallets" ON public.wallets;
CREATE POLICY "Admins can do everything on wallets"
  ON public.wallets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can do everything on wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Admins can do everything on wallet transactions"
  ON public.wallet_transactions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Wallets para usuarios que ya existían (sin wallet)
INSERT INTO public.wallets (user_id, balance)
SELECT u.id, 0
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallets w WHERE w.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE public.wallets IS 'Saldo PocketCash por usuario (user_id = PK).';
