-- ============================================
-- SOLUCIÓN DEFINITIVA: Sistema de Preguntas y Respuestas
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script asegura que TODO funcione correctamente para TODOS los usuarios
-- ============================================

-- ============================================
-- PASO 1: Asegurar que la tabla listing_questions existe con todas las columnas
-- ============================================

CREATE TABLE IF NOT EXISTS public.listing_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  asker_id UUID NOT NULL,
  question_text TEXT NOT NULL DEFAULT '',
  answer_text TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  answered_at TIMESTAMP WITH TIME ZONE NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS listing_questions_listing_id_created_at_idx
  ON public.listing_questions (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_questions_seller_id_created_at_idx
  ON public.listing_questions (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_questions_asker_id_created_at_idx
  ON public.listing_questions (asker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_questions_seller_id_answer_text_idx
  ON public.listing_questions (seller_id, answer_text) WHERE answer_text IS NULL;

-- ============================================
-- PASO 2: Habilitar RLS y eliminar políticas antiguas
-- ============================================

ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;

-- Eliminar TODAS las políticas antiguas
DROP POLICY IF EXISTS "Public can read listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Authenticated can ask listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Seller can answer listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Sellers can answer their questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Users can update their questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Vendedores pueden responder" ON public.listing_questions;
DROP POLICY IF EXISTS "Sellers can read their own questions" ON public.listing_questions;

-- ============================================
-- PASO 3: Crear políticas RLS correctas
-- ============================================

-- Política 1: Cualquiera puede LEER preguntas no eliminadas (públicas)
CREATE POLICY "Public can read listing questions"
  ON public.listing_questions
  FOR SELECT
  TO anon, authenticated
  USING (is_deleted = false);

-- Política 2: Usuarios autenticados pueden HACER preguntas
CREATE POLICY "Authenticated can ask listing questions"
  ON public.listing_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    asker_id = auth.uid()
    AND seller_id <> auth.uid()
    AND seller_id = (
      SELECT l.seller_id FROM public.listings l WHERE l.id = listing_id
    )
  );

-- Política 3: Vendedores pueden RESPONDER sus preguntas (UPDATE) - LA MÁS IMPORTANTE
CREATE POLICY "Seller can answer listing questions"
  ON public.listing_questions
  FOR UPDATE
  TO authenticated
  USING (
    -- Permitir si el seller_id coincide con el usuario
    seller_id = auth.uid()
    OR
    -- O si el usuario es dueño del listing (por si seller_id está vacío/incorrecto)
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_questions.listing_id
      AND l.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Misma validación para el WITH CHECK
    seller_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_questions.listing_id
      AND l.seller_id = auth.uid()
    )
  );

-- Política 4: Vendedores pueden LEER sus propias preguntas
CREATE POLICY "Sellers can read their own questions"
  ON public.listing_questions
  FOR SELECT
  TO authenticated
  USING (
    -- Permitir si el seller_id coincide
    seller_id = auth.uid()
    OR
    -- O si el usuario es dueño del listing
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_questions.listing_id
      AND l.seller_id = auth.uid()
    )
    OR
    -- O si es la pregunta del usuario (para que pueda ver sus propias preguntas)
    asker_id = auth.uid()
  );

-- ============================================
-- PASO 4: Función para notificar al vendedor (nueva pregunta)
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_seller_on_new_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
BEGIN
  IF NEW.is_deleted = true THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.title, 'Tu publicación') INTO listing_title
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    VALUES (
      NEW.seller_id,
      'listing_question',
      'Nueva pregunta en tu publicación',
      'Te preguntaron: ' || listing_title || '.',
      jsonb_build_object(
        'kind', 'listing_question',
        'listingId', NEW.listing_id,
        'questionId', NEW.id,
        'href', '/dashboard/preguntas',
        'link', '/dashboard/preguntas'
      ),
      false
    );
  EXCEPTION WHEN others THEN
    -- Silencioso, no romper flujo principal
    NULL;
  END;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 5: Función para notificar al comprador (respuesta) - CRÍTICA
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_asker_on_question_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
  notification_created boolean := false;
BEGIN
  -- Solo cuando pasa de NULL -> NOT NULL (se agrega respuesta)
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.answer_text IS NULL OR OLD.answer_text = '') 
       AND (NEW.answer_text IS NOT NULL AND NEW.answer_text != '') 
       AND (NEW.is_deleted = false) THEN
      
      -- Verificar que asker_id existe
      IF NEW.asker_id IS NULL OR NEW.asker_id = ''::uuid THEN
        RAISE WARNING 'Pregunta sin asker_id, no se puede notificar. question_id: %', NEW.id;
        RETURN NEW;
      END IF;

      -- Obtener título del listing
      SELECT COALESCE(l.title, 'una publicación') INTO listing_title
      FROM public.listings l
      WHERE l.id = NEW.listing_id;

      -- Actualizar answered_at (el UPDATE ya lo hace, pero por si acaso)
      -- Nota: answered_at se actualiza en el UPDATE de la API, no aquí

      -- Intento 1: tipo listing_answer (el correcto)
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
        VALUES (
          NEW.asker_id,
          'listing_answer',
          'El vendedor respondió tu pregunta',
          'Respondieron tu pregunta en: ' || listing_title || '.',
          jsonb_build_object(
            'kind', 'listing_answer',
            'listingId', NEW.listing_id,
            'questionId', NEW.id,
            'href', '/listings/' || NEW.listing_id,
            'link', '/listings/' || NEW.listing_id,
            'link_url', '/listings/' || NEW.listing_id
          ),
          false
        );
        notification_created := true;
      EXCEPTION WHEN others THEN
        -- Continuar con siguiente intento
        NULL;
      END;

      -- Intento 2: tipo listing_question (fallback)
      IF NOT notification_created THEN
        BEGIN
          INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
          VALUES (
            NEW.asker_id,
            'listing_question',
            'El vendedor respondió tu pregunta',
            'Respondieron tu pregunta en: ' || listing_title || '.',
            jsonb_build_object(
              'kind', 'listing_answer',
              'listingId', NEW.listing_id,
              'questionId', NEW.id,
              'href', '/listings/' || NEW.listing_id,
              'link', '/listings/' || NEW.listing_id
            ),
            false
          );
          notification_created := true;
        EXCEPTION WHEN others THEN
          NULL;
        END;
      END IF;

      -- Intento 3: sin type (usará DEFAULT)
      IF NOT notification_created THEN
        BEGIN
          INSERT INTO public.notifications (user_id, title, body, data, is_read)
          VALUES (
            NEW.asker_id,
            'El vendedor respondió tu pregunta',
            'Respondieron tu pregunta en: ' || listing_title || '.',
            jsonb_build_object(
              'kind', 'listing_answer',
              'listingId', NEW.listing_id,
              'questionId', NEW.id,
              'href', '/listings/' || NEW.listing_id,
              'link', '/listings/' || NEW.listing_id
            ),
            false
          );
          notification_created := true;
        EXCEPTION WHEN others THEN
          RAISE WARNING '❌ NO SE PUDO CREAR NOTIFICACIÓN para asker_id: %, question_id: %', NEW.asker_id, NEW.id;
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca romper el flujo principal
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 6: Crear/Reemplazar triggers
-- ============================================

-- Trigger 1: Notificar vendedor cuando hay nueva pregunta
DROP TRIGGER IF EXISTS trg_notify_seller_on_new_question ON public.listing_questions;
CREATE TRIGGER trg_notify_seller_on_new_question
AFTER INSERT ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_new_question();

-- Trigger 2: Notificar comprador cuando se responde (EL MÁS IMPORTANTE)
DROP TRIGGER IF EXISTS trg_notify_asker_on_question_answer ON public.listing_questions;
CREATE TRIGGER trg_notify_asker_on_question_answer
AFTER UPDATE OF answer_text ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_asker_on_question_answer();

-- ============================================
-- PASO 7: Función para corregir seller_id y asker_id en preguntas existentes
-- ============================================

CREATE OR REPLACE FUNCTION public.fix_question_ids()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Corregir seller_id usando el listing
  UPDATE public.listing_questions q
  SET seller_id = l.seller_id
  FROM public.listings l
  WHERE q.listing_id = l.id
    AND (q.seller_id IS NULL OR q.seller_id != l.seller_id);
  
  RAISE NOTICE 'Preguntas corregidas: seller_id actualizado desde listings';
END;
$$;

-- Ejecutar corrección automáticamente
SELECT public.fix_question_ids();

-- ============================================
-- PASO 8: Verificaciones finales
-- ============================================

-- Verificar políticas creadas
SELECT 
  'POLÍTICAS RLS' as tipo,
  policyname as nombre,
  cmd as comando,
  permissive as permisiva
FROM pg_policies
WHERE tablename = 'listing_questions'
ORDER BY policyname;

-- Verificar triggers creados
SELECT 
  'TRIGGERS' as tipo,
  trigger_name as nombre,
  event_manipulation as evento,
  action_timing as momento
FROM information_schema.triggers
WHERE event_object_table = 'listing_questions'
ORDER BY trigger_name;

-- Verificar funciones creadas
SELECT 
  'FUNCIONES' as tipo,
  routine_name as nombre,
  routine_type as tipo_funcion
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('notify_seller_on_new_question', 'notify_asker_on_question_answer', 'fix_question_ids')
ORDER BY routine_name;
