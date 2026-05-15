-- ============================================
-- DIAGNÓSTICO COMPLETO: Por qué no se guardan las respuestas
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- ============================================
-- 1. VERIFICAR QUE LA FUNCIÓN EXISTE
-- ============================================
SELECT 
  'FUNCIÓN' as tipo,
  routine_name as nombre,
  routine_type as tipo_funcion,
  security_type as seguridad,
  data_type as tipo_retorno
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_question_answer';

-- ============================================
-- 2. VERIFICAR POLÍTICAS RLS
-- ============================================
SELECT 
  'POLÍTICA' as tipo,
  policyname as nombre,
  cmd as comando,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'listing_questions'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- ============================================
-- 3. VER PREGUNTAS SIN RESPUESTA CON DETALLES
-- ============================================
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id as seller_id_en_pregunta,
  l.seller_id as seller_id_en_listing,
  CASE 
    WHEN q.seller_id IS NULL THEN '⚠️ NULL'
    WHEN l.seller_id IS NULL THEN '⚠️ Listing sin seller_id'
    WHEN q.seller_id = l.seller_id THEN '✅ Correcto'
    ELSE '❌ NO COINCIDE'
  END as estado_seller_id,
  LEFT(q.question_text, 50) as pregunta_preview,
  q.answer_text,
  q.answered_at,
  q.created_at,
  l.title as titulo_publicacion
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '')
ORDER BY q.created_at DESC
LIMIT 10;

-- ============================================
-- 4. PROBAR LA FUNCIÓN SQL DIRECTAMENTE
-- ============================================
-- Descomenta y reemplaza con datos reales para probar:
-- SELECT public.update_question_answer(
--   (SELECT id FROM listing_questions WHERE is_deleted = false AND answer_text IS NULL LIMIT 1)::uuid,
--   'Respuesta de prueba desde SQL',
--   (SELECT seller_id FROM listing_questions WHERE is_deleted = false AND answer_text IS NULL LIMIT 1)::uuid
-- );

-- ============================================
-- 5. VERIFICAR PERMISOS DE LA FUNCIÓN
-- ============================================
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'update_question_answer';

-- ============================================
-- 6. ESTADÍSTICAS FINALES
-- ============================================
SELECT 
  'ESTADÍSTICAS' as tipo,
  COUNT(*) FILTER (WHERE answer_text IS NULL OR answer_text = '') as sin_respuesta,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND answer_text != '') as con_respuesta,
  COUNT(*) FILTER (WHERE seller_id IS NULL) as sin_seller_id,
  COUNT(*) FILTER (WHERE answered_at IS NULL AND answer_text IS NOT NULL) as con_respuesta_sin_fecha
FROM public.listing_questions
WHERE is_deleted = false;
