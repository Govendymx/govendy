-- Add store cashback configuration columns to profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'store_cashback_enabled') THEN
        ALTER TABLE profiles ADD COLUMN store_cashback_enabled BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'store_cashback_percent') THEN
        ALTER TABLE profiles ADD COLUMN store_cashback_percent NUMERIC(5,2) DEFAULT 0;
    END IF;
END $$;
