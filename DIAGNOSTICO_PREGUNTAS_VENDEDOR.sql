-- Script de diagnóstico para verificar por qué no llegan las preguntas al vendedor
-- Ejecuta este SQL en Supabase SQL Editor
-- Reemplaza 'TU_USER_ID_AQUI' con el ID del vendedor que quieres verificar

-- ============================================
-- 1. VERIFICAR PREGUNTAS POR SELLER_ID
-- ============================================
SELECT 
  'Por seller_id' as tipo_consulta,
  COUNT(*) as total_preguntas,
  COUNT(*) FILTER (WHERE answer_text IS NULL OR TRIM(answer_text) = '') as sin_respuesta,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND TRIM(answer_text) != '') as con_respuesta,
  COUNT(*) FILTER (WHERE is_deleted = true) as eliminadas
FROM public.listing_questions
WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  AND is_deleted = false;

-- ============================================
-- 2. VERIFICAR PREGUNTAS POR LISTING_ID
-- ============================================
SELECT 
  'Por listing_id' as tipo_consulta,
  COUNT(*) as total_preguntas,
  COUNT(*) FILTER (WHERE answer_text IS NULL OR TRIM(answer_text) = '') as sin_respuesta,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND TRIM(answer_text) != '') as con_respuesta,
  COUNT(*) FILTER (WHERE is_deleted = true) as eliminadas
FROM public.listing_questions lq
WHERE lq.listing_id IN (
  SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
)
AND lq.is_deleted = false;

-- ============================================
-- 3. VER TODAS LAS PREGUNTAS DEL VENDEDOR (DETALLES)
-- ============================================
SELECT 
  lq.id,
  lq.listing_id,
  lq.seller_id,
  lq.asker_id,
  LEFT(lq.question_text, 50) as pregunta_preview,
  lq.answer_text IS NULL OR TRIM(lq.answer_text) = '' as sin_respuesta,
  lq.answer_text IS NOT NULL AND TRIM(lq.answer_text) != '' as con_respuesta,
  lq.is_deleted,
  lq.created_at,
  lq.answered_at,
  l.title as listing_title
FROM public.listing_questions lq
LEFT JOIN public.listings l ON l.id = lq.listing_id
WHERE (
  lq.seller_id = 'TU_USER_ID_AQUI'::uuid
  OR lq.listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND lq.is_deleted = false
ORDER BY lq.created_at DESC
LIMIT 20;

-- ============================================
-- 4. VERIFICAR LISTINGS DEL VENDEDOR
-- ============================================
SELECT 
  id,
  title,
  seller_id,
  created_at
FROM public.listings
WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 5. VERIFICAR PREGUNTAS SIN SELLER_ID (PROBLEMA COMÚN)
-- ============================================
SELECT 
  COUNT(*) as preguntas_sin_seller_id,
  COUNT(*) FILTER (WHERE answer_text IS NULL OR TRIM(answer_text) = '') as sin_respuesta_y_sin_seller_id
FROM public.listing_questions
WHERE seller_id IS NULL
  AND is_deleted = false
  AND listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  );

-- ============================================
-- 6. CORREGIR PREGUNTAS SIN SELLER_ID (OPCIONAL)
-- ============================================
-- Descomenta las siguientes líneas si encuentras preguntas sin seller_id:
/*
UPDATE public.listing_questions lq
SET seller_id = l.seller_id
FROM public.listings l
WHERE lq.listing_id = l.id
  AND lq.seller_id IS NULL
  AND l.seller_id = 'TU_USER_ID_AQUI'::uuid
  AND lq.is_deleted = false;
*/
