-- ============================================
-- Verificar asker_id en preguntas respondidas
-- Si asker_id es NULL, el comprador NO recibe notificación al responder.
-- Ejecuta en Supabase → SQL Editor
-- ============================================

-- Preguntas con respuesta pero asker_id NULL (no se puede notificar)
SELECT
  '⚠️ SIN ASKER_ID' AS estado,
  lq.id AS question_id,
  lq.listing_id,
  lq.seller_id,
  lq.asker_id,
  lq.answered_at,
  LEFT(lq.question_text, 40) AS question_preview
FROM public.listing_questions lq
WHERE lq.answer_text IS NOT NULL
  AND TRIM(lq.answer_text) <> ''
  AND (lq.asker_id IS NULL OR TRIM(lq.asker_id::text) = '')
  AND lq.is_deleted = false
ORDER BY lq.answered_at DESC
LIMIT 50;

-- Preguntas respondidas CON asker_id (notificación sí se envía)
SELECT
  '✅ CON ASKER_ID' AS estado,
  lq.id AS question_id,
  lq.asker_id,
  lq.answered_at,
  LEFT(lq.question_text, 40) AS question_preview
FROM public.listing_questions lq
WHERE lq.answer_text IS NOT NULL
  AND TRIM(lq.answer_text) <> ''
  AND lq.asker_id IS NOT NULL
  AND lq.is_deleted = false
ORDER BY lq.answered_at DESC
LIMIT 20;
