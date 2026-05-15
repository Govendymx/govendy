-- Script SIMPLIFICADO para ver tus preguntas
-- IMPORTANTE: Reemplaza 'TU_USER_ID_AQUI' con tu ID de usuario
-- Para obtener tu ID: 
--   1. Abre la consola del navegador (F12) en tu aplicación
--   2. Ve a la pestaña "Console"
--   3. Escribe: await supabase.auth.getUser().then(u => console.log(u.data.user.id))
--   4. Copia el ID que aparece

-- ============================================
-- PASO 1: Obtener tu User ID desde la aplicación
-- ============================================
-- Abre tu aplicación en el navegador, abre la consola (F12) y ejecuta:
-- await supabase.auth.getUser().then(u => console.log(u.data.user.id))
-- Copia el ID que aparece y úsalo abajo

-- ============================================
-- PASO 2: Ver todas tus preguntas
-- ============================================
-- Reemplaza 'TU_USER_ID_AQUI' con el ID que copiaste arriba
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
  lq.seller_id = 'TU_USER_ID_AQUI'::uuid
  OR lq.listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND lq.is_deleted = false
ORDER BY lq.created_at DESC;

-- ============================================
-- PASO 3: Eliminar preguntas con fechas futuras
-- ============================================
-- Descomenta y reemplaza 'TU_USER_ID_AQUI' con tu ID:
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
-- PASO 4: Eliminar duplicados (mantener solo la más reciente)
-- ============================================
-- Descomenta y reemplaza 'TU_USER_ID_AQUI' con tu ID:
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
