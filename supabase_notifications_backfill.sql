-- Pocket App - Backfill de notificaciones (idempotente)
-- Útil cuando ya había preguntas/ventas antes de activar triggers.
--
-- Ejecuta en Supabase → SQL Editor.
-- Requisitos:
-- - Tabla public.notifications existe (supabase_notifications.sql)
-- - Tabla public.listing_questions existe (supabase_listing_questions.sql)
-- - Si `notifications.type` es ENUM, primero corre supabase_notifications_enum_extend.sql

-- 1) Backfill: preguntas sin responder → notificar al vendedor
INSERT INTO public.notifications (user_id, type, title, body, data, is_read, created_at)
SELECT
  q.seller_id AS user_id,
  'listing_question' AS type,
  'Nueva pregunta en tu publicación' AS title,
  'Tienes una pregunta sin responder.' AS body,
  jsonb_build_object(
    'kind', 'listing_question',
    'listingId', q.listing_id,
    'questionId', q.id
  ) AS data,
  false AS is_read,
  COALESCE(q.created_at, TIMEZONE('utc'::text, NOW())) AS created_at
FROM public.listing_questions q
WHERE
  q.is_deleted = false
  AND q.answer_text IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE
      n.user_id = q.seller_id
      AND COALESCE(n.data->>'questionId','') = q.id::text
  );

-- 2) Backfill: preguntas respondidas → notificar al comprador/interesado (asker)
-- Nota: si `notifications.type` es ENUM, asegúrate de incluir 'listing_answer' en el enum:
-- corre `supabase_notifications_enum_extend.sql` antes.
INSERT INTO public.notifications (user_id, type, title, body, data, is_read, created_at)
SELECT
  q.asker_id AS user_id,
  'listing_answer' AS type,
  'El vendedor respondió tu pregunta' AS title,
  'Respondieron tu pregunta en una publicación.' AS body,
  jsonb_build_object(
    'kind', 'listing_answer',
    'listingId', q.listing_id,
    'questionId', q.id
  ) AS data,
  false AS is_read,
  -- Algunas instalaciones no tienen `updated_at` en listing_questions
  COALESCE(q.answered_at, q.created_at, TIMEZONE('utc'::text, NOW())) AS created_at
FROM public.listing_questions q
WHERE
  q.is_deleted = false
  AND q.answer_text IS NOT NULL
  AND COALESCE(q.asker_id::text, '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE
      n.user_id = q.asker_id
      AND COALESCE(n.data->>'questionId','') = q.id::text
  );

