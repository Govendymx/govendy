-- ============================================
-- LIMPIEZA COMPLETA: Eliminar answered_at incorrecto de TODAS las preguntas
-- Ejecuta esto en Supabase → SQL Editor
-- Esto limpia TODAS las preguntas de TODOS los usuarios que tienen answered_at sin respuesta real
-- ============================================

-- PASO 1: Verificar cuántas preguntas tienen answered_at sin respuesta real
SELECT 
  'DIAGNÓSTICO INICIAL' as paso,
  COUNT(*) FILTER (WHERE answered_at IS NOT NULL AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')) as con_answered_at_sin_respuesta,
  COUNT(*) FILTER (WHERE answered_at IS NULL AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')) as sin_answered_at_sin_respuesta,
  COUNT(*) FILTER (WHERE (answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') OR answered_at IS NOT NULL) as con_respuesta_real,
  COUNT(*) as total
FROM public.listing_questions
WHERE is_deleted = false;

-- PASO 2: Limpiar answered_at de TODAS las preguntas que no tienen respuesta real
-- Esto es seguro porque solo limpia answered_at cuando NO hay answer_text válido
UPDATE public.listing_questions q
SET answered_at = NULL
WHERE q.is_deleted = false
  AND q.answered_at IS NOT NULL
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '');

-- Verificar cuántas se limpiaron
SELECT 
  'LIMPIEZA COMPLETADA' as paso,
  COUNT(*) FILTER (WHERE answered_at IS NOT NULL AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')) as con_answered_at_sin_respuesta_restantes,
  COUNT(*) FILTER (WHERE answered_at IS NULL AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')) as sin_answered_at_sin_respuesta_ahora,
  COUNT(*) FILTER (WHERE (answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') OR answered_at IS NOT NULL) as con_respuesta_real,
  COUNT(*) as total
FROM public.listing_questions
WHERE is_deleted = false;

-- PASO 3: Verificar preguntas sin respuesta por usuario (después de la limpieza)
SELECT 
  q.seller_id,
  COUNT(*) as preguntas_sin_respuesta,
  ARRAY_AGG(q.id ORDER BY q.created_at DESC) FILTER (WHERE q.id IS NOT NULL) as pregunta_ids
FROM public.listing_questions q
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
  AND q.answered_at IS NULL
  AND q.seller_id IS NOT NULL
GROUP BY q.seller_id
ORDER BY preguntas_sin_respuesta DESC
LIMIT 20;

-- PASO 4: Verificar que todas las preguntas con answer_text válido tienen answered_at
-- Si una pregunta tiene answer_text pero no answered_at, establecerlo
UPDATE public.listing_questions q
SET answered_at = COALESCE(q.answered_at, NOW())
WHERE q.is_deleted = false
  AND q.answer_text IS NOT NULL
  AND q.answer_text != ''
  AND TRIM(q.answer_text) != ''
  AND q.answered_at IS NULL;

-- Verificar cuántas se actualizaron
SELECT 
  'ESTABLECER ANSWERED_AT' as paso,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '' AND answered_at IS NOT NULL) as con_respuesta_completa,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '' AND answered_at IS NULL) as con_respuesta_sin_answered_at
FROM public.listing_questions
WHERE is_deleted = false;

-- PASO 5: Verificación final - Estado de todas las preguntas
SELECT 
  'ESTADO FINAL (GLOBAL)' as paso,
  COUNT(*) FILTER (WHERE answer_text IS NULL AND answered_at IS NULL) as sin_respuesta,
  COUNT(*) FILTER (WHERE (answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') OR answered_at IS NOT NULL) as con_respuesta,
  COUNT(*) FILTER (WHERE seller_id IS NULL) as sin_seller_id,
  COUNT(*) as total
FROM public.listing_questions
WHERE is_deleted = false;
