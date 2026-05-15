-- Guía de devolución en disputas: URL, rastreo y a quién se cobra
-- Ejecuta en Supabase → SQL Editor

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS return_guide_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS return_tracking TEXT NULL,
  ADD COLUMN IF NOT EXISTS return_guide_charged_to TEXT NULL; -- 'buyer' | 'seller'

COMMENT ON COLUMN public.disputes.return_guide_url IS 'URL de la guía de devolución (upload)';
COMMENT ON COLUMN public.disputes.return_tracking IS 'Número de rastreo de la guía';
COMMENT ON COLUMN public.disputes.return_guide_charged_to IS 'Guía con cargo a: buyer | seller';
