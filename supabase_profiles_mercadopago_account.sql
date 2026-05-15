-- Pocket - Agregar campo de cuenta de MercadoPago en profiles (idempotente)
-- Ejecuta esto en Supabase → SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mercadopago_account TEXT;

-- Comentario
COMMENT ON COLUMN public.profiles.mercadopago_account IS 'Email o ID de cuenta de MercadoPago para recibir pagos';
