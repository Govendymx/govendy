-- Pocket App - Checkout sessions (offline refs) (idempotente)
-- Agrega referencia alfanumérica para pagos offline y campos extra.

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS reference_code TEXT;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS offline_instructions JSONB;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS paid_confirmed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS paid_confirmed_by UUID;

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_reference_code_uniq
  ON public.checkout_sessions (reference_code)
  WHERE reference_code IS NOT NULL AND reference_code <> '';

