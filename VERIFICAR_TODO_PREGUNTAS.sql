-- ============================================
-- VERIFICACIÓN COMPLETA: Sistema de Preguntas
-- Ejecuta esto en Supabase → SQL Editor
-- Verifica que todo esté funcionando correctamente
-- ============================================

-- PASO 1: Verificar que la función update_question_answer existe
SELECT 
  'FUNCIÓN SQL' as tipo,
  routine_name as nombre,
  routine_type as tipo_funcion,
  security_type as seguridad,
  CASE 
    WHEN routine_name = 'update_question_answer' THEN '✅ Existe'
    ELSE '❌ No existe'
  END as estado
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_question_answer';

-- PASO 2: Verificar políticas RLS de listing_questions
SELECT 
  'POLÍTICAS RLS' as tipo,
  policyname as nombre,
  cmd as operacion,
  CASE 
    WHEN cmd = 'UPDATE' AND policyname LIKE '%answer%' THEN '✅ Política de UPDATE para respuestas'
    WHEN cmd = 'SELECT' THEN '✅ Política de SELECT'
    ELSE '⚠️ Otra política'
  END as estado
FROM pg_policies
WHERE tablename = 'listing_questions'
ORDER BY cmd, policyname;

-- PASO 3: Verificar estado de preguntas (global)
SELECT 
  'ESTADO GLOBAL' as tipo,
  COUNT(*) FILTER (WHERE is_deleted = false) as total_activas,
  COUNT(*) FILTER (WHERE is_deleted = false AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')) as sin_respuesta,
  COUNT(*) FILTER (WHERE is_deleted = false AND answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') as con_respuesta,
  COUNT(*) FILTER (WHERE is_deleted = false AND seller_id IS NULL) as sin_seller_id,
  COUNT(*) FILTER (WHERE is_deleted = false AND answer_text IS NOT NULL AND answer_text != '' AND answered_at IS NULL) as con_respuesta_sin_answered_at,
  COUNT(*) FILTER (WHERE is_deleted = false AND (answer_text IS NULL OR answer_text = '') AND answered_at IS NOT NULL) as sin_respuesta_con_answered_at
FROM public.listing_questions;

-- PASO 4: Verificar preguntas con datos inconsistentes (answered_at sin answer_text)
SELECT 
  'INCONSISTENCIAS' as tipo,
  id,
  seller_id,
  listing_id,
  CASE 
    WHEN answer_text IS NULL OR answer_text = '' THEN 'Sin respuesta'
    ELSE 'Con respuesta'
  END as estado_respuesta,
  answered_at,
  created_at,
  'PROBLEMA: answered_at sin answer_text' as problema
FROM public.listing_questions
WHERE is_deleted = false
  AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')
  AND answered_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- PASO 5: Verificar preguntas con answer_text sin answered_at
SELECT 
  'INCONSISTENCIAS' as tipo,
  id,
  seller_id,
  listing_id,
  answer_text,
  answered_at,
  created_at,
  'PROBLEMA: answer_text sin answered_at' as problema
FROM public.listing_questions
WHERE is_deleted = false
  AND answer_text IS NOT NULL
  AND answer_text != ''
  AND TRIM(answer_text) != ''
  AND answered_at IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- PASO 6: Verificar triggers de notificaciones
SELECT 
  'TRIGGERS' as tipo,
  trigger_name as nombre,
  event_manipulation as evento,
  action_timing as momento,
  CASE 
    WHEN trigger_name LIKE '%question%' OR trigger_name LIKE '%answer%' THEN '✅ Trigger relacionado con preguntas'
    ELSE '⚠️ Otro trigger'
  END as estado
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%question%' OR trigger_name LIKE '%answer%')
ORDER BY trigger_name;

-- PASO 7: Estadísticas por vendedor (primeros 10)
SELECT 
  'POR VENDEDOR' as tipo,
  seller_id,
  COUNT(*) FILTER (WHERE is_deleted = false) as total,
  COUNT(*) FILTER (WHERE is_deleted = false AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')) as sin_respuesta,
  COUNT(*) FILTER (WHERE is_deleted = false AND answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') as con_respuesta
FROM public.listing_questions
WHERE seller_id IS NOT NULL
  AND is_deleted = false
GROUP BY seller_id
ORDER BY sin_respuesta DESC, total DESC
LIMIT 10;
