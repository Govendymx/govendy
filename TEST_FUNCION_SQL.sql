-- ============================================
-- TEST: Probar la función SQL directamente
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================
-- Este script te permite probar la función SQL directamente
-- para verificar que funciona correctamente

-- PASO 1: Verificar que la función existe
SELECT 
  routine_name,
  routine_type,
  security_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_question_answer';

-- PASO 2: Obtener una pregunta sin respuesta para probar
-- (Reemplaza 'TU_USER_ID' con un ID de vendedor real)
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id,
  q.question_text,
  q.answer_text,
  l.seller_id as seller_id_del_listing
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '')
  AND q.seller_id IS NOT NULL
LIMIT 5;

-- PASO 3: Probar la función SQL directamente
-- (Reemplaza los valores con datos reales de una pregunta)
-- SELECT public.update_question_answer(
--   'PREGUNTA_ID_AQUI'::uuid,
--   'Esta es una respuesta de prueba',
--   'SELLER_ID_AQUI'::uuid
-- );

-- PASO 4: Verificar que se guardó
-- SELECT 
--   id,
--   answer_text,
--   answered_at,
--   seller_id
-- FROM public.listing_questions
-- WHERE id = 'PREGUNTA_ID_AQUI'::uuid;
