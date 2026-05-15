-- ============================================
-- FIX: Políticas RLS para Responder Preguntas
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Esto asegurará que los vendedores puedan responder preguntas

-- ============================================
-- 1. Habilitar RLS en listing_questions (si no está habilitado)
-- ============================================
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Eliminar políticas antiguas de UPDATE (si existen)
-- ============================================
DROP POLICY IF EXISTS "Seller can answer listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Sellers can answer their questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Users can update their questions" ON public.listing_questions;

-- ============================================
-- 3. Crear política para que vendedores puedan responder (UPDATE)
-- ============================================
CREATE POLICY "Seller can answer listing questions"
  ON public.listing_questions
  FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- ============================================
-- 4. Asegurar que vendedores puedan leer sus preguntas (SELECT)
-- ============================================
DROP POLICY IF EXISTS "Sellers can read their own questions" ON public.listing_questions;

CREATE POLICY "Sellers can read their own questions"
  ON public.listing_questions
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- ============================================
-- 5. Verificar que las políticas están activas
-- ============================================
SELECT 
  'POLÍTICA' as tipo,
  policyname as nombre,
  cmd as comando,
  CASE 
    WHEN cmd = 'UPDATE' THEN '✅ PERMITE RESPONDER'
    WHEN cmd = 'SELECT' THEN '✅ PERMITE LEER'
    ELSE cmd
  END as estado
FROM pg_policies
WHERE tablename = 'listing_questions'
  AND (cmd = 'UPDATE' OR policyname LIKE '%seller%' OR policyname LIKE '%answer%')
ORDER BY cmd, policyname;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script:
-- 1. Los vendedores podrán responder preguntas
-- 2. Las políticas RLS estarán correctamente configuradas
-- 3. Prueba responder una pregunta desde /dashboard/preguntas
