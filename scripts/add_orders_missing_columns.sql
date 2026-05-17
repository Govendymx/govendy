ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_source text DEFAULT 'checkout',
ADD COLUMN IF NOT EXISTS shipping_method text,
ADD COLUMN IF NOT EXISTS payment_method_type text,
ADD COLUMN IF NOT EXISTS isr_withheld numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_withheld numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS coupon_code text,
ADD COLUMN IF NOT EXISTS coupon_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_subsidy numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS t1_quote_token text;

NOTIFY pgrst, 'reload schema';
