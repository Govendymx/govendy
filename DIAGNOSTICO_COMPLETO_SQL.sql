-- ============================================
-- DIAGNÓSTICO COMPLETO: Preguntas y Notificaciones
-- ============================================
-- Ejecuta este SQL en Supabase para diagnosticar el problema
-- Este script NO modifica nada, solo muestra información

-- ============================================
-- 1. Verificar que las tablas existen
-- ============================================
SELECT 
  'TABLAS' as categoria,
  table_name as nombre,
  CASE 
    WHEN table_name = 'notifications' THEN '✅ EXISTE'
    WHEN table_name = 'listing_questions' THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('notifications', 'listing_questions')
ORDER BY table_name;

-- ============================================
-- 2. Verificar triggers
-- ============================================
SELECT 
  'TRIGGERS' as categoria,
  tgname as nombre,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ ACTIVO'
    WHEN tgenabled = 'D' THEN '❌ DESHABILITADO'
    ELSE '⚠️ ' || COALESCE(tgenabled::text, 'DESCONOCIDO')
  END as estado,
  tgrelid::regclass as tabla
FROM pg_trigger
WHERE tgname IN (
  'trg_notify_asker_on_question_answer',
  'trg_notify_seller_on_new_question'
)
ORDER BY tgname;

-- ============================================
-- 3. Verificar funciones
-- ============================================
SELECT 
  'FUNCIONES' as categoria,
  proname as nombre,
  '✅ EXISTE' as estado,
  NULL::regclass as tabla
FROM pg_proc
WHERE proname IN (
  'notify_asker_on_question_answer',
  'notify_seller_on_new_question'
)
ORDER BY proname;

-- ============================================
-- 4. Verificar políticas RLS de listing_questions
-- ============================================
SELECT 
  'POLÍTICAS RLS' as categoria,
  policyname as nombre,
  '✅ ACTIVA' as estado,
  NULL::regclass as tabla
FROM pg_policies
WHERE tablename = 'listing_questions'
ORDER BY policyname;

-- ============================================
-- 5. Verificar preguntas recientes y sus respuestas
-- ============================================
SELECT 
  'PREGUNTAS' as categoria,
  id::text as nombre,
  CASE 
    WHEN answer_text IS NOT NULL AND answer_text != '' THEN '✅ RESPONDIDA'
    ELSE '⏳ PENDIENTE'
  END as estado,
  NULL::regclass as tabla,
  seller_id::text as seller_id,
  asker_id::text as asker_id,
  CASE 
    WHEN answer_text IS NOT NULL THEN LEFT(answer_text, 30)
    ELSE NULL
  END as respuesta_preview,
  created_at,
  answered_at
FROM listing_questions
WHERE is_deleted = false
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 6. Verificar notificaciones recientes
-- ============================================
SELECT 
  'NOTIFICACIONES' as categoria,
  id::text as nombre,
  CASE 
    WHEN is_read = false THEN '🔔 NO LEÍDA'
    ELSE '✅ LEÍDA'
  END as estado,
  NULL::regclass as tabla,
  user_id::text as user_id,
  type,
  title,
  data->>'questionId' as question_id,
  data->>'kind' as kind,
  created_at
FROM notifications
WHERE data->>'kind' = 'listing_answer'
   OR type = 'listing_answer'
   OR title LIKE '%respondió tu pregunta%'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 7. Verificar si hay preguntas respondidas SIN notificación
-- ============================================
SELECT 
  'PROBLEMA DETECTADO' as categoria,
  q.id::text as nombre,
  '❌ SIN NOTIFICACIÓN' as estado,
  NULL::regclass as tabla,
  q.asker_id::text as asker_id_deberia_tener_notificacion,
  q.answer_text IS NOT NULL as tiene_respuesta,
  CASE 
    WHEN n.id IS NULL THEN '❌ NO HAY NOTIFICACIÓN'
    ELSE '✅ HAY NOTIFICACIÓN'
  END as tiene_notificacion,
  q.created_at as pregunta_creada,
  q.answered_at as pregunta_respondida
FROM listing_questions q
LEFT JOIN notifications n ON (
  n.user_id = q.asker_id 
  AND (n.data->>'questionId' = q.id::text OR n.data->>'kind' = 'listing_answer')
  AND n.created_at > q.answered_at - INTERVAL '1 minute'
)
WHERE q.answer_text IS NOT NULL 
  AND q.answer_text != ''
  AND q.is_deleted = false
  AND q.answered_at > NOW() - INTERVAL '7 days'
ORDER BY q.answered_at DESC
LIMIT 10;
