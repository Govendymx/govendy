-- ============================================
-- VERIFICAR: Políticas RLS para Fernanda
-- ============================================
-- User ID de Fernanda: a036f83d-9f84-42e6-91b0-1c08d3cfc635

-- ============================================
-- 1. Verificar que la pregunta es de Fernanda
-- ============================================
SELECT 
  lq.id as pregunta_id,
  lq.seller_id,
  CASE 
    WHEN lq.seller_id = 'a036f83d-9f84-42e6-91b0-1c08d3cfc635' THEN '✅ ES SU PREGUNTA'
    ELSE '❌ NO ES SU PREGUNTA'
  END as es_suya,
  lq.question_text,
  lq.answer_text,
  l.title as producto
FROM listing_questions lq
LEFT JOIN listings l ON l.id = lq.listing_id
WHERE lq.is_deleted = false
  AND (lq.answer_text IS NULL OR lq.answer_text = '')
  AND lq.seller_id = 'a036f83d-9f84-42e6-91b0-1c08d3cfc635'
ORDER BY lq.created_at DESC;

-- ============================================
-- 2. Verificar políticas RLS de UPDATE
-- ============================================
SELECT 
  'POLÍTICA UPDATE' as tipo,
  policyname as nombre,
  cmd as comando,
  CASE 
    WHEN cmd = 'UPDATE' THEN '✅ PERMITE RESPONDER'
    ELSE cmd
  END as estado,
  qual as condicion_using,
  with_check as condicion_with_check
FROM pg_policies
WHERE tablename = 'listing_questions'
  AND cmd = 'UPDATE'
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
  END as estado
FROM pg_class
WHERE relname = 'listing_questions';

-- ============================================
-- 4. Probar UPDATE manual (simular respuesta)
-- ============================================
-- Esta query simula lo que hace la API cuando Fernanda responde
-- NO la ejecutes directamente, solo es para referencia
/*
UPDATE listing_questions
SET answer_text = 'TEST',
    answered_at = NOW()
WHERE id = 'cd39f61a-e0ec-47d4-9769-58db1897195f'
  AND seller_id = 'a036f83d-9f84-42e6-91b0-1c08d3cfc635';
*/

-- ============================================
-- INSTRUCCIONES
-- ============================================
-- 1. Ejecuta la query #1 para confirmar que la pregunta es de Fernanda
-- 2. Ejecuta la query #2 para verificar que existe una política de UPDATE
-- 3. Ejecuta la query #3 para verificar que RLS está habilitado
-- 4. Si la política de UPDATE NO existe o RLS está deshabilitado:
--    Ejecuta: FIX_RLS_RESPONDER_PREGUNTAS.sql
