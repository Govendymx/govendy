-- ============================================
-- IDENTIFICAR: Usuario Desconocido con 4 Preguntas
-- ============================================
-- Este script identifica quién es el usuario 65e2306b-c119-48c2-b141-3df37c00878b

-- ============================================
-- 1. Buscar el usuario en auth.users
-- ============================================
SELECT 
  id as user_id,
  email,
  created_at,
  CASE 
    WHEN id = '65e2306b-c119-48c2-b141-3df37c00878b' THEN '✅ ESTE ES EL USUARIO CON 4 PREGUNTAS'
    ELSE 'Otro usuario'
  END as es_el_usuario
FROM auth.users
WHERE id = '65e2306b-c119-48c2-b141-3df37c00878b';

-- ============================================
-- 2. Ver las 4 preguntas de ese usuario
-- ============================================
SELECT 
  lq.id as pregunta_id,
  lq.seller_id,
  lq.asker_id,
  lq.question_text,
  lq.answer_text,
  lq.created_at,
  lq.answered_at,
  -- Información del listing
  l.title as listing_title,
  l.id as listing_id
FROM listing_questions lq
LEFT JOIN listings l ON l.id = lq.listing_id
WHERE lq.seller_id = '65e2306b-c119-48c2-b141-3df37c00878b'
  AND lq.is_deleted = false
  AND (lq.answer_text IS NULL OR lq.answer_text = '')
ORDER BY lq.created_at DESC;

-- ============================================
-- 3. Verificar si ese user_id tiene perfil
-- ============================================
SELECT 
  p.id as user_id,
  p.full_name,
  p.phone,
  p.updated_at as fecha_perfil
FROM profiles p
WHERE p.id = '65e2306b-c119-48c2-b141-3df37c00878b';

-- ============================================
-- INSTRUCCIONES
-- ============================================
-- 1. Ejecuta la query #1 para ver el email del usuario
-- 2. Ejecuta la query #2 para ver las 4 preguntas pendientes
-- 3. Compara el email con tu email actual
-- 4. Si el email es tuyo, entonces esas son tus preguntas y deberías poder responderlas
-- 5. Si el email NO es tuyo, entonces necesitas iniciar sesión con ese usuario
--    o hacer que alguien haga una pregunta en tus publicaciones
