-- Add commission_platinum_percent column to app_settings
-- Default: 18% for Plan Platinum

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS commission_platinum_percent numeric(5,2) NOT NULL DEFAULT 18;
