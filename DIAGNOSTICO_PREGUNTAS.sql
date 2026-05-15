-- ============================================
-- DIAGNÓSTICO COMPLETO: Preguntas Sin Respuesta
-- Ejecuta esto en Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. VER TODAS LAS PREGUNTAS SIN RESPUESTA CON SU seller_id
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
  q.question_text,
  q.answer_text,
  q.created_at,
  l.title as titulo_publicacion
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
ORDER BY q.created_at DESC;

-- ============================================
-- 2. CONTAR PREGUNTAS SIN RESPUESTA POR ESTADO DE seller_id
-- ============================================
SELECT 
  CASE 
    WHEN q.seller_id IS NULL THEN 'NULL en pregunta'
    WHEN l.seller_id IS NULL THEN 'NULL en listing'
    WHEN q.seller_id = l.seller_id THEN 'Correcto'
    ELSE 'No coincide'
  END as estado,
  COUNT(*) as cantidad
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
GROUP BY 
  CASE 
    WHEN q.seller_id IS NULL THEN 'NULL en pregunta'
    WHEN l.seller_id IS NULL THEN 'NULL en listing'
    WHEN q.seller_id = l.seller_id THEN 'Correcto'
    ELSE 'No coincide'
  END
ORDER BY cantidad DESC;

-- ============================================
-- 3. CORREGIR seller_id DE PREGUNTAS (AUTOMÁTICO)
-- ============================================
-- Este query corrige automáticamente el seller_id usando el listing
UPDATE public.listing_questions q
SET seller_id = l.seller_id
FROM public.listings l
WHERE q.listing_id = l.id
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
  AND q.is_deleted = false
  AND l.seller_id IS NOT NULL;

-- Ver cuántas se corrigieron
SELECT 
  'Preguntas corregidas' as accion,
  COUNT(*) as cantidad
FROM public.listing_questions q
INNER JOIN public.listings l ON l.id = q.listing_id
WHERE q.seller_id = l.seller_id
  AND q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '');

-- ============================================
-- 4. VER PREGUNTAS DESPUÉS DE LA CORRECCIÓN
-- ============================================
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id,
  q.question_text,
  q.answer_text,
  q.created_at,
  l.title as titulo_publicacion,
  l.seller_id as seller_id_del_listing
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
  AND q.seller_id IS NOT NULL
ORDER BY q.created_at DESC;
