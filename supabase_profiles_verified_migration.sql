-- Pocket - Migración: columna is_verified en profiles (idempotente)
-- Ejecuta esto en el SQL Editor de Supabase.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false NOT NULL;

-- Índice para búsquedas rápidas de usuarios verificados
CREATE INDEX IF NOT EXISTS profiles_is_verified_idx ON public.profiles (is_verified) WHERE is_verified = true;

COMMENT ON COLUMN public.profiles.is_verified IS 'Indica si el usuario tiene la insignia de verificado (asignada por administradores)';
