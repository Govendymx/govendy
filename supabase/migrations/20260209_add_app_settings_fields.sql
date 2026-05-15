-- Add dynamic configuration columns to app_settings table
DO $$
BEGIN
    -- Commissions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'commission_basic_percent') THEN
        ALTER TABLE app_settings ADD COLUMN commission_basic_percent NUMERIC(5,2) DEFAULT 23;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'commission_pro_percent') THEN
        ALTER TABLE app_settings ADD COLUMN commission_pro_percent NUMERIC(5,2) DEFAULT 18;
    END IF;

    -- Global Cashback
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_enabled') THEN
        ALTER TABLE app_settings ADD COLUMN cashback_enabled BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_percent') THEN
        ALTER TABLE app_settings ADD COLUMN cashback_percent NUMERIC(5,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_start_date') THEN
        ALTER TABLE app_settings ADD COLUMN cashback_start_date TIMESTAMPTZ DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'cashback_end_date') THEN
        ALTER TABLE app_settings ADD COLUMN cashback_end_date TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;
