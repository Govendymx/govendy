-- ============================================
-- VERIFICACIÓN RÁPIDA: Trigger Activo
-- ============================================
-- Ejecuta este SQL para verificar que el trigger está funcionando

-- 1. Estado del trigger
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
WHERE tgname = 'trg_notify_asker_on_question_answer';

-- 2. Función existe
SELECT 
  'FUNCIÓN' as tipo,
  proname as nombre,
  '✅ EXISTE' as estado,
  NULL::regclass as tabla
FROM pg_proc
WHERE proname = 'notify_asker_on_question_answer';

-- 3. Próxima prueba: Responde una pregunta nueva y ejecuta esto para verificar
-- (Después de responder, ejecuta la consulta de abajo)

SELECT 
  'INSTRUCCIONES' as tipo,
  'Responde una pregunta nueva desde /dashboard/preguntas' as nombre,
  'Luego ejecuta la consulta de abajo para verificar' as estado,
  NULL::regclass as tabla;
