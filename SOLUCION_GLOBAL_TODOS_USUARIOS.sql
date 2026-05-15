-- ============================================
-- SOLUCIÓN GLOBAL: Para TODOS los usuarios
-- Ejecuta esto en Supabase → SQL Editor
-- Esto corrige TODAS las preguntas de TODOS los usuarios
-- ============================================

-- ============================================
-- PASO 1: Corregir seller_id en TODAS las preguntas de TODOS los usuarios
-- ============================================
UPDATE public.listing_questions q
SET seller_id = l.seller_id
FROM public.listings l
WHERE q.listing_id = l.id
  AND l.seller_id IS NOT NULL
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
  AND q.is_deleted = false;

-- Verificar cuántas se corrigieron
SELECT 
  'CORRECCIÓN SELLER_ID (GLOBAL)' as tipo,
  COUNT(*) as preguntas_corregidas
FROM public.listing_questions q
JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND q.seller_id = l.seller_id;

-- ============================================
-- PASO 2: Limpiar answered_at de preguntas que NO tienen respuesta real
-- ============================================
-- Si una pregunta tiene answered_at pero answer_text está vacío, limpiar answered_at
UPDATE public.listing_questions q
SET answered_at = NULL
WHERE q.is_deleted = false
  AND q.answered_at IS NOT NULL
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '');

-- Verificar cuántas se limpiaron
SELECT 
  'LIMPIEZA ANSWERED_AT' as tipo,
  COUNT(*) as preguntas_limpiadas
FROM public.listing_questions
WHERE is_deleted = false
  AND answered_at IS NULL
  AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '');

-- ============================================
-- PASO 3: Limpiar answer_text de preguntas que solo tienen espacios
-- ============================================
UPDATE public.listing_questions q
SET answer_text = NULL
WHERE q.is_deleted = false
  AND q.answer_text IS NOT NULL
  AND (q.answer_text = '' OR TRIM(q.answer_text) = '');

-- Verificar cuántas se limpiaron
SELECT 
  'LIMPIEZA ANSWER_TEXT' as tipo,
  COUNT(*) as preguntas_limpiadas
FROM public.listing_questions
WHERE is_deleted = false
  AND answer_text IS NULL;

-- ============================================
-- PASO 4: Asegurar que answered_at se establezca cuando hay answer_text válido
-- ============================================
-- Si una pregunta tiene answer_text pero no tiene answered_at, establecerlo
UPDATE public.listing_questions q
SET answered_at = NOW()
WHERE q.is_deleted = false
  AND q.answer_text IS NOT NULL
  AND q.answer_text != ''
  AND TRIM(q.answer_text) != ''
  AND q.answered_at IS NULL;

-- Verificar cuántas se actualizaron
SELECT 
  'ESTABLECER ANSWERED_AT' as tipo,
  COUNT(*) as preguntas_actualizadas
FROM public.listing_questions
WHERE is_deleted = false
  AND answer_text IS NOT NULL
  AND answer_text != ''
  AND TRIM(answer_text) != ''
  AND answered_at IS NOT NULL;

-- ============================================
-- PASO 5: Verificación final - Estado de todas las preguntas
-- ============================================
SELECT 
  'ESTADO FINAL (GLOBAL)' as tipo,
  COUNT(*) FILTER (WHERE answer_text IS NULL AND answered_at IS NULL) as sin_respuesta,
  COUNT(*) FILTER (WHERE (answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') OR answered_at IS NOT NULL) as con_respuesta,
  COUNT(*) FILTER (WHERE seller_id IS NULL) as sin_seller_id,
  COUNT(*) as total
FROM public.listing_questions
WHERE is_deleted = false;

-- ============================================
-- PASO 6: Verificar preguntas sin respuesta por usuario (para diagnóstico)
-- ============================================
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
