-- ============================================
-- DIAGNÓSTICO: No se pueden responder preguntas
-- ============================================
-- Ejecuta este SQL para diagnosticar por qué no puedes responder preguntas

-- ============================================
-- 1. Verificar que la tabla listing_questions existe
-- ============================================
SELECT 
  'TABLA' as tipo,
  'listing_questions' as nombre,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'listing_questions')
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado;

-- ============================================
-- 2. Verificar políticas RLS de listing_questions
-- ============================================
SELECT 
  'POLÍTICA RLS' as tipo,
  policyname as nombre,
  CASE 
    WHEN cmd = 'UPDATE' THEN '✅ UPDATE'
    WHEN cmd = 'SELECT' THEN '✅ SELECT'
    WHEN cmd = 'INSERT' THEN '✅ INSERT'
    ELSE cmd
  END as estado,
  qual as condicion_using,
  with_check as condicion_with_check
FROM pg_policies
WHERE tablename = 'listing_questions'
ORDER BY policyname;

-- ============================================
-- 3. Verificar que RLS está habilitado
-- ============================================
SELECT 
  'RLS' as tipo,
  'listing_questions' as nombre,
  CASE 
    WHEN relrowsecurity = true THEN '✅ HABILITADO'
    ELSE '❌ DESHABILITADO'
  END as estado,
  NULL as condicion_using,
  NULL as condicion_with_check
FROM pg_class
WHERE relname = 'listing_questions';

-- ============================================
-- 4. Verificar preguntas recientes sin respuesta
-- ============================================
SELECT 
  'PREGUNTA' as tipo,
  id::text as nombre,
  CASE 
    WHEN answer_text IS NULL OR answer_text = '' THEN '⏳ SIN RESPUESTA'
    ELSE '✅ CON RESPUESTA'
  END as estado,
  seller_id::text as seller_id,
  asker_id::text as asker_id,
  created_at::text as created_at
FROM listing_questions
WHERE is_deleted = false
  AND (answer_text IS NULL OR answer_text = '')
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- 5. Verificar permisos de UPDATE en listing_questions
-- ============================================
-- Esta query muestra si hay políticas que permiten UPDATE
SELECT 
  'PERMISOS UPDATE' as tipo,
  policyname as nombre,
  CASE 
    WHEN cmd = 'UPDATE' THEN '✅ PERMITE UPDATE'
    ELSE '❌ NO PERMITE UPDATE'
  END as estado,
  roles::text as roles,
  qual as condicion
FROM pg_policies
WHERE tablename = 'listing_questions'
  AND cmd = 'UPDATE';

-- ============================================
-- 6. Verificar que existe la política "Seller can answer listing questions"
-- ============================================
SELECT 
  'POLÍTICA ESPECÍFICA' as tipo,
  policyname as nombre,
  CASE 
    WHEN policyname LIKE '%answer%' OR policyname LIKE '%seller%' THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado,
  cmd as comando,
  qual as condicion_using
FROM pg_policies
WHERE tablename = 'listing_questions'
  AND (policyname LIKE '%answer%' OR policyname LIKE '%seller%' OR cmd = 'UPDATE');

-- ============================================
-- INSTRUCCIONES
-- ============================================
-- Si ves que:
-- - ❌ NO EXISTE la política de UPDATE para sellers
-- - ❌ RLS está deshabilitado
-- - ❌ No hay políticas que permitan UPDATE
--
-- Entonces ejecuta: supabase_listing_questions_rls_fix.sql
-- O ejecuta: CONFIGURACION_COMPLETA_NOTIFICACIONES_Y_PREGUNTAS.sql
