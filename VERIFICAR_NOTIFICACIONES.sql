-- ============================================
-- VERIFICAR: Estado de las notificaciones
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- 1. Verificar que la tabla existe
SELECT 
  'TABLA' as tipo,
  table_name as nombre,
  table_schema as esquema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'notifications';

-- 2. Verificar columnas de la tabla
SELECT 
  'COLUMNA' as tipo,
  column_name as nombre,
  data_type as tipo_dato,
  is_nullable as puede_ser_null
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
ORDER BY ordinal_position;

-- 3. Verificar si hay un ENUM para notification_type
SELECT 
  'ENUM' as tipo,
  t.typname as nombre_enum,
  e.enumlabel as valor_enum
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%notification%' OR t.typname LIKE '%notif%'
ORDER BY t.typname, e.enumsortorder;

-- 4. Ver las últimas notificaciones creadas
-- Nota: Usamos solo las columnas que existen (body o message según el esquema)
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  is_read,
  created_at,
  data
FROM public.notifications
ORDER BY created_at DESC
LIMIT 20;

-- 5. Verificar notificaciones de preguntas y respuestas específicamente
SELECT 
  'NOTIFICACIONES DE PREGUNTAS' as tipo,
  COUNT(*) FILTER (WHERE type = 'listing_question' OR (data->>'kind') = 'listing_question') as preguntas,
  COUNT(*) FILTER (WHERE type = 'listing_answer' OR (data->>'kind') = 'listing_answer') as respuestas,
  COUNT(*) as total
FROM public.notifications;

-- 6. Ver notificaciones recientes de preguntas/respuestas
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  created_at,
  is_read,
  data->>'kind' as kind,
  data->>'listingId' as listing_id,
  data->>'questionId' as question_id
FROM public.notifications
WHERE (type IN ('listing_question', 'listing_answer')
   OR (data->>'kind') IN ('listing_question', 'listing_answer'))
   AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;
