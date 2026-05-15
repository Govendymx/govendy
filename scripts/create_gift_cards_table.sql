-- ============================================
-- Gift Cards Table for PocketCash
-- ============================================

CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'cancelled')),
  purchased_by UUID NOT NULL REFERENCES auth.users(id),
  redeemed_by UUID REFERENCES auth.users(id),
  order_id UUID,
  for_self BOOLEAN NOT NULL DEFAULT false,
  recipient_email TEXT,
  message TEXT,
  payment_method TEXT NOT NULL DEFAULT 'pocketcash' CHECK (payment_method IN ('mercadopago', 'pocketcash', 'bank_transfer', 'bank_deposit', 'oxxo')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  mercadopago_preference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_purchased_by ON gift_cards(purchased_by);
CREATE INDEX IF NOT EXISTS idx_gift_cards_redeemed_by ON gift_cards(redeemed_by);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_payment_status ON gift_cards(payment_status);

-- RLS
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

-- Buyers can see their purchased cards
CREATE POLICY "Users can view their purchased gift cards"
  ON gift_cards FOR SELECT
  USING (auth.uid() = purchased_by);

-- Redeemers can see cards they redeemed
CREATE POLICY "Users can view their redeemed gift cards"
  ON gift_cards FOR SELECT
  USING (auth.uid() = redeemed_by);

-- Service role has full access (for API routes)
CREATE POLICY "Service role full access"
  ON gift_cards FOR ALL
  USING (true)
  WITH CHECK (true);

-- Rate Limiting table for redeem attempts
CREATE TABLE IF NOT EXISTS gift_card_redeem_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  code_attempted TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redeem_attempts_user ON gift_card_redeem_attempts(user_id, created_at);
