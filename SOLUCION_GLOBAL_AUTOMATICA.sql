-- ============================================
-- SOLUCIÓN GLOBAL AUTOMÁTICA PARA TODOS LOS USUARIOS
-- Este script crea triggers y funciones que corrigen automáticamente
-- problemas comunes sin necesidad de intervención manual
-- ============================================
-- Ejecuta este SQL UNA VEZ en Supabase SQL Editor
-- Funciona para TODOS los usuarios automáticamente

-- ============================================
-- 1. FUNCIÓN: Corregir fechas futuras automáticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.corregir_fecha_futura_pregunta()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la fecha es futura, corregirla a la fecha actual
  IF NEW.created_at > NOW() THEN
    NEW.created_at := NOW();
    RAISE WARNING 'Pregunta con fecha futura corregida automáticamente. ID: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecuta ANTES de insertar
DROP TRIGGER IF EXISTS trg_corregir_fecha_futura_pregunta ON public.listing_questions;
CREATE TRIGGER trg_corregir_fecha_futura_pregunta
  BEFORE INSERT ON public.listing_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.corregir_fecha_futura_pregunta();

-- ============================================
-- 2. FUNCIÓN: Corregir respuestas "fantasma" (solo espacios)
-- ============================================
CREATE OR REPLACE FUNCTION public.corregir_respuesta_fantasma()
RETURNS TRIGGER AS $$
BEGIN
  -- Si answer_text tiene solo espacios, marcarlo como NULL
  IF NEW.answer_text IS NOT NULL AND TRIM(NEW.answer_text) = '' THEN
    NEW.answer_text := NULL;
    NEW.answered_at := NULL;
    RAISE WARNING 'Respuesta fantasma corregida automáticamente. ID: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecuta ANTES de insertar o actualizar
DROP TRIGGER IF EXISTS trg_corregir_respuesta_fantasma ON public.listing_questions;
CREATE TRIGGER trg_corregir_respuesta_fantasma
  BEFORE INSERT OR UPDATE ON public.listing_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.corregir_respuesta_fantasma();

-- ============================================
-- 3. FUNCIÓN: Eliminar duplicados automáticamente (mantener solo la más reciente)
-- ============================================
CREATE OR REPLACE FUNCTION public.eliminar_duplicados_preguntas()
RETURNS TRIGGER AS $$
DECLARE
  duplicado_id UUID;
BEGIN
  -- Buscar si ya existe una pregunta idéntica (mismo listing_id, asker_id, pregunta)
  -- que no esté eliminada y sea más antigua
  SELECT id INTO duplicado_id
  FROM public.listing_questions
  WHERE listing_id = NEW.listing_id
    AND asker_id = NEW.asker_id
    AND TRIM(LOWER(question_text)) = TRIM(LOWER(NEW.question_text))
    AND id != NEW.id
    AND is_deleted = false
    AND created_at < NEW.created_at
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Si encontramos un duplicado más antiguo, marcarlo como eliminado
  IF duplicado_id IS NOT NULL THEN
    UPDATE public.listing_questions
    SET is_deleted = true
    WHERE id = duplicado_id;
    
    RAISE WARNING 'Duplicado eliminado automáticamente. ID eliminado: %, ID nuevo: %', duplicado_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecuta DESPUÉS de insertar
DROP TRIGGER IF EXISTS trg_eliminar_duplicados_preguntas ON public.listing_questions;
CREATE TRIGGER trg_eliminar_duplicados_preguntas
  AFTER INSERT ON public.listing_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.eliminar_duplicados_preguntas();

-- ============================================
-- 4. CORREGIR DATOS EXISTENTES (ejecutar una vez)
-- ============================================

-- 4.1: Corregir todas las fechas futuras existentes
UPDATE public.listing_questions
SET created_at = NOW()
WHERE created_at > NOW()
  AND is_deleted = false;

-- 4.2: Corregir todas las respuestas "fantasma" existentes
UPDATE public.listing_questions
SET 
  answer_text = NULL,
  answered_at = NULL
WHERE answer_text IS NOT NULL
  AND TRIM(answer_text) = ''
  AND is_deleted = false;

-- 4.3: Eliminar duplicados existentes (mantener solo la más reciente)
WITH duplicados AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY listing_id, asker_id, TRIM(LOWER(question_text))
      ORDER BY created_at DESC
    ) as rn
  FROM public.listing_questions
  WHERE is_deleted = false
)
UPDATE public.listing_questions
SET is_deleted = true
WHERE id IN (
  SELECT id FROM duplicados WHERE rn > 1
);

-- ============================================
-- 5. VERIFICAR QUE TODO FUNCIONA
-- ============================================
SELECT 
  '✅ Triggers creados correctamente' as estado,
  COUNT(*) FILTER (WHERE created_at > NOW()) as preguntas_con_fecha_futura,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND TRIM(answer_text) = '') as respuestas_fantasma,
  COUNT(*) as total_preguntas
FROM public.listing_questions
WHERE is_deleted = false;

-- ============================================
-- RESUMEN
-- ============================================
-- ✅ Trigger 1: Corrige fechas futuras automáticamente al crear preguntas
-- ✅ Trigger 2: Corrige respuestas "fantasma" automáticamente
-- ✅ Trigger 3: Elimina duplicados automáticamente (mantiene la más reciente)
-- ✅ Corrección de datos existentes: Se ejecuta una vez para limpiar datos antiguos
--
-- Estos triggers funcionan para TODOS los usuarios automáticamente.
-- No necesitas ejecutar nada más, todo se corrige automáticamente.
