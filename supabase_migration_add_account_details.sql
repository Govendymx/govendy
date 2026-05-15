-- Agregar columna account_details a seller_withdrawals
ALTER TABLE public.seller_withdrawals
ADD COLUMN IF NOT EXISTS account_details TEXT;
