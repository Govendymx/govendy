-- Fix: Asegurar que vendedores puedan responder preguntas
-- Ejecuta en Supabase → SQL Editor
-- Esto corrige las políticas RLS para permitir que vendedores respondan preguntas

-- 1) Habilitar RLS si no está habilitado
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;

-- 2) Eliminar políticas antiguas de UPDATE que puedan estar bloqueando
DROP POLICY IF EXISTS "Seller can answer listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Sellers can answer their questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Users can update their questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Vendedores pueden responder" ON public.listing_questions;

-- 3) Crear política PERMISIVA para que vendedores puedan responder
-- Esta política permite que CUALQUIER usuario autenticado que sea dueño del listing pueda responder
CREATE POLICY "Seller can answer listing questions"
  ON public.listing_questions
  FOR UPDATE
  TO authenticated
  USING (
    -- Permitir si el seller_id coincide con el usuario
    seller_id = auth.uid()
    OR
    -- O si el usuario es dueño del listing (por si seller_id está vacío/incorrecto)
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_questions.listing_id
      AND l.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Misma validación para el WITH CHECK
    seller_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_questions.listing_id
      AND l.seller_id = auth.uid()
    )
  );

-- 4) Asegurar que vendedores puedan LEER sus preguntas
DROP POLICY IF EXISTS "Sellers can read their own questions" ON public.listing_questions;

CREATE POLICY "Sellers can read their own questions"
  ON public.listing_questions
  FOR SELECT
  TO authenticated
  USING (
    -- Permitir si el seller_id coincide
    seller_id = auth.uid()
    OR
    -- O si el usuario es dueño del listing
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_questions.listing_id
      AND l.seller_id = auth.uid()
    )
    OR
    -- O si es la pregunta del usuario (para que pueda ver sus propias preguntas)
    asker_id = auth.uid()
  );

-- 5) Verificar políticas creadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'listing_questions'
ORDER BY policyname;
