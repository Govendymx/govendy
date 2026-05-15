-- Script de verificación para diagnosticar problemas de notificaciones
-- Ejecuta este SQL en Supabase → SQL Editor

-- 1. Verificar que el trigger existe
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trg_notify_asker_on_question_answer';

-- 2. Verificar que la función existe
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc 
WHERE proname = 'notify_asker_on_question_answer';

-- 3. Verificar preguntas recientes con asker_id
SELECT 
  id,
  asker_id,
  seller_id,
  listing_id,
  answer_text IS NOT NULL as has_answer,
  created_at
FROM listing_questions 
ORDER BY created_at DESC 
LIMIT 10;

-- 4. Verificar notificaciones recientes
SELECT 
  id,
  user_id,
  type,
  title,
  is_read,
  created_at,
  data->>'questionId' as question_id
FROM notifications 
WHERE data->>'kind' = 'listing_answer'
ORDER BY created_at DESC 
LIMIT 10;

-- 5. Verificar si hay preguntas respondidas sin notificación
SELECT 
  q.id as question_id,
  q.asker_id,
  q.answer_text IS NOT NULL as has_answer,
  q.answered_at,
  CASE 
    WHEN n.id IS NULL THEN 'SIN NOTIFICACIÓN'
    ELSE 'CON NOTIFICACIÓN'
  END as notification_status,
  n.id as notification_id
FROM listing_questions q
LEFT JOIN notifications n ON (
  n.user_id = q.asker_id 
  AND n.data->>'questionId' = q.id::text
  AND n.data->>'kind' = 'listing_answer'
)
WHERE q.answer_text IS NOT NULL
  AND q.is_deleted = false
ORDER BY q.answered_at DESC NULLS LAST
LIMIT 20;
