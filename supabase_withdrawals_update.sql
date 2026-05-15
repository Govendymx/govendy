-- Pocket - Add account_details to seller_withdrawals
-- Ejecuta en Supabase → SQL Editor.

ALTER TABLE public.seller_withdrawals
  ADD COLUMN IF NOT EXISTS account_details TEXT NULL;

COMMENT ON COLUMN public.seller_withdrawals.account_details IS 'Detalles de la cuenta para transferencia manual (CBU, Alias, etc.)';
