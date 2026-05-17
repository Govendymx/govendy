-- Script para agregar las columnas faltantes a la tabla app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS verification_price numeric DEFAULT 50;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS commission_basic_percent numeric DEFAULT 23;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS commission_pro_percent numeric DEFAULT 18;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS commission_platinum_percent numeric DEFAULT 18;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS cashback_enabled boolean DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS cashback_percent numeric DEFAULT 0;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS cashback_start_date timestamp with time zone;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS cashback_end_date timestamp with time zone;
