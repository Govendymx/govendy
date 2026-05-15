-- Pocket - Reputación de vendedores (idempotente)
-- Ejecuta esto en Supabase → SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 100;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating_good_count INTEGER DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating_total_count INTEGER DEFAULT 0;

-- Nota:
-- - rating_good_count / rating_total_count sirven para calcular porcentaje.
-- - reputation_score sirve como fallback (0..100) si aún no tienes calificaciones registradas.

