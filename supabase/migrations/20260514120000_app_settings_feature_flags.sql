-- Feature flags centralizados (interruptores globales) en app_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'feature_flags'
  ) THEN
    ALTER TABLE public.app_settings
      ADD COLUMN feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.app_settings.feature_flags IS 'Interruptores globales (JSON). Ej.: {"gopocket_shipping": true}';
  END IF;
END $$;
