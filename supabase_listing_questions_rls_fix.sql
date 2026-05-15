-- Pocket App - Fix RLS para que vendedores puedan ver sus preguntas
-- Ejecuta este SQL en Supabase (SQL Editor).

-- Agregar política para que vendedores puedan ver sus propias preguntas
DROP POLICY IF EXISTS "Sellers can read their own questions" ON public.listing_questions;

CREATE POLICY "Sellers can read their own questions"
  ON public.listing_questions
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- La política "Public can read listing questions" ya permite leer todas las preguntas no eliminadas
-- pero esta nueva política asegura que el vendedor siempre pueda ver las suyas
