-- SOLUCIÓN COMPLETA: Eliminar pregunta vieja y corregir datos
-- IMPORTANTE: Reemplaza 'TU_USER_ID_AQUI' con tu ID de usuario
--
-- Para obtener tu ID desde la aplicación:
-- 1. Abre http://localhost:3002/dashboard/preguntas
-- 2. Haz clic en el botón "Debug" (arriba a la derecha)
-- 3. Copia el "TU USER ID" que aparece en el mensaje
-- 4. Reemplázalo en este script

-- ============================================
-- PASO 1: Ver todas tus preguntas
-- ============================================
SELECT 
  lq.id,
  lq.listing_id,
  lq.seller_id,
  lq.asker_id,
  LEFT(lq.question_text, 100) as pregunta,
  lq.answer_text,
  CASE 
    WHEN lq.answer_text IS NULL THEN 'NULL - Debe mostrarse'
    WHEN TRIM(lq.answer_text) = '' THEN 'VACÍO - Debe mostrarse'
    ELSE 'TIENE RESPUESTA'
  END as estado_respuesta,
  lq.is_deleted,
  lq.created_at,
  CASE 
    WHEN lq.created_at > NOW() THEN '⚠️ FECHA FUTURA'
    ELSE 'OK'
  END as validacion_fecha
FROM public.listing_questions lq
WHERE (
  lq.seller_id = 'TU_USER_ID_AQUI'::uuid
  OR lq.listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND lq.is_deleted = false
ORDER BY lq.created_at DESC;

-- ============================================
-- PASO 2: Eliminar preguntas con fechas futuras
-- ============================================
-- Descomenta y ejecuta (reemplaza 'TU_USER_ID_AQUI'):
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

-- ============================================
-- PASO 3: Corregir respuestas "fantasma" (solo espacios)
-- ============================================
-- Descomenta y ejecuta (reemplaza 'TU_USER_ID_AQUI'):
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
*/

-- ============================================
-- PASO 4: Verificar resultado final
-- ============================================
-- Ejecuta esto después de los pasos anteriores:
SELECT 
  COUNT(*) FILTER (WHERE answer_text IS NULL OR TRIM(answer_text) = '') as sin_respuesta,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND TRIM(answer_text) != '') as con_respuesta,
  COUNT(*) FILTER (WHERE created_at > NOW()) as con_fecha_futura,
  COUNT(*) as total
FROM public.listing_questions
WHERE (
  seller_id = 'TU_USER_ID_AQUI'::uuid
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND is_deleted = false;
