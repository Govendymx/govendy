-- ============================================
-- VERIFICACIÓN COMPLETA: Configuración de Base de Datos
-- ============================================
-- Ejecuta este SQL después de ejecutar TODOS_LOS_SQL_CONSOLIDADOS.sql
-- Este script verifica que todas las tablas, triggers y funciones estén configuradas

-- ============================================
-- 1. Verificar Tablas Principales
-- ============================================
SELECT 
  'TABLA' as tipo,
  table_name as nombre,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name)
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado
FROM (VALUES 
  ('notifications'),
  ('listing_questions'),
  ('support_conversations'),
  ('support_messages'),
  ('disputes'),
  ('dispute_messages'),
  ('profiles'),
  ('listings'),
  ('orders'),
  ('cart_items'),
  ('favorites')
) AS t(table_name)
ORDER BY table_name;

-- ============================================
-- 2. Verificar Triggers de Notificaciones
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
WHERE tgname LIKE '%notify%'
ORDER BY tgname;

-- ============================================
-- 3. Verificar Funciones de Notificaciones
-- ============================================
SELECT 
  'FUNCIÓN' as tipo,
  proname as nombre,
  '✅ EXISTE' as estado,
  NULL::regclass as tabla
FROM pg_proc
WHERE proname LIKE '%notify%'
ORDER BY proname;

-- ============================================
-- 4. Verificar Columna asker_id en listing_questions
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
  NULL::regclass as tabla;

-- ============================================
-- 5. Verificar Campos de Payout en profiles
-- ============================================
SELECT 
  'COLUMNA' as tipo,
  'profiles.payout_bank_name' as nombre,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'payout_bank_name'
    ) 
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado,
  NULL::regclass as tabla;

-- ============================================
-- 6. Verificar Campos de Pago en orders
-- ============================================
SELECT 
  'COLUMNA' as tipo,
  'orders.paid_to_seller_at' as nombre,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'paid_to_seller_at'
    ) 
    THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE'
  END as estado,
  NULL::regclass as tabla;

-- ============================================
-- 7. Verificar Políticas RLS de notifications
-- ============================================
SELECT 
  'POLÍTICA RLS' as tipo,
  policyname as nombre,
  '✅ ACTIVA' as estado,
  NULL::regclass as tabla
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- ============================================
-- 8. Verificar Políticas RLS de listing_questions
-- ============================================
SELECT 
  'POLÍTICA RLS' as tipo,
  policyname as nombre,
  '✅ ACTIVA' as estado,
  NULL::regclass as tabla
FROM pg_policies
WHERE tablename = 'listing_questions'
ORDER BY policyname;

-- ============================================
-- 9. Verificar ENUM notification_type (si existe)
-- ============================================
SELECT 
  'ENUM' as tipo,
  'notification_type' as nombre,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type')
    THEN '✅ EXISTE'
    ELSE '⚠️ NO EXISTE (usando TEXT)'
  END as estado,
  NULL::regclass as tabla;

-- ============================================
-- 10. Resumen: Preguntas y Notificaciones Recientes
-- ============================================
SELECT 
  'RESUMEN' as tipo,
  'Preguntas respondidas (últimos 7 días)' as nombre,
  COUNT(*)::text as estado,
  NULL::regclass as tabla
FROM listing_questions
WHERE answer_text IS NOT NULL 
  AND answer_text != ''
  AND answered_at > NOW() - INTERVAL '7 days';

SELECT 
  'RESUMEN' as tipo,
  'Notificaciones de respuestas (últimos 7 días)' as nombre,
  COUNT(*)::text as estado,
  NULL::regclass as tabla
FROM notifications
WHERE data->>'kind' = 'listing_answer'
  AND created_at > NOW() - INTERVAL '7 days';

-- ============================================
-- FIN DE VERIFICACIÓN
-- ============================================
-- Si todos los elementos muestran ✅, la configuración está completa.
-- Si hay ❌, ejecuta los scripts SQL faltantes.
