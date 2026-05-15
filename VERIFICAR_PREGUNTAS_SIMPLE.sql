-- ============================================
-- VERIFICAR PREGUNTAS - Versión Simple
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- PASO 1: Ver TODOS los usuarios con preguntas sin respuesta
-- Esto te mostrará todos los seller_id que tienen preguntas pendientes
SELECT 
  q.seller_id,
  COUNT(*) as total_preguntas_sin_respuesta,
  ARRAY_AGG(q.id ORDER BY q.created_at DESC) FILTER (WHERE q.id IS NOT NULL) as pregunta_ids,
  MIN(q.created_at) as pregunta_mas_antigua,
  MAX(q.created_at) as pregunta_mas_reciente
FROM public.listing_questions q
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
  AND q.answered_at IS NULL
  AND q.seller_id IS NOT NULL
GROUP BY q.seller_id
ORDER BY total_preguntas_sin_respuesta DESC;

-- PASO 2: Ver preguntas de un usuario específico
-- ⚠️ IMPORTANTE: Reemplaza 'AQUI_VA_EL_UUID' con uno de los seller_id del PASO 1
-- Ejemplo: '65e2306b-c119-48c2-b141-3df37c00878b'
SELECT 
  q.id as pregunta_id,
  q.seller_id,
  q.listing_id,
  l.title as listing_title,
  LEFT(q.question_text, 80) as pregunta_texto,
  q.answer_text,
  q.answered_at,
  q.created_at,
  CASE 
    WHEN q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '' 
    THEN '❌ SIN RESPUESTA'
    ELSE '✅ CON RESPUESTA'
  END as estado,
  CASE 
    WHEN q.seller_id IS NULL THEN '❌ seller_id NULL'
    WHEN q.seller_id != l.seller_id THEN '❌ seller_id NO COINCIDE con listing'
    WHEN q.seller_id = l.seller_id THEN '✅ seller_id CORRECTO'
    ELSE '⚠️ Estado desconocido'
  END as estado_seller_id
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.seller_id = 'AQUI_VA_EL_UUID'  -- ⚠️ REEMPLAZA ESTO con un UUID del PASO 1
  AND q.is_deleted = false
ORDER BY q.created_at DESC;

-- PASO 3: Ver preguntas que NO tienen seller_id pero pertenecen a listings de un usuario
-- ⚠️ IMPORTANTE: Reemplaza 'AQUI_VA_EL_UUID' con el mismo UUID del PASO 2
SELECT 
  q.id as pregunta_id,
  q.seller_id as seller_id_en_pregunta,
  l.seller_id as seller_id_del_listing,
  q.listing_id,
  l.title as listing_title,
  LEFT(q.question_text, 80) as pregunta_texto,
  q.answer_text,
  q.created_at,
  '⚠️ Esta pregunta NO tiene seller_id o tiene uno incorrecto' as problema
FROM public.listing_questions q
JOIN public.listings l ON l.id = q.listing_id
WHERE l.seller_id = 'AQUI_VA_EL_UUID'  -- ⚠️ REEMPLAZA ESTO con el mismo UUID del PASO 2
  AND q.is_deleted = false
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
ORDER BY q.created_at DESC;
