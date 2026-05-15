-- ============================================
-- VERIFICAR TODAS LAS PREGUNTAS SIN RESPUESTA
-- Ejecuta esto en Supabase → SQL Editor
-- NO necesitas reemplazar nada, muestra TODO
-- ============================================

-- Ver TODAS las preguntas sin respuesta con información completa
SELECT 
  q.id as pregunta_id,
  q.seller_id,
  q.listing_id,
  l.title as listing_title,
  l.seller_id as seller_id_del_listing,
  LEFT(q.question_text, 80) as pregunta_texto,
  q.answer_text,
  q.answered_at,
  q.created_at,
  CASE 
    WHEN q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '' 
    THEN '❌ SIN RESPUESTA'
    ELSE '✅ CON RESPUESTA'
  END as estado_respuesta,
  CASE 
    WHEN q.seller_id IS NULL THEN '❌ seller_id NULL'
    WHEN q.seller_id != l.seller_id THEN '❌ seller_id NO COINCIDE con listing'
    WHEN q.seller_id = l.seller_id THEN '✅ seller_id CORRECTO'
    ELSE '⚠️ Estado desconocido'
  END as estado_seller_id,
  CASE 
    WHEN q.seller_id IS NULL THEN 'PROBLEMA: No tiene seller_id'
    WHEN q.seller_id != l.seller_id THEN 'PROBLEMA: seller_id incorrecto'
    WHEN q.seller_id = l.seller_id AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '') THEN 'OK: Debería aparecer en dashboard'
    ELSE 'OK: Tiene respuesta'
  END as diagnostico
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
  AND q.answered_at IS NULL
ORDER BY 
  CASE 
    WHEN q.seller_id IS NULL THEN 1
    WHEN q.seller_id != l.seller_id THEN 2
    ELSE 3
  END,
  q.created_at DESC;

-- Resumen por seller_id
SELECT 
  q.seller_id,
  COUNT(*) as total_preguntas_sin_respuesta,
  COUNT(*) FILTER (WHERE q.seller_id IS NULL) as con_seller_id_null,
  COUNT(*) FILTER (WHERE q.seller_id != l.seller_id) as con_seller_id_incorrecto,
  COUNT(*) FILTER (WHERE q.seller_id = l.seller_id) as con_seller_id_correcto,
  ARRAY_AGG(q.id ORDER BY q.created_at DESC) FILTER (WHERE q.id IS NOT NULL) as pregunta_ids
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
  AND q.answered_at IS NULL
GROUP BY q.seller_id
ORDER BY total_preguntas_sin_respuesta DESC;
