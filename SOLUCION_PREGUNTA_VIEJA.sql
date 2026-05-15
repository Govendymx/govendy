-- Script para corregir el problema de la pregunta vieja
-- Ejecuta este SQL en Supabase SQL Editor
-- Reemplaza 'TU_USER_ID_AQUI' con el ID del vendedor

-- ============================================
-- 1. VER TODAS LAS PREGUNTAS CON SUS IDs COMPLETOS
-- ============================================
SELECT 
  lq.id,
  lq.listing_id,
  lq.seller_id,
  lq.asker_id,
  LEFT(lq.question_text, 100) as pregunta_completa,
  lq.answer_text,
  lq.is_deleted,
  lq.created_at,
  lq.answered_at,
  l.title as listing_title,
  -- Verificar si tiene fecha futura
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
-- 2. CORREGIR FECHAS FUTURAS (marcar como eliminadas o corregir fecha)
-- ============================================
-- OPCIÓN A: Marcar como eliminadas las preguntas con fechas futuras
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

-- OPCIÓN B: Corregir la fecha a la fecha actual (si quieres mantenerlas)
/*
UPDATE public.listing_questions
SET created_at = NOW()
WHERE (
  seller_id = 'TU_USER_ID_AQUI'::uuid
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND is_deleted = false
AND created_at > NOW();
*/

-- ============================================
-- 3. ELIMINAR PREGUNTA VIEJA ESPECÍFICA (si conoces el ID)
-- ============================================
-- Si quieres eliminar una pregunta específica, descomenta y reemplaza el ID:
/*
UPDATE public.listing_questions
SET is_deleted = true
WHERE id = 'ID_DE_LA_PREGUNTA_VIEJA_AQUI'::uuid;
*/

-- ============================================
-- 4. VERIFICAR PREGUNTAS DUPLICADAS (mismo listing_id, mismo asker_id, misma pregunta)
-- ============================================
SELECT 
  listing_id,
  asker_id,
  question_text,
  COUNT(*) as cantidad,
  array_agg(id ORDER BY created_at) as ids,
  array_agg(created_at ORDER BY created_at) as fechas
FROM public.listing_questions
WHERE (
  seller_id = 'TU_USER_ID_AQUI'::uuid
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND is_deleted = false
GROUP BY listing_id, asker_id, question_text
HAVING COUNT(*) > 1;

-- ============================================
-- 5. ELIMINAR DUPLICADOS (mantener solo la más reciente)
-- ============================================
-- Descomenta para eliminar duplicados, manteniendo solo la pregunta más reciente:
/*
WITH duplicados AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY listing_id, asker_id, question_text 
      ORDER BY created_at DESC
    ) as rn
  FROM public.listing_questions
  WHERE (
    seller_id = 'TU_USER_ID_AQUI'::uuid
    OR listing_id IN (
      SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
    )
  )
  AND is_deleted = false
)
UPDATE public.listing_questions
SET is_deleted = true
WHERE id IN (
  SELECT id FROM duplicados WHERE rn > 1
);
*/
