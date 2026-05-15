-- ============================================
-- SCRIPT DE VERIFICACIÓN: Verificar si las respuestas se están guardando
-- Ejecuta este SQL en Supabase → SQL Editor
-- ============================================

-- ============================================
-- 1. VER TODAS LAS PREGUNTAS CON SU ESTADO DE RESPUESTA
-- ============================================
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id,
  q.asker_id,
  LEFT(q.question_text, 50) as pregunta_preview,
  q.answer_text,
  q.answered_at,
  CASE 
    WHEN q.answer_text IS NULL OR q.answer_text = '' THEN '❌ Sin respuesta'
    WHEN q.answer_text IS NOT NULL AND q.answer_text != '' THEN '✅ Con respuesta'
    ELSE '⚠️ Estado desconocido'
  END as estado_respuesta,
  CASE 
    WHEN q.answered_at IS NULL THEN '❌ Sin fecha'
    ELSE '✅ Con fecha: ' || q.answered_at::text
  END as estado_fecha,
  q.created_at,
  q.is_deleted
FROM public.listing_questions q
WHERE q.is_deleted = false
ORDER BY q.created_at DESC
LIMIT 50;

-- ============================================
-- 2. CONTAR PREGUNTAS POR ESTADO
-- ============================================
SELECT 
  CASE 
    WHEN answer_text IS NULL OR answer_text = '' THEN 'Sin respuesta'
    WHEN answer_text IS NOT NULL AND answer_text != '' THEN 'Con respuesta'
    ELSE 'Estado desconocido'
  END as estado,
  COUNT(*) as cantidad,
  COUNT(CASE WHEN answered_at IS NOT NULL THEN 1 END) as con_fecha_answered_at
FROM public.listing_questions
WHERE is_deleted = false
GROUP BY 
  CASE 
    WHEN answer_text IS NULL OR answer_text = '' THEN 'Sin respuesta'
    WHEN answer_text IS NOT NULL AND answer_text != '' THEN 'Con respuesta'
    ELSE 'Estado desconocido'
  END
ORDER BY cantidad DESC;

-- ============================================
-- 3. VER PREGUNTAS QUE DEBERÍAN ESTAR RESPONDIDAS PERO NO LO ESTÁN
-- (Tienen answered_at pero no answer_text)
-- ============================================
SELECT 
  q.id,
  q.listing_id,
  q.seller_id,
  q.answer_text,
  q.answered_at,
  '⚠️ Tiene answered_at pero answer_text está vacío' as problema
FROM public.listing_questions q
WHERE q.is_deleted = false
  AND q.answered_at IS NOT NULL
  AND (q.answer_text IS NULL OR q.answer_text = '');

-- ============================================
-- 4. VER PREGUNTAS QUE TIENEN answer_text PERO NO answered_at
-- ============================================
SELECT 
  q.id,
  q.listing_id,
  q.seller_id,
  LEFT(q.answer_text, 50) as respuesta_preview,
  q.answered_at,
  '⚠️ Tiene answer_text pero answered_at está NULL' as problema
FROM public.listing_questions q
WHERE q.is_deleted = false
  AND q.answer_text IS NOT NULL
  AND q.answer_text != ''
  AND q.answered_at IS NULL;

-- ============================================
-- 5. CORREGIR PREGUNTAS CON answer_text PERO SIN answered_at
-- (Ejecuta esto si encuentras problemas en el paso 4)
-- ============================================
-- UPDATE public.listing_questions
-- SET answered_at = created_at
-- WHERE is_deleted = false
--   AND answer_text IS NOT NULL
--   AND answer_text != ''
--   AND answered_at IS NULL;

-- ============================================
-- 6. VER PREGUNTAS POR VENDEDOR ESPECÍFICO
-- (Reemplaza 'TU_USER_ID_AQUI' con el ID del vendedor)
-- ============================================
-- SELECT 
--   q.id,
--   q.listing_id,
--   q.seller_id,
--   LEFT(q.question_text, 50) as pregunta,
--   LEFT(q.answer_text, 50) as respuesta,
--   q.answered_at,
--   CASE 
--     WHEN q.answer_text IS NULL OR q.answer_text = '' THEN 'Sin respuesta'
--     ELSE 'Con respuesta'
--   END as estado
-- FROM public.listing_questions q
-- WHERE q.is_deleted = false
--   AND q.seller_id = 'TU_USER_ID_AQUI'
-- ORDER BY q.created_at DESC;
