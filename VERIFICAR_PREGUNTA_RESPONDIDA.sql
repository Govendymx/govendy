-- ============================================
-- VERIFICAR: Por qué una pregunta aparece como respondida
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- Ver TODAS las preguntas del usuario actual con sus detalles completos
-- Reemplaza 'TU_USER_ID_AQUI' con el ID del usuario que estás probando
-- O simplemente ejecuta sin WHERE para ver todas

SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id,
  q.asker_id,
  LEFT(q.question_text, 80) as pregunta_texto,
  
  -- Detalles de answer_text
  q.answer_text,
  CASE 
    WHEN q.answer_text IS NULL THEN 'NULL'
    WHEN q.answer_text = '' THEN 'STRING_VACIO'
    WHEN TRIM(q.answer_text) = '' THEN 'SOLO_ESPACIOS'
    ELSE 'TIENE_TEXTO'
  END as estado_answer_text,
  LENGTH(q.answer_text::text) as longitud_answer_text,
  
  -- Detalles de answered_at
  q.answered_at,
  CASE 
    WHEN q.answered_at IS NULL THEN 'NULL'
    ELSE 'TIENE_FECHA'
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
WHERE q.is_deleted = false
ORDER BY q.created_at DESC
LIMIT 20;

-- Ver solo preguntas que APARECEN como respondidas pero NO deberían
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id,
  LEFT(q.question_text, 60) as pregunta_texto,
  q.answer_text,
  q.answered_at,
  'PROBLEMA: Tiene answered_at pero answer_text está vacío' as diagnostico
FROM public.listing_questions q
WHERE q.is_deleted = false
  -- Tiene answered_at pero answer_text está vacío o es NULL
  AND q.answered_at IS NOT NULL
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
ORDER BY q.created_at DESC
LIMIT 10;

-- Limpiar answered_at de preguntas que no tienen respuesta real
UPDATE public.listing_questions q
SET answered_at = NULL
WHERE q.is_deleted = false
  AND q.answered_at IS NOT NULL
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '');

-- Limpiar answer_text de preguntas que solo tienen espacios
UPDATE public.listing_questions q
SET answer_text = NULL
WHERE q.is_deleted = false
  AND q.answer_text IS NOT NULL
  AND (q.answer_text = '' OR TRIM(q.answer_text) = '');

-- Verificar cuántas se limpiaron
SELECT 
  'LIMPIEZA COMPLETADA' as tipo,
  COUNT(*) FILTER (WHERE answer_text IS NULL AND answered_at IS NULL) as sin_respuesta_ahora,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL OR answered_at IS NOT NULL) as con_respuesta_ahora
FROM public.listing_questions
WHERE is_deleted = false;
