-- Script para eliminar preguntas con fechas futuras
-- IMPORTANTE: Reemplaza 'TU_USER_ID_AQUI' con tu ID de usuario
-- 
-- Para obtener tu ID:
-- 1. Abre tu aplicación en el navegador
-- 2. Abre la consola (F12)
-- 3. Ejecuta: const { data } = await supabase.auth.getUser(); console.log(data.user?.id);
-- 4. Copia el ID y reemplázalo abajo

-- ============================================
-- PASO 1: Ver preguntas con fechas futuras
-- ============================================
-- Reemplaza 'TU_USER_ID_AQUI' con tu ID real
SELECT 
  lq.id,
  lq.listing_id,
  lq.seller_id,
  LEFT(lq.question_text, 100) as pregunta,
  lq.created_at,
  lq.answer_text,
  CASE 
    WHEN lq.created_at > NOW() THEN '⚠️ FECHA FUTURA - SE ELIMINARÁ'
    ELSE 'OK'
  END as estado
FROM public.listing_questions lq
WHERE (
  lq.seller_id = 'TU_USER_ID_AQUI'::uuid
  OR lq.listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND lq.is_deleted = false
AND lq.created_at > NOW()
ORDER BY lq.created_at DESC;

-- ============================================
-- PASO 2: Eliminar preguntas con fechas futuras
-- ============================================
-- Descomenta y reemplaza 'TU_USER_ID_AQUI' con tu ID real:
/*
UPDATE public.listing_questions
SET is_deleted = true
WHERE (
  seller_id = 'TU_USER_ID_AQUI'::uuid
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND is_deleted = false
AND created_at > NOW();

-- Verificar que se eliminaron
SELECT 
  COUNT(*) as preguntas_eliminadas,
  'Preguntas con fechas futuras marcadas como eliminadas' as resultado
FROM public.listing_questions
WHERE (
  seller_id = 'TU_USER_ID_AQUI'::uuid
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND is_deleted = true
AND created_at > NOW();
*/
