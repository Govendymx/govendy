-- ============================================
-- ELIMINAR TODAS LAS PREGUNTAS - VERSIÓN SIMPLE
-- Ejecuta esto en Supabase → SQL Editor
-- Esto borra TODAS las preguntas permanentemente
-- ============================================

-- PASO 1: Ver cuántas hay antes
SELECT 
  'ANTES' as momento,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_deleted = false) as activas,
  COUNT(*) FILTER (WHERE is_deleted = true) as eliminadas
FROM public.listing_questions;

-- PASO 2: BORRAR TODAS LAS PREGUNTAS
DELETE FROM public.listing_questions;

-- PASO 3: Verificar que se borraron todas
SELECT 
  'DESPUES' as momento,
  COUNT(*) as total_restante
FROM public.listing_questions;

-- Si total_restante es 0, todo se borró correctamente ✅
