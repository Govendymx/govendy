-- ============================================
-- ELIMINAR TODAS LAS PREGUNTAS ANTIGUAS
-- Ejecuta esto en Supabase → SQL Editor
-- Esto eliminará TODAS las preguntas para empezar limpio
-- ============================================

-- OPCIÓN 1: Soft Delete (marcar como eliminadas - RECOMENDADO)
-- Esto mantiene los datos por si necesitas recuperarlos
UPDATE public.listing_questions
SET is_deleted = true
WHERE is_deleted = false;

-- Verificar cuántas se marcaron como eliminadas
SELECT 
  'Preguntas marcadas como eliminadas' as accion,
  COUNT(*) as total
FROM public.listing_questions
WHERE is_deleted = true;

-- Verificar cuántas quedan activas (debería ser 0)
SELECT 
  'Preguntas activas restantes' as estado,
  COUNT(*) as total
FROM public.listing_questions
WHERE is_deleted = false;

-- ============================================
-- OPCIÓN 2: Eliminación Física (BORRAR PERMANENTEMENTE)
-- ⚠️ ADVERTENCIA: Esto borra los datos permanentemente
-- Descomenta las siguientes líneas SOLO si estás seguro
-- ============================================

-- DELETE FROM public.listing_questions;
-- 
-- -- Verificar que se eliminaron todas
-- SELECT 
--   'Preguntas restantes' as estado,
--   COUNT(*) as total
-- FROM public.listing_questions;

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================
SELECT 
  'RESUMEN FINAL' as tipo,
  COUNT(*) FILTER (WHERE is_deleted = false) as activas,
  COUNT(*) FILTER (WHERE is_deleted = true) as eliminadas_soft,
  COUNT(*) as total
FROM public.listing_questions;
