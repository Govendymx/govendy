-- ============================================
-- VERIFICACIÓN FINAL: Estado de Notificaciones
-- ============================================
-- Ejecuta este SQL para verificar que TODO está configurado correctamente
-- Este script SÍ devuelve filas, así que verás los resultados claramente

-- ============================================
-- 1. Verificar Trigger
-- ============================================
SELECT 
  'TRIGGER' as tipo,
  tgname as nombre,
  CASE 
    WHEN tgenabled = 'O' THEN '✅ ACTIVO'
    WHEN tgenabled = 'D' THEN '❌ DESHABILITADO'
    ELSE '⚠️ ' || COALESCE(tgenabled::text, 'DESCONOCIDO')
  END as estado,
  tgrelid::regclass as tabla
FROM pg_trigger 
WHERE tgname = 'trg_notify_asker_on_question_answer'
UNION ALL
-- ============================================
-- 2. Verificar Función
-- ============================================
SELECT 
  'FUNCIÓN' as tipo,
  proname as nombre,
  CASE 
    WHEN proname IS NOT NULL THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado,
  NULL::regclass as tabla
FROM pg_proc 
WHERE proname = 'notify_asker_on_question_answer'
UNION ALL
-- ============================================
-- 3. Verificar Tabla notifications
-- ============================================
SELECT 
  'TABLA' as tipo,
  'notifications' as nombre,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') 
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado,
  NULL::regclass as tabla
UNION ALL
-- ============================================
-- 4. Verificar Tabla listing_questions
-- ============================================
SELECT 
  'TABLA' as tipo,
  'listing_questions' as nombre,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'listing_questions') 
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado,
  NULL::regclass as tabla
UNION ALL
-- ============================================
-- 5. Verificar Columna asker_id
-- ============================================
SELECT 
  'COLUMNA' as tipo,
  'listing_questions.asker_id' as nombre,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'listing_questions' AND column_name = 'asker_id'
    ) 
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado,
  NULL::regclass as tabla
UNION ALL
-- ============================================
-- 6. Verificar Políticas RLS de notifications
-- ============================================
SELECT 
  'POLÍTICA RLS' as tipo,
  policyname as nombre,
  '✅ ACTIVA' as estado,
  NULL::regclass as tabla
FROM pg_policies 
WHERE tablename = 'notifications'
LIMIT 2;

-- ============================================
-- RESUMEN: Preguntas respondidas recientes
-- ============================================
SELECT 
  'RESUMEN' as seccion,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND answer_text != '') as preguntas_respondidas,
  COUNT(*) FILTER (WHERE answer_text IS NULL OR answer_text = '') as preguntas_pendientes
FROM listing_questions
WHERE is_deleted = false;

-- ============================================
-- RESUMEN: Notificaciones creadas recientemente
-- ============================================
SELECT 
  'NOTIFICACIONES' as seccion,
  COUNT(*) FILTER (WHERE data->>'kind' = 'listing_answer') as notificaciones_respuestas,
  COUNT(*) FILTER (WHERE data->>'kind' = 'listing_answer' AND is_read = false) as no_leidas
FROM notifications
WHERE created_at > NOW() - INTERVAL '7 days';
