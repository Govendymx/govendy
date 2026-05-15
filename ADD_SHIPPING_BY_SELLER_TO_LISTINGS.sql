-- Add shipping_by_seller column to listings table
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS shipping_by_seller BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.listings.shipping_by_seller IS 'Indica si el vendedor se encarga del envío por su cuenta (sin guía de la plataforma)';
