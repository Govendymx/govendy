-- ============================================
-- DIAGNÓSTICO: Preguntas específicas que no aparecen
-- Ejecuta esto en Supabase → SQL Editor
-- Verifica el estado real de las preguntas que deberían aparecer
-- ============================================

-- Verificar el estado de las preguntas específicas que aparecen en el CSV
SELECT 
  q.id as pregunta_id,
  q.seller_id,
  q.listing_id,
  LEFT(q.question_text, 60) as pregunta_texto,
  
  -- Estado de answer_text
  q.answer_text,
  CASE 
    WHEN q.answer_text IS NULL THEN 'NULL'
    WHEN q.answer_text = '' THEN 'STRING_VACIO'
    WHEN TRIM(q.answer_text) = '' THEN 'SOLO_ESPACIOS'
    ELSE 'TIENE_TEXTO: ' || LEFT(q.answer_text, 30)
  END as estado_answer_text,
  
  -- Estado de answered_at
  q.answered_at,
  CASE 
    WHEN q.answered_at IS NULL THEN 'NULL'
    ELSE 'TIENE_FECHA: ' || q.answered_at::text
  END as estado_answered_at,
  
  -- Verificación de si está respondida (misma lógica que el código)
  CASE 
    WHEN (q.answer_text IS NOT NULL AND q.answer_text != '' AND TRIM(q.answer_text) != '')
       OR (q.answered_at IS NOT NULL)
    THEN '✅ RESPONDIDA'
    ELSE '❌ SIN RESPUESTA'
  END as estado_final,
  
  q.created_at,
  q.is_deleted,
  
  -- Información del listing
  l.title as listing_title,
  l.seller_id as listing_seller_id,
  CASE 
    WHEN q.seller_id IS NULL THEN '❌ seller_id NULL'
    WHEN q.seller_id != l.seller_id THEN '❌ seller_id NO COINCIDE'
    WHEN q.seller_id = l.seller_id THEN '✅ seller_id CORRECTO'
    ELSE '⚠️ Estado desconocido'
  END as estado_seller_id
  
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.id IN (
  -- IDs de las preguntas del CSV
  '3e9bbe52-cd9a-497c-ab97-74bbf87fa22f',
  '6ffdee86-35c1-4b31-95b2-e7a02d6fccf4',
  'c0c22832-616d-4a5a-b030-0f54579c29e8',
  '69dbfe91-3c7a-433e-b513-6dfd0e022d48',
  '95e3db31-0284-4317-b966-51da2414f715',
  '77caf670-3f03-4bd2-9956-15632191ef75',
  'c35a839b-bd42-4d58-afb3-e341b153daab',
  'b4520808-c9bd-45e8-924c-2bb12cfb14b7',
  'dd436cc6-52b3-4866-a4b5-a216874a0754',
  'a7d923fb-2f9a-4b06-9bf3-00f54a56674b',
  'ba1a57ec-a45a-4021-9e2e-281ea5a9cc1e',
  '8581e634-d5aa-4927-acce-7c93348496cc',
  'c91927b7-1e71-4294-a87f-28df03cd2fac'
)
ORDER BY q.seller_id, q.created_at DESC;

-- Verificar si alguna de estas preguntas tiene answered_at sin respuesta real
SELECT 
  'PREGUNTAS CON ANSWERED_AT SIN RESPUESTA' as diagnostico,
  COUNT(*) as total,
  ARRAY_AGG(q.id) as pregunta_ids
FROM public.listing_questions q
WHERE q.id IN (
  '3e9bbe52-cd9a-497c-ab97-74bbf87fa22f',
  '6ffdee86-35c1-4b31-95b2-e7a02d6fccf4',
  'c0c22832-616d-4a5a-b030-0f54579c29e8',
  '69dbfe91-3c7a-433e-b513-6dfd0e022d48',
  '95e3db31-0284-4317-b966-51da2414f715',
  '77caf670-3f03-4bd2-9956-15632191ef75',
  'c35a839b-bd42-4d58-afb3-e341b153daab',
  'b4520808-c9bd-45e8-924c-2bb12cfb14b7',
  'dd436cc6-52b3-4866-a4b5-a216874a0754',
  'a7d923fb-2f9a-4b06-9bf3-00f54a56674b',
  'ba1a57ec-a45a-4021-9e2e-281ea5a9cc1e',
  '8581e634-d5aa-4927-acce-7c93348496cc',
  'c91927b7-1e71-4294-a87f-28df03cd2fac'
)
AND q.answered_at IS NOT NULL
AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '');

-- Limpiar answered_at de estas preguntas específicas si no tienen respuesta real
UPDATE public.listing_questions q
SET answered_at = NULL
WHERE q.id IN (
  '3e9bbe52-cd9a-497c-ab97-74bbf87fa22f',
  '6ffdee86-35c1-4b31-95b2-e7a02d6fccf4',
  'c0c22832-616d-4a5a-b030-0f54579c29e8',
  '69dbfe91-3c7a-433e-b513-6dfd0e022d48',
  '95e3db31-0284-4317-b966-51da2414f715',
  '77caf670-3f03-4bd2-9956-15632191ef75',
  'c35a839b-bd42-4d58-afb3-e341b153daab',
  'b4520808-c9bd-45e8-924c-2bb12cfb14b7',
  'dd436cc6-52b3-4866-a4b5-a216874a0754',
  'a7d923fb-2f9a-4b06-9bf3-00f54a56674b',
  'ba1a57ec-a45a-4021-9e2e-281ea5a9cc1e',
  '8581e634-d5aa-4927-acce-7c93348496cc',
  'c91927b7-1e71-4294-a87f-28df03cd2fac'
)
AND q.answered_at IS NOT NULL
AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '');

-- Verificar cuántas se limpiaron
SELECT 
  'LIMPIEZA COMPLETADA' as tipo,
  COUNT(*) FILTER (WHERE answered_at IS NULL AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')) as sin_respuesta_ahora,
  COUNT(*) FILTER (WHERE answered_at IS NOT NULL OR (answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '')) as con_respuesta_ahora
FROM public.listing_questions
WHERE id IN (
  '3e9bbe52-cd9a-497c-ab97-74bbf87fa22f',
  '6ffdee86-35c1-4b31-95b2-e7a02d6fccf4',
  'c0c22832-616d-4a5a-b030-0f54579c29e8',
  '69dbfe91-3c7a-433e-b513-6dfd0e022d48',
  '95e3db31-0284-4317-b966-51da2414f715',
  '77caf670-3f03-4bd2-9956-15632191ef75',
  'c35a839b-bd42-4d58-afb3-e341b153daab',
  'b4520808-c9bd-45e8-924c-2bb12cfb14b7',
  'dd436cc6-52b3-4866-a4b5-a216874a0754',
  'a7d923fb-2f9a-4b06-9bf3-00f54a56674b',
  'ba1a57ec-a45a-4021-9e2e-281ea5a9cc1e',
  '8581e634-d5aa-4927-acce-7c93348496cc',
  'c91927b7-1e71-4294-a87f-28df03cd2fac'
);
