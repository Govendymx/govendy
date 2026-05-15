-- Script para identificar y corregir preguntas viejas que no se borran
-- Ejecuta este SQL en Supabase SQL Editor
-- Reemplaza 'TU_USER_ID_AQUI' con el ID del vendedor

-- ============================================
-- 1. VER TODAS LAS PREGUNTAS DEL VENDEDOR CON DETALLES
-- ============================================
SELECT 
  lq.id,
  lq.listing_id,
  lq.seller_id,
  lq.asker_id,
  LEFT(lq.question_text, 50) as pregunta_preview,
  lq.answer_text,
  CASE 
    WHEN lq.answer_text IS NULL THEN 'NULL'
    WHEN TRIM(lq.answer_text) = '' THEN 'VACÍO (solo espacios)'
    ELSE 'TIENE RESPUESTA: ' || LEFT(lq.answer_text, 30)
  END as estado_respuesta,
  lq.answer_text IS NULL OR TRIM(lq.answer_text) = '' as deberia_mostrarse,
  lq.is_deleted,
  lq.created_at,
  lq.answered_at,
  l.title as listing_title,
  -- Verificar si tiene fecha futura (anomalía)
  CASE 
    WHEN lq.created_at > NOW() THEN '⚠️ FECHA FUTURA'
    ELSE 'OK'
  END as validacion_fecha
FROM public.listing_questions lq
LEFT JOIN public.listings l ON l.id = lq.listing_id
WHERE (
  lq.seller_id = 'TU_USER_ID_AQUI'::uuid
  OR lq.listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND lq.is_deleted = false
ORDER BY lq.created_at DESC;

-- ============================================
-- 2. IDENTIFICAR PREGUNTAS CON RESPUESTAS "FANTASMA" (solo espacios, caracteres especiales, etc.)
-- ============================================
SELECT 
  lq.id,
  lq.question_text,
  lq.answer_text,
  LENGTH(lq.answer_text) as longitud_original,
  LENGTH(TRIM(lq.answer_text)) as longitud_sin_espacios,
  CASE 
    WHEN lq.answer_text IS NULL THEN 'NULL - Debería mostrarse'
    WHEN TRIM(lq.answer_text) = '' THEN 'VACÍO - Debería mostrarse'
    WHEN LENGTH(TRIM(lq.answer_text)) < 3 THEN 'MUY CORTA - Posible error'
    ELSE 'TIENE RESPUESTA VÁLIDA'
  END as diagnostico,
  lq.created_at,
  lq.answered_at
FROM public.listing_questions lq
WHERE (
  lq.seller_id = 'TU_USER_ID_AQUI'::uuid
  OR lq.listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND lq.is_deleted = false
AND (
  -- Preguntas que tienen answer_text pero deberían mostrarse (respuestas inválidas)
  (lq.answer_text IS NOT NULL AND TRIM(lq.answer_text) = '')
  OR (lq.answer_text IS NOT NULL AND LENGTH(TRIM(lq.answer_text)) < 3)
)
ORDER BY lq.created_at DESC;

-- ============================================
-- 3. CORREGIR PREGUNTAS CON RESPUESTAS "FANTASMA" (marcar answer_text como NULL)
-- ============================================
-- Descomenta estas líneas para corregir automáticamente:
/*
UPDATE public.listing_questions
SET 
  answer_text = NULL,
  answered_at = NULL
WHERE (
  seller_id = 'TU_USER_ID_AQUI'::uuid
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND is_deleted = false
AND answer_text IS NOT NULL
AND TRIM(answer_text) = '';

-- Verificar que se corrigió
SELECT 
  COUNT(*) as preguntas_corregidas,
  'Preguntas con answer_text vacío ahora son NULL' as resultado
FROM public.listing_questions
WHERE (
  seller_id = 'TU_USER_ID_AQUI'::uuid
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND is_deleted = false
AND answer_text IS NULL;
*/

-- ============================================
-- 4. ELIMINAR PREGUNTAS VIEJAS ESPECÍFICAS (si conoces el ID)
-- ============================================
-- Descomenta y reemplaza 'ID_DE_LA_PREGUNTA_VIEJA' con el ID real:
/*
UPDATE public.listing_questions
SET is_deleted = true
WHERE id = 'ID_DE_LA_PREGUNTA_VIEJA'::uuid;
*/

-- ============================================
-- 5. ELIMINAR PREGUNTAS CON FECHAS FUTURAS (anomalías)
-- ============================================
-- Descomenta para marcar como eliminadas las preguntas con fechas futuras:
/*
UPDATE public.listing_questions
SET is_deleted = true
WHERE (
  seller_id = 'TU_USER_ID_AQUI'::uuid
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND is_deleted = false
AND created_at > NOW();
*/
