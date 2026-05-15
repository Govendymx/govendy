-- ============================================
-- VERIFICAR: Preguntas que deberían estar respondidas pero aparecen como pendientes
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- Ver todas las preguntas con sus respuestas
SELECT 
  q.id,
  q.listing_id,
  q.seller_id,
  LEFT(q.question_text, 50) as pregunta,
  q.answer_text,
  CASE 
    WHEN q.answer_text IS NULL THEN 'NULL'
    WHEN q.answer_text = '' THEN 'VACÍO'
    WHEN TRIM(q.answer_text) = '' THEN 'SOLO ESPACIOS'
    ELSE 'TIENE RESPUESTA'
  END as estado_answer_text,
  q.answered_at,
  CASE 
    WHEN q.answered_at IS NULL THEN 'NULL'
    ELSE 'TIENE FECHA'
  END as estado_answered_at,
  q.created_at,
  l.title as titulo_publicacion
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
ORDER BY q.created_at DESC
LIMIT 20;

-- Ver específicamente las que tienen respuesta pero podrían estar mal filtradas
SELECT 
  'PREGUNTAS CON RESPUESTA' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') as con_answer_text,
  COUNT(*) FILTER (WHERE answered_at IS NOT NULL) as con_answered_at,
  COUNT(*) FILTER (WHERE (answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') OR answered_at IS NOT NULL) as respondidas
FROM public.listing_questions
WHERE is_deleted = false;

-- Ver las que NO deberían aparecer como pendientes (tienen respuesta)
SELECT 
  q.id,
  q.listing_id,
  LEFT(q.question_text, 50) as pregunta,
  q.answer_text,
  q.answered_at,
  '⚠️ ESTA PREGUNTA TIENE RESPUESTA - NO DEBERÍA APARECER COMO PENDIENTE' as advertencia
FROM public.listing_questions q
WHERE q.is_deleted = false
  AND (
    (q.answer_text IS NOT NULL AND q.answer_text != '' AND TRIM(q.answer_text) != '')
    OR q.answered_at IS NOT NULL
  )
ORDER BY q.created_at DESC
LIMIT 10;
