-- Este script agrega la columna paid_at a la tabla orders si no existe.
-- Es necesario porque múltiples partes del sistema (Webhooks de MercadoPago, Pagos Offline, Logística) la utilizan.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

-- Opcional: También agregamos delivery_proof_url y otros si faltan
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_proof_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_proof_downloaded_at timestamp with time zone;
