ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT;
COMMENT ON COLUMN public.orders.delivery_proof_url IS 'URL de la evidencia de entrega (foto firmada) para entregas personales';
