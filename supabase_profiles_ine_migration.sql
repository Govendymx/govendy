-- Pocket - Migración: columnas INE en profiles (idempotente)
-- Ejecuta esto en el SQL Editor de Supabase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ine_front_url TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ine_back_url TEXT;

-- (Opcional) si quieres timestamps al actualizar
-- ALTER TABLE public.profiles
--   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

