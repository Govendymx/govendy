ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_source text DEFAULT 'checkout';
NOTIFY pgrst, reload_schema;
