-- Pocket - Borrado lógico (archivo) de publicaciones (idempotente)
-- Ejecuta en Supabase → SQL Editor.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS listings_is_deleted_idx ON public.listings (is_deleted, created_at DESC);

