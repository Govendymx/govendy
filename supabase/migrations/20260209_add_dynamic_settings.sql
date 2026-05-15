
-- Add dynamic commission and cashback settings to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS commission_basic_percent NUMERIC NOT NULL DEFAULT 23,
  ADD COLUMN IF NOT EXISTS commission_pro_percent NUMERIC NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS cashback_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cashback_percent NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_start_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cashback_end_date TIMESTAMP WITH TIME ZONE;

-- Add store-specific cashback settings to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_cashback_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS store_cashback_percent NUMERIC NOT NULL DEFAULT 0;

-- Comment on columns for clarity
COMMENT ON COLUMN public.app_settings.commission_basic_percent IS 'Porcentaje de comisión para usuarios Plan Básico (default 23)';
COMMENT ON COLUMN public.app_settings.commission_pro_percent IS 'Porcentaje de comisión para usuarios Plan PRO (default 18)';
COMMENT ON COLUMN public.app_settings.cashback_enabled IS 'Activa/Desactiva cashback global de la plataforma';
COMMENT ON COLUMN public.app_settings.cashback_percent IS 'Porcentaje de cashback global (ej. 3 para 3%)';
COMMENT ON COLUMN public.profiles.store_cashback_enabled IS 'Si la tienda ofrece cashback propio';
COMMENT ON COLUMN public.profiles.store_cashback_percent IS 'Porcentaje de cashback propio de la tienda';
