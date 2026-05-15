-- ============================================
-- DIAGNÓSTICO: Preguntas que no aparecen en el dashboard
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- PASO 1: Ver TODAS las preguntas sin respuesta con sus detalles
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id as seller_id_en_pregunta,
  q.asker_id,
  l.seller_id as seller_id_en_listing,
  l.title as listing_title,
  CASE 
    WHEN q.seller_id IS NULL THEN '❌ NULL'
    WHEN l.seller_id IS NULL THEN '⚠️ Listing sin seller_id'
    WHEN q.seller_id = l.seller_id THEN '✅ Correcto'
    ELSE '❌ NO COINCIDE'
  END as estado_seller_id,
  LEFT(q.question_text, 60) as pregunta_preview,
  q.answer_text,
  q.answered_at,
  q.created_at,
  q.is_deleted
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '')
ORDER BY q.created_at DESC
LIMIT 20;

-- PASO 2: Ver preguntas agrupadas por seller_id
SELECT 
  COALESCE(q.seller_id, l.seller_id) as seller_id_final,
  CASE 
    WHEN q.seller_id IS NULL AND l.seller_id IS NULL THEN 'SIN_SELLER_ID'
    WHEN q.seller_id IS NULL THEN 'NULL_EN_PREGUNTA'
    WHEN l.seller_id IS NULL THEN 'NULL_EN_LISTING'
    WHEN q.seller_id != l.seller_id THEN 'NO_COINCIDE'
    ELSE 'CORRECTO'
  END as estado,
  COUNT(*) as total_preguntas_sin_respuesta,
  COUNT(*) FILTER (WHERE q.seller_id IS NULL) as con_seller_id_null,
  COUNT(*) FILTER (WHERE q.seller_id != l.seller_id) as con_seller_id_incorrecto,
  COUNT(*) FILTER (WHERE q.seller_id = l.seller_id) as con_seller_id_correcto
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '')
GROUP BY COALESCE(q.seller_id, l.seller_id), 
         CASE 
           WHEN q.seller_id IS NULL AND l.seller_id IS NULL THEN 'SIN_SELLER_ID'
           WHEN q.seller_id IS NULL THEN 'NULL_EN_PREGUNTA'
           WHEN l.seller_id IS NULL THEN 'NULL_EN_LISTING'
           WHEN q.seller_id != l.seller_id THEN 'NO_COINCIDE'
           ELSE 'CORRECTO'
         END
ORDER BY total_preguntas_sin_respuesta DESC;

-- PASO 3: Ver preguntas específicas del listing que aparece en la imagen
-- (Reemplaza el listing_id con el que aparece en la URL: 76794cc0-206a-4ae4-8a74-98a1f045135b)
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id as seller_id_en_pregunta,
  q.asker_id,
  l.seller_id as seller_id_en_listing,
  l.title as listing_title,
  LEFT(q.question_text, 100) as pregunta_texto,
  q.answer_text,
  q.created_at,
  CASE 
    WHEN q.seller_id IS NULL THEN '❌ seller_id NULL'
    WHEN q.seller_id != l.seller_id THEN '❌ seller_id NO COINCIDE'
    WHEN q.seller_id = l.seller_id THEN '✅ seller_id CORRECTO'
    ELSE '⚠️ Estado desconocido'
  END as diagnostico
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.listing_id = '76794cc0-206a-4ae4-8a74-98a1f045135b'
  AND q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '')
ORDER BY q.created_at DESC;

-- PASO 4: Verificar si hay preguntas con seller_id NULL que deberían tener seller_id
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id as seller_id_actual,
  l.seller_id as seller_id_deberia_ser,
  l.title as listing_title,
  LEFT(q.question_text, 60) as pregunta_preview,
  q.created_at
FROM public.listing_questions q
JOIN public.listings l ON l.id = q.listing_id
WHERE q.seller_id IS NULL
  AND l.seller_id IS NOT NULL
  AND q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '')
ORDER BY q.created_at DESC
LIMIT 10;

-- PASO 5: Corregir automáticamente las preguntas con seller_id NULL o incorrecto
UPDATE public.listing_questions q
SET seller_id = l.seller_id
FROM public.listings l
WHERE q.listing_id = l.id
  AND l.seller_id IS NOT NULL
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
  AND q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '');

-- Verificar cuántas se corrigieron
SELECT 
  'CORRECCIÓN AUTOMÁTICA' as tipo,
  COUNT(*) as preguntas_corregidas
FROM public.listing_questions q
JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '')
  AND q.seller_id = l.seller_id;
