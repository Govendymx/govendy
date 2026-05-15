-- ============================================
-- SCRIPT DE VERIFICACIÓN: Preguntas Sin Respuesta
-- Ejecuta este SQL en Supabase → SQL Editor
-- ============================================

-- ============================================
-- 1. VER TODAS LAS PREGUNTAS SIN RESPUESTA
-- ============================================
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id,
  q.asker_id,
  q.question_text,
  q.answer_text,
  q.is_deleted,
  q.created_at,
  l.title as titulo_publicacion,
  l.status as estado_publicacion
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
ORDER BY q.created_at DESC;

-- ============================================
-- 2. CONTAR PREGUNTAS SIN RESPUESTA POR VENDEDOR
-- ============================================
SELECT 
  q.seller_id,
  COUNT(*) as total_preguntas_sin_respuesta
FROM public.listing_questions q
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
GROUP BY q.seller_id
ORDER BY total_preguntas_sin_respuesta DESC;

-- ============================================
-- 3. VERIFICAR SI seller_id ESTÁ CORRECTO
-- ============================================
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id as seller_id_en_pregunta,
  l.seller_id as seller_id_en_listing,
  CASE 
    WHEN q.seller_id = l.seller_id THEN '✅ Correcto'
    WHEN q.seller_id IS NULL THEN '⚠️ NULL'
    ELSE '❌ Incorrecto'
  END as estado,
  q.question_text,
  CASE 
    WHEN q.answer_text IS NULL OR q.answer_text = '' THEN 'Sin respuesta'
    ELSE 'Con respuesta'
  END as tiene_respuesta
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
ORDER BY q.created_at DESC;

-- ============================================
-- 4. RESUMEN GENERAL
-- ============================================
SELECT 
  'Total preguntas' as tipo,
  COUNT(*) as cantidad
FROM public.listing_questions
WHERE is_deleted = false

UNION ALL

SELECT 
  'Preguntas sin respuesta' as tipo,
  COUNT(*) as cantidad
FROM public.listing_questions
WHERE is_deleted = false
  AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')

UNION ALL

SELECT 
  'Preguntas con respuesta' as tipo,
  COUNT(*) as cantidad
FROM public.listing_questions
WHERE is_deleted = false
  AND answer_text IS NOT NULL 
  AND answer_text != '' 
  AND TRIM(answer_text) != ''

UNION ALL

SELECT 
  'Preguntas eliminadas' as tipo,
  COUNT(*) as cantidad
FROM public.listing_questions
WHERE is_deleted = true;

-- ============================================
-- 5. VER PREGUNTAS DE UN VENDEDOR ESPECÍFICO
-- (Reemplaza 'TU_USER_ID_AQUI' con tu user_id)
-- ============================================
-- SELECT 
--   q.id,
--   q.listing_id,
--   q.question_text,
--   q.answer_text,
--   q.created_at,
--   l.title as titulo_publicacion
-- FROM public.listing_questions q
-- LEFT JOIN public.listings l ON l.id = q.listing_id
-- WHERE q.seller_id = 'TU_USER_ID_AQUI'  -- ⚠️ CAMBIA ESTO
--   AND q.is_deleted = false
--   AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
-- ORDER BY q.created_at DESC;
