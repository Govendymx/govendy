-- ============================================
-- VERIFICAR PREGUNTAS DE UN VENDEDOR ESPECÍFICO
-- Ejecuta esto en Supabase SQL Editor
-- ============================================

-- PASO 1: Obtener tu user_id (seller_id)
-- Ve a la tabla "profiles" o usa este query para encontrar tu ID:
-- Opción A: Desde auth.users (solo tiene id y email)
SELECT 
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Opción B: Desde public.profiles (tiene más información)
SELECT 
  id,
  full_name,
  email,
  username,
  nickname
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- PASO 2: Una vez que tengas tu user_id, reemplaza 'TU_USER_ID_AQUI' abajo
-- y ejecuta esta consulta:

-- ============================================
-- VER TODAS TUS PREGUNTAS SIN RESPUESTA
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
  l.status as estado_publicacion,
  l.seller_id as seller_id_del_listing
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.seller_id = 'TU_USER_ID_AQUI'  -- ⚠️ CAMBIA ESTO por tu user_id
  AND q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
ORDER BY q.created_at DESC;

-- ============================================
-- VERIFICAR SI HAY PROBLEMAS CON seller_id
-- ============================================
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id as seller_id_en_pregunta,
  l.seller_id as seller_id_en_listing,
  CASE 
    WHEN q.seller_id = l.seller_id THEN '✅ Correcto'
    WHEN q.seller_id IS NULL THEN '⚠️ NULL en pregunta'
    WHEN l.seller_id IS NULL THEN '⚠️ NULL en listing'
    ELSE '❌ NO COINCIDE'
  END as estado,
  q.question_text,
  CASE 
    WHEN q.answer_text IS NULL OR q.answer_text = '' THEN 'Sin respuesta'
    ELSE 'Con respuesta'
  END as tiene_respuesta,
  q.created_at
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
ORDER BY q.created_at DESC;

-- ============================================
-- ENCONTRAR PREGUNTAS SIN RESPUESTA POR LISTING
-- (Útil si seller_id está NULL o incorrecto)
-- ============================================
SELECT 
  l.seller_id as vendedor_del_listing,
  COUNT(*) as preguntas_sin_respuesta,
  ARRAY_AGG(q.id) as ids_de_preguntas
FROM public.listing_questions q
INNER JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
GROUP BY l.seller_id
ORDER BY preguntas_sin_respuesta DESC;

-- ============================================
-- CORREGIR seller_id DE PREGUNTAS (SI ES NECESARIO)
-- ============================================
-- ⚠️ SOLO EJECUTA ESTO SI ENCUENTRAS PREGUNTAS CON seller_id INCORRECTO
-- UPDATE public.listing_questions q
-- SET seller_id = l.seller_id
-- FROM public.listings l
-- WHERE q.listing_id = l.id
--   AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
--   AND q.is_deleted = false;
