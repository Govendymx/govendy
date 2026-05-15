-- ============================================
-- VERIFICAR: Preguntas que deberían aparecer para un usuario específico
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- PASO 1: Ver TODOS los usuarios con preguntas (ejecuta esto primero)
-- Copia el seller_id del usuario que quieres verificar
SELECT DISTINCT 
  q.seller_id,
  COUNT(*) as total_preguntas,
  COUNT(*) FILTER (WHERE q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '') as sin_respuesta,
  COUNT(*) FILTER (WHERE q.answer_text IS NOT NULL AND q.answer_text != '' AND TRIM(q.answer_text) != '') as con_respuesta
FROM public.listing_questions q
WHERE q.is_deleted = false
  AND q.seller_id IS NOT NULL
GROUP BY q.seller_id
ORDER BY sin_respuesta DESC, total_preguntas DESC;

-- PASO 2: Verificar preguntas por seller_id directo
-- ⚠️ IMPORTANTE: Reemplaza el UUID de abajo con uno de los seller_id del PASO 1
-- Ejemplo: WHERE q.seller_id = '65e2306b-c119-48c2-b141-3df37c00878b'
SELECT 
  'POR SELLER_ID' as tipo_busqueda,
  q.id,
  q.seller_id,
  q.listing_id,
  LEFT(q.question_text, 50) as pregunta,
  q.answer_text,
  q.answered_at,
  CASE 
    WHEN q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '' 
    THEN 'SIN RESPUESTA'
    ELSE 'CON RESPUESTA'
  END as estado
FROM public.listing_questions q
WHERE q.seller_id = 'REEMPLAZA_CON_UN_UUID_DE_ARRIBA'  -- ⚠️ REEMPLAZA ESTO con un UUID del PASO 1
  AND q.is_deleted = false
ORDER BY q.created_at DESC;

-- PASO 3: Verificar listings del usuario
-- ⚠️ IMPORTANTE: Reemplaza el UUID de abajo con el mismo seller_id del PASO 2
SELECT 
  'LISTINGS DEL USUARIO' as tipo,
  l.id as listing_id,
  l.title,
  l.seller_id,
  COUNT(q.id) as total_preguntas,
  COUNT(*) FILTER (WHERE q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '') as sin_respuesta
FROM public.listings l
LEFT JOIN public.listing_questions q ON q.listing_id = l.id AND q.is_deleted = false
WHERE l.seller_id = 'REEMPLAZA_CON_EL_MISMO_UUID'  -- ⚠️ REEMPLAZA ESTO con el mismo UUID del PASO 2
GROUP BY l.id, l.title, l.seller_id
ORDER BY total_preguntas DESC;

-- PASO 4: Verificar preguntas por listing_id (fallback cuando seller_id es NULL o incorrecto)
-- ⚠️ IMPORTANTE: Reemplaza el UUID de abajo con el mismo seller_id del PASO 2
SELECT 
  'POR LISTING_ID (FALLBACK)' as tipo_busqueda,
  q.id,
  q.seller_id as seller_id_en_pregunta,
  l.seller_id as seller_id_del_listing,
  q.listing_id,
  LEFT(q.question_text, 50) as pregunta,
  q.answer_text,
  q.answered_at,
  CASE 
    WHEN q.seller_id IS NULL THEN '❌ seller_id NULL'
    WHEN q.seller_id != l.seller_id THEN '❌ seller_id NO COINCIDE'
    WHEN q.seller_id = l.seller_id THEN '✅ seller_id CORRECTO'
    ELSE '⚠️ Estado desconocido'
  END as estado_seller_id,
  CASE 
    WHEN q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '' 
    THEN 'SIN RESPUESTA'
    ELSE 'CON RESPUESTA'
  END as estado_respuesta
FROM public.listing_questions q
JOIN public.listings l ON l.id = q.listing_id
WHERE l.seller_id = 'REEMPLAZA_CON_EL_MISMO_UUID'  -- ⚠️ REEMPLAZA ESTO con el mismo UUID del PASO 2
  AND q.is_deleted = false
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
ORDER BY q.created_at DESC;

-- PASO 5: Resumen final - Todas las preguntas que deberían aparecer
-- ⚠️ IMPORTANTE: Reemplaza el UUID de abajo con el mismo seller_id del PASO 2
SELECT 
  'RESUMEN FINAL' as tipo,
  COUNT(*) FILTER (WHERE q.seller_id = l.seller_id AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')) as sin_respuesta_con_seller_id_correcto,
  COUNT(*) FILTER (WHERE (q.seller_id IS NULL OR q.seller_id != l.seller_id) AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')) as sin_respuesta_con_seller_id_incorrecto,
  COUNT(*) FILTER (WHERE (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')) as total_sin_respuesta
FROM public.listing_questions q
JOIN public.listings l ON l.id = q.listing_id
WHERE l.seller_id = 'REEMPLAZA_CON_EL_MISMO_UUID'  -- ⚠️ REEMPLAZA ESTO con el mismo UUID del PASO 2
  AND q.is_deleted = false;
