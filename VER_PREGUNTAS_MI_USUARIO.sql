-- Script SIMPLIFICADO para ver tus preguntas
-- Este script usa auth.uid() para obtener automáticamente tu ID de usuario
-- Ejecuta este SQL en Supabase SQL Editor (debes estar autenticado)

-- ============================================
-- 1. VER TODAS TUS PREGUNTAS (usa tu ID automáticamente)
-- ============================================
SELECT 
  lq.id,
  lq.listing_id,
  lq.seller_id,
  lq.asker_id,
  LEFT(lq.question_text, 100) as pregunta_completa,
  lq.answer_text,
  CASE 
    WHEN lq.answer_text IS NULL THEN 'NULL - Debe mostrarse'
    WHEN TRIM(lq.answer_text) = '' THEN 'VACÍO - Debe mostrarse'
    ELSE 'TIENE RESPUESTA: ' || LEFT(lq.answer_text, 30)
  END as estado_respuesta,
  lq.is_deleted,
  lq.created_at,
  lq.answered_at,
  l.title as listing_title,
  CASE 
    WHEN lq.created_at > NOW() THEN '⚠️ FECHA FUTURA'
    ELSE 'OK'
  END as validacion_fecha
FROM public.listing_questions lq
LEFT JOIN public.listings l ON l.id = lq.listing_id
WHERE (
  lq.seller_id = auth.uid()
  OR lq.listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = auth.uid()
  )
)
AND lq.is_deleted = false
ORDER BY lq.created_at DESC;

-- ============================================
-- 2. VER PREGUNTAS DUPLICADAS
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
  seller_id = auth.uid()
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = auth.uid()
  )
)
AND is_deleted = false
GROUP BY listing_id, asker_id, question_text
HAVING COUNT(*) > 1;

-- ============================================
-- 3. ELIMINAR PREGUNTAS CON FECHAS FUTURAS
-- ============================================
-- Descomenta para ejecutar:
/*
UPDATE public.listing_questions
SET is_deleted = true
WHERE (
  seller_id = auth.uid()
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = auth.uid()
  )
)
AND is_deleted = false
AND created_at > NOW();
*/

-- ============================================
-- 4. ELIMINAR DUPLICADOS (mantener solo la más reciente)
-- ============================================
-- Descomenta para ejecutar:
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
    seller_id = auth.uid()
    OR listing_id IN (
      SELECT id FROM public.listings WHERE seller_id = auth.uid()
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
