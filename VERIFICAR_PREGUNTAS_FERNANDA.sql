-- ============================================
-- VERIFICAR: Preguntas de Fernanda
-- ============================================
-- Este script verifica las preguntas pendientes de Fernanda Zamora Reyes

-- ============================================
-- 1. Buscar el user_id de Fernanda Zamora Reyes
-- ============================================
SELECT 
  p.id as user_id,
  p.full_name,
  p.phone,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE LOWER(p.full_name) LIKE '%fernanda%zamora%'
   OR LOWER(p.full_name) LIKE '%zamora%reyes%'
   OR LOWER(u.email) LIKE '%fernanda%';

-- ============================================
-- 2. Ver preguntas pendientes de Fernanda
-- ============================================
-- Reemplaza 'USER_ID_DE_FERNANDA' con el user_id encontrado arriba
SELECT 
  lq.id as pregunta_id,
  lq.seller_id,
  lq.asker_id,
  lq.question_text,
  lq.answer_text,
  lq.created_at,
  l.title as producto,
  l.id as listing_id,
  CASE 
    WHEN lq.answer_text IS NULL OR lq.answer_text = '' THEN '⏳ SIN RESPUESTA'
    ELSE '✅ CON RESPUESTA'
  END as estado
FROM listing_questions lq
LEFT JOIN listings l ON l.id = lq.listing_id
WHERE lq.is_deleted = false
  AND (lq.answer_text IS NULL OR lq.answer_text = '')
  -- Reemplaza 'USER_ID_DE_FERNANDA' con el user_id encontrado arriba
  -- AND lq.seller_id = 'USER_ID_DE_FERNANDA'
ORDER BY lq.created_at DESC
LIMIT 10;

-- ============================================
-- 3. Verificar políticas RLS para Fernanda
-- ============================================
SELECT 
  'POLÍTICA' as tipo,
  policyname as nombre,
  cmd as comando,
  CASE 
    WHEN cmd = 'UPDATE' THEN '✅ PERMITE RESPONDER'
    WHEN cmd = 'SELECT' THEN '✅ PERMITE LEER'
    ELSE cmd
  END as estado,
  qual as condicion
FROM pg_policies
WHERE tablename = 'listing_questions'
  AND (cmd = 'UPDATE' OR policyname LIKE '%seller%' OR policyname LIKE '%answer%')
ORDER BY cmd, policyname;

-- ============================================
-- INSTRUCCIONES
-- ============================================
-- 1. Ejecuta la query #1 para encontrar el user_id de Fernanda
-- 2. Ejecuta la query #2 reemplazando 'USER_ID_DE_FERNANDA' con el user_id encontrado
-- 3. Ejecuta la query #3 para verificar que las políticas RLS están activas
-- 4. Compara el seller_id de las preguntas con el user_id de Fernanda
-- 5. Si NO coinciden, esa es la razón por la que no puede responderlas
