-- ============================================
-- VERIFICACIÓN DEL NUEVO SISTEMA DE PREGUNTAS
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- Verificar estructura de la tabla
SELECT 
  'ESTRUCTURA DE TABLA' as tipo,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'listing_questions'
ORDER BY ordinal_position;

-- Verificar estadísticas generales
SELECT 
  'ESTADISTICAS GENERALES' as tipo,
  COUNT(*) as total_preguntas,
  COUNT(*) FILTER (WHERE is_deleted = false) as activas,
  COUNT(*) FILTER (WHERE is_deleted = true) as eliminadas,
  COUNT(*) FILTER (WHERE is_deleted = false AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')) as sin_respuesta,
  COUNT(*) FILTER (WHERE is_deleted = false AND answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') as con_respuesta
FROM public.listing_questions;

-- Verificar preguntas sin seller_id (deberían corregirse automáticamente)
SELECT 
  'PREGUNTAS SIN SELLER_ID' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE listing_id IS NOT NULL) as con_listing_id
FROM public.listing_questions
WHERE is_deleted = false
  AND seller_id IS NULL;

-- Verificar integridad de datos (preguntas con answered_at pero sin answer_text)
SELECT 
  'DATOS INCONSISTENTES' as tipo,
  COUNT(*) as total
FROM public.listing_questions
WHERE is_deleted = false
  AND answered_at IS NOT NULL
  AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '');

-- Verificar preguntas por vendedor (ejemplo - reemplaza con tu seller_id)
-- SELECT 
--   'PREGUNTAS POR VENDEDOR' as tipo,
--   seller_id,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '') as sin_respuesta,
--   COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '') as con_respuesta
-- FROM public.listing_questions
-- WHERE is_deleted = false
--   AND seller_id IS NOT NULL
-- GROUP BY seller_id
-- ORDER BY total DESC
-- LIMIT 10;
