-- Add 'pocketcash' to payment_method enum if it exists
DO $$
BEGIN
  -- Check if payment_method type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'pocketcash';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;
