-- ============================================
-- VERIFICAR: Preguntas de Fernanda (Automático)
-- ============================================
-- Este script encuentra automáticamente el user_id de Fernanda y verifica sus preguntas

-- ============================================
-- 1. Buscar el user_id de Fernanda Zamora Reyes
-- ============================================
SELECT 
  p.id as user_id,
  p.full_name,
  p.phone,
  u.email,
  '✅ USUARIO ENCONTRADO' as estado
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE LOWER(p.full_name) LIKE '%fernanda%'
   OR LOWER(p.full_name) LIKE '%zamora%'
   OR LOWER(u.email) LIKE '%fernanda%'
ORDER BY p.updated_at DESC
LIMIT 1;

-- ============================================
-- 2. Ver TODAS las preguntas pendientes (para verificar)
-- ============================================
SELECT 
  lq.id as pregunta_id,
  lq.seller_id,
  lq.asker_id,
  LEFT(lq.question_text, 100) as pregunta_preview,
  lq.created_at,
  l.title as producto,
  -- Verificar si el seller_id coincide con algún usuario llamado Fernanda
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = lq.seller_id 
      AND (LOWER(p.full_name) LIKE '%fernanda%' OR LOWER(p.full_name) LIKE '%zamora%')
    ) THEN '✅ PROBABLEMENTE DE FERNANDA'
    ELSE '❓ DE OTRO VENDEDOR'
  END as probable_vendedor
FROM listing_questions lq
LEFT JOIN listings l ON l.id = lq.listing_id
WHERE lq.is_deleted = false
  AND (lq.answer_text IS NULL OR lq.answer_text = '')
ORDER BY lq.created_at DESC
LIMIT 10;

-- ============================================
-- 3. Ver preguntas específicas de Fernanda (usando el user_id del paso 1)
-- ============================================
-- INSTRUCCIONES:
-- 1. Ejecuta primero la query #1 para obtener el user_id de Fernanda
-- 2. Copia el user_id que aparece
-- 3. Reemplaza 'USER_ID_DE_FERNANDA_AQUI' abajo con ese user_id
-- 4. Ejecuta esta query

-- Descomenta y reemplaza el UUID cuando tengas el user_id:
/*
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
    WHEN lq.seller_id = 'USER_ID_DE_FERNANDA_AQUI' THEN '✅ ES SU PREGUNTA - DEBE PODER RESPONDERLA'
    ELSE '❌ NO ES SU PREGUNTA'
  END as es_suya
FROM listing_questions lq
LEFT JOIN listings l ON l.id = lq.listing_id
WHERE lq.is_deleted = false
  AND (lq.answer_text IS NULL OR lq.answer_text = '')
  AND lq.seller_id = 'USER_ID_DE_FERNANDA_AQUI'
ORDER BY lq.created_at DESC;
*/

-- ============================================
-- 4. Verificar políticas RLS
-- ============================================
SELECT 
  'POLÍTICA' as tipo,
  policyname as nombre,
  cmd as comando,
  CASE 
    WHEN cmd = 'UPDATE' THEN '✅ PERMITE RESPONDER'
    WHEN cmd = 'SELECT' THEN '✅ PERMITE LEER'
    ELSE cmd
  END as estado
FROM pg_policies
WHERE tablename = 'listing_questions'
  AND (cmd = 'UPDATE' OR policyname LIKE '%seller%' OR policyname LIKE '%answer%')
ORDER BY cmd, policyname;

-- ============================================
-- INSTRUCCIONES FINALES
-- ============================================
-- 1. Ejecuta la query #1 para encontrar el user_id de Fernanda
-- 2. Ejecuta la query #2 para ver todas las preguntas pendientes
-- 3. Ejecuta la query #4 para verificar que las políticas RLS están activas
-- 4. Si necesitas ver las preguntas específicas de Fernanda:
--    - Copia el user_id de la query #1
--    - Descomenta la query #3
--    - Reemplaza 'USER_ID_DE_FERNANDA_AQUI' con el user_id real
--    - Ejecuta la query #3
