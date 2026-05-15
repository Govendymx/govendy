-- ============================================
-- SOLUCIÓN COMPLETA: Responder Preguntas (Para TODOS los usuarios)
-- ============================================
-- Este script configura TODO lo necesario para que CUALQUIER vendedor
-- pueda responder sus preguntas, sin importar su user_id.
--
-- IMPORTANTE: Ejecuta este script completo de una vez.
-- Es idempotente, puedes ejecutarlo varias veces sin problemas.

-- ============================================
-- PASO 1: Asegurar que la tabla listing_questions existe
-- ============================================
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

-- Asegurar todas las columnas necesarias
ALTER TABLE public.listing_questions
  ADD COLUMN IF NOT EXISTS seller_id UUID,
  ADD COLUMN IF NOT EXISTS asker_id UUID,
  ADD COLUMN IF NOT EXISTS question_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS answer_text TEXT,
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS listing_questions_listing_id_created_at_idx
  ON public.listing_questions (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_questions_seller_id_created_at_idx
  ON public.listing_questions (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_questions_asker_id_idx
  ON public.listing_questions (asker_id);

-- ============================================
-- PASO 2: Habilitar RLS (Row Level Security)
-- ============================================
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 3: Eliminar TODAS las políticas antiguas (limpieza)
-- ============================================
DROP POLICY IF EXISTS "Public can read listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Authenticated can ask listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Seller can answer listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Sellers can read their own questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Users can update their questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Sellers can answer their questions" ON public.listing_questions;

-- ============================================
-- PASO 4: Crear políticas RLS correctas (para TODOS los usuarios)
-- ============================================

-- Política 1: Cualquiera puede LEER preguntas no eliminadas (públicas)
CREATE POLICY "Public can read listing questions"
  ON public.listing_questions
  FOR SELECT
  TO anon, authenticated
  USING (is_deleted = false);

-- Política 2: Usuarios autenticados pueden HACER preguntas
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

-- Política 3: Vendedores pueden RESPONDER sus preguntas (UPDATE)
-- ESTA ES LA MÁS IMPORTANTE - permite que CUALQUIER vendedor responda
CREATE POLICY "Seller can answer listing questions"
  ON public.listing_questions
  FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Política 4: Vendedores pueden LEER sus propias preguntas (por si acaso)
CREATE POLICY "Sellers can read their own questions"
  ON public.listing_questions
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- ============================================
-- PASO 5: Verificar que las políticas están activas
-- ============================================
DO $$
DECLARE
  policy_count integer;
  rls_enabled boolean;
BEGIN
  -- Verificar políticas de UPDATE
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'listing_questions'
    AND cmd = 'UPDATE';
  
  -- Verificar que RLS está habilitado
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'listing_questions';
  
  IF policy_count > 0 AND rls_enabled THEN
    RAISE NOTICE '✅ Configuración correcta: % políticas de UPDATE, RLS habilitado', policy_count;
  ELSE
    RAISE WARNING '❌ Configuración incompleta: % políticas de UPDATE, RLS: %', policy_count, rls_enabled;
  END IF;
END $$;

-- ============================================
-- PASO 6: Verificación final (muestra resultados)
-- ============================================
SELECT 
  'VERIFICACIÓN FINAL' as tipo,
  policyname as nombre,
  cmd as comando,
  CASE 
    WHEN cmd = 'UPDATE' THEN '✅ PERMITE RESPONDER (para TODOS los vendedores)'
    WHEN cmd = 'SELECT' THEN '✅ PERMITE LEER'
    WHEN cmd = 'INSERT' THEN '✅ PERMITE PREGUNTAR'
    ELSE cmd
  END as estado
FROM pg_policies
WHERE tablename = 'listing_questions'
ORDER BY cmd, policyname;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script:
-- 1. CUALQUIER vendedor podrá responder sus preguntas
-- 2. Las políticas RLS estarán correctamente configuradas
-- 3. No importa el user_id, funcionará para todos
--
-- Para probar:
-- 1. Ve a /dashboard/preguntas como cualquier vendedor
-- 2. Intenta responder una pregunta
-- 3. Debería funcionar sin problemas
