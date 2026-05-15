-- Reparar columnas faltantes en la tabla 'listings'
-- Copia y pega todo este código en el SQL Editor de Supabase y dale a 'Run'

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS description_blocks JSONB,
ADD COLUMN IF NOT EXISTS description_blocks_meta JSONB,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS attributes JSONB,
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
ADD COLUMN IF NOT EXISTS shipping_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_subsidy NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_by_seller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allow_personal_delivery BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS handling_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS length_cm NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS width_cm NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS height_cm NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS featured_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auction_start_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auction_end_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auction_starting_bid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auction_bid_increment NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auction_highest_bid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

-- Nota: Si después de ejecutar esto sigue apareciendo el error 'schema cache', 
-- espera 30 segundos o recarga la página de Supabase para que el cache se actualice.

