-- Migración para agregar configuración de Comisiones y Cashback Global a app_settings
-- Ejecuta este script en el SQL Editor de Supabase para habilitar estas funciones

-- 1. Agregar columnas para Comisiones de Venta (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'commission_basic_percent') THEN
        ALTER TABLE public.app_settings ADD COLUMN commission_basic_percent numeric DEFAULT 23;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'commission_pro_percent') THEN
        ALTER TABLE public.app_settings ADD COLUMN commission_pro_percent numeric DEFAULT 18;
    END IF;
END $$;

-- 2. Agregar columnas para Cashback Global (si no existen)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_enabled') THEN
        ALTER TABLE public.app_settings ADD COLUMN cashback_enabled boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_percent') THEN
        ALTER TABLE public.app_settings ADD COLUMN cashback_percent numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_start_date') THEN
        ALTER TABLE public.app_settings ADD COLUMN cashback_start_date timestamptz NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_end_date') THEN
        ALTER TABLE public.app_settings ADD COLUMN cashback_end_date timestamptz NULL;
    END IF;
END $$;

-- 3. Actualizar comentarios para documentación
COMMENT ON COLUMN public.app_settings.commission_basic_percent IS 'Porcentaje de comisión para usuarios Plan Básico (default 23%)';
COMMENT ON COLUMN public.app_settings.commission_pro_percent IS 'Porcentaje de comisión para usuarios Plan PRO (default 18%)';
COMMENT ON COLUMN public.app_settings.cashback_enabled IS 'Interruptor maestro para el Cashback Global';
COMMENT ON COLUMN public.app_settings.cashback_percent IS 'Porcentaje de devolución global (ej. 3%)';

-- 4. Recargar el esquema de caché (esto es automático en Supabase, pero bueno saberlo)
NOTIFY pgrst, 'reload config';
