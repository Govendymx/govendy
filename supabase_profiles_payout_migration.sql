-- Pocket - Migración: datos de cobro (payout) en profiles (idempotente)
-- Ejecuta esto en Supabase → SQL Editor.
--
-- Campos sugeridos (MX):
-- - payout_bank_name: Banco (Ej: BBVA)
-- - payout_account_holder: Titular
-- - payout_clabe: CLABE (18 dígitos)
-- - payout_account_number: (opcional) número de cuenta (si lo usan)
-- - payout_notes: notas (opcional)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_bank_name TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_account_holder TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_clabe TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_notes TEXT;

