-- ============================================
-- SOLUCIÓN FINAL: Notificaciones de Preguntas
-- ============================================
-- Este script verifica y corrige TODO lo necesario
-- Ejecuta este SQL en Supabase → SQL Editor
--
-- IMPORTANTE: Ejecuta este script completo de una vez

-- ============================================
-- PASO 1: Verificar/Crear tabla notifications
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Asegurar todas las columnas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
    ALTER TABLE public.notifications ADD COLUMN user_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'type') THEN
    ALTER TABLE public.notifications ADD COLUMN type TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'title') THEN
    ALTER TABLE public.notifications ADD COLUMN title TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'body') THEN
    ALTER TABLE public.notifications ADD COLUMN body TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'data') THEN
    ALTER TABLE public.notifications ADD COLUMN data JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
    ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'created_at') THEN
    ALTER TABLE public.notifications ADD COLUMN created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW());
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- PASO 2: Verificar que listing_questions existe
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'listing_questions') THEN
    RAISE EXCEPTION 'La tabla listing_questions no existe. Ejecuta primero supabase_listing_questions.sql';
  END IF;
  
  -- Verificar que tiene asker_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listing_questions' AND column_name = 'asker_id') THEN
    RAISE EXCEPTION 'La tabla listing_questions no tiene la columna asker_id. Ejecuta supabase_listing_questions.sql';
  END IF;
  
  RAISE NOTICE '✅ Tabla listing_questions existe y tiene asker_id';
END $$;

-- ============================================
-- PASO 3: Crear/Actualizar función del trigger
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
    IF (OLD.answer_text IS NULL) AND (NEW.answer_text IS NOT NULL) AND (NEW.is_deleted = false) THEN
      -- Verificar que asker_id existe
      IF NEW.asker_id IS NULL THEN
        RAISE WARNING 'Pregunta sin asker_id, no se puede notificar. question_id: %', NEW.id;
        RETURN NEW;
      END IF;

      -- Obtener título del listing
      SELECT COALESCE(l.title, 'una publicación') INTO listing_title
      FROM public.listings l
      WHERE l.id = NEW.listing_id;

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
        RAISE NOTICE '✅ Notificación creada con type=listing_answer para asker_id: %', NEW.asker_id;
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Intento 1 falló (listing_answer): %', SQLERRM;
      END;

      -- Intento 2: tipo listing_question (fallback común)
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
              'link', '/listings/' || NEW.listing_id,
              'link_url', '/listings/' || NEW.listing_id
            ),
            false
          );
          notification_created := true;
          RAISE NOTICE '✅ Notificación creada con type=listing_question (fallback) para asker_id: %', NEW.asker_id;
        EXCEPTION WHEN others THEN
          RAISE WARNING 'Intento 2 falló (listing_question): %', SQLERRM;
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
              'link', '/listings/' || NEW.listing_id,
              'link_url', '/listings/' || NEW.listing_id
            ),
            false
          );
          notification_created := true;
          RAISE NOTICE '✅ Notificación creada sin type (fallback final) para asker_id: %', NEW.asker_id;
        EXCEPTION WHEN others THEN
          RAISE WARNING 'Intento 3 falló (sin type): %', SQLERRM;
          RAISE WARNING '❌ NO SE PUDO CREAR NOTIFICACIÓN para asker_id: %, question_id: %', NEW.asker_id, NEW.id;
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca romper el flujo principal
  RAISE WARNING 'Error en notify_asker_on_question_answer: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 4: Crear/Actualizar trigger
-- ============================================
DROP TRIGGER IF EXISTS trg_notify_asker_on_question_answer ON public.listing_questions;

CREATE TRIGGER trg_notify_asker_on_question_answer
AFTER UPDATE OF answer_text ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_asker_on_question_answer();

-- ============================================
-- PASO 5: Verificaciones finales
-- ============================================
DO $$
DECLARE
  trigger_exists boolean;
  function_exists boolean;
BEGIN
  -- Verificar trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_notify_asker_on_question_answer'
    AND tgenabled = 'O'  -- 'O' = ON, 'D' = DISABLED
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    RAISE NOTICE '✅ Trigger trg_notify_asker_on_question_answer está ACTIVO';
  ELSE
    RAISE WARNING '❌ Trigger trg_notify_asker_on_question_answer NO está activo o no existe';
  END IF;
  
  -- Verificar función
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_asker_on_question_answer'
  ) INTO function_exists;
  
  IF function_exists THEN
    RAISE NOTICE '✅ Función notify_asker_on_question_answer existe';
  ELSE
    RAISE WARNING '❌ Función notify_asker_on_question_answer NO existe';
  END IF;
  
  -- Resumen
  IF trigger_exists AND function_exists THEN
    RAISE NOTICE '🎉 TODO CONFIGURADO CORRECTAMENTE. Las notificaciones se crearán automáticamente cuando respondas preguntas.';
  ELSE
    RAISE WARNING '⚠️ HAY PROBLEMAS. Revisa los mensajes anteriores.';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar:
-- 1. Deberías ver mensajes ✅ en la pestaña "Results"
-- 2. Responde una pregunta desde /dashboard/preguntas
-- 3. El comprador debería ver el punto rosa parpadeante
-- 4. Verifica en la tabla notifications que se creó la notificación
