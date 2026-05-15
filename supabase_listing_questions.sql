-- Pocket App - Preguntas al vendedor (idempotente)
-- Ejecuta este SQL en Supabase (SQL Editor).

CREATE TABLE IF NOT EXISTS public.listing_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  asker_id UUID NOT NULL,
  question_text TEXT NOT NULL DEFAULT '',
  answer_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  answered_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS listing_questions_listing_id_created_at_idx
  ON public.listing_questions (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_questions_seller_id_created_at_idx
  ON public.listing_questions (seller_id, created_at DESC);

ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable: borrar policies si ya existen
DROP POLICY IF EXISTS "Public can read listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Authenticated can ask listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Seller can answer listing questions" ON public.listing_questions;

-- Visible para todos (anon + authenticated), excepto eliminados
CREATE POLICY "Public can read listing questions"
  ON public.listing_questions
  FOR SELECT
  TO anon, authenticated
  USING (is_deleted = false);

-- Preguntar: solo usuarios logueados, no el vendedor, y seller_id debe coincidir con el listing
CREATE POLICY "Authenticated can ask listing questions"
  ON public.listing_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    asker_id = auth.uid()
    AND seller_id <> auth.uid()
    AND seller_id = (
      SELECT l.seller_id FROM public.listings l WHERE l.id = listing_id
    )
  );

-- Responder: solo el vendedor puede actualizar (answer_text/answered_at)
CREATE POLICY "Seller can answer listing questions"
  ON public.listing_questions
  FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

