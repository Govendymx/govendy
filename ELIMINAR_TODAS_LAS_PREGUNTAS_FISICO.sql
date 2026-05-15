-- ============================================
-- ELIMINAR TODAS LAS PREGUNTAS FÍSICAMENTE
-- ⚠️ ADVERTENCIA: Esto borra los datos PERMANENTEMENTE
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- Verificar cuántas preguntas hay antes de borrar
SELECT 
  'ANTES DE BORRAR' as estado,
  COUNT(*) as total_preguntas,
  COUNT(*) FILTER (WHERE is_deleted = false) as activas,
  COUNT(*) FILTER (WHERE is_deleted = true) as eliminadas
FROM public.listing_questions;

-- BORRAR TODAS LAS PREGUNTAS PERMANENTEMENTE
DELETE FROM public.listing_questions;

-- Verificar que se eliminaron todas
SELECT 
  'DESPUES DE BORRAR' as estado,
  COUNT(*) as total_preguntas_restantes
FROM public.listing_questions;

-- Si el resultado es 0, todo se borró correctamente
-- Si hay algún error, verifica los logs de Supabase
