-- ============================================
-- FIX: Notificaciones de Preguntas y Respuestas
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Esto arreglará las notificaciones cuando respondes preguntas
--
-- IMPORTANTE: Ejecuta este script completo de una vez

-- ============================================
-- 1. Asegurar que la tabla notifications existe
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

-- Asegurar columnas
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data JSONB,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW());

-- Índices
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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
  USING (user_id = auth.uid());

-- ============================================
-- 2. Función y Trigger para notificar cuando se responde una pregunta
-- ============================================

-- Función que crea la notificación cuando se responde una pregunta
CREATE OR REPLACE FUNCTION public.notify_asker_on_question_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
BEGIN
  -- Solo cuando pasa de NULL -> NOT NULL (se agrega respuesta)
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.answer_text IS NULL) AND (NEW.answer_text IS NOT NULL) AND (NEW.is_deleted = false) THEN
      -- Verificar que asker_id existe
      IF NEW.asker_id IS NULL THEN
        RAISE WARNING 'Pregunta sin asker_id, no se puede notificar';
        RETURN NEW;
      END IF;

      -- Obtener título del listing
      SELECT COALESCE(l.title, 'una publicación') INTO listing_title
      FROM public.listings l
      WHERE l.id = NEW.listing_id;

      -- Intentar crear notificación con tipo listing_answer
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
      EXCEPTION WHEN others THEN
        -- Si falla por tipo ENUM, intentar con listing_question
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
        EXCEPTION WHEN others THEN
          -- Si aún falla, intentar sin type (usará DEFAULT)
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
          EXCEPTION WHEN others THEN
            -- Log del error pero no romper el flujo
            RAISE WARNING 'No se pudo crear notificación para asker_id %: %', NEW.asker_id, SQLERRM;
          END;
        END;
      END;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca romper el flujo principal
  RAISE WARNING 'Error en notify_asker_on_question_answer: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS trg_notify_asker_on_question_answer ON public.listing_questions;

-- Crear trigger que se ejecuta cuando se actualiza answer_text
CREATE TRIGGER trg_notify_asker_on_question_answer
AFTER UPDATE OF answer_text ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_asker_on_question_answer();

-- ============================================
-- 3. Verificar que el trigger está activo
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_trigger 
    WHERE tgname = 'trg_notify_asker_on_question_answer'
  ) THEN
    RAISE NOTICE '✅ Trigger trg_notify_asker_on_question_answer está activo';
  ELSE
    RAISE WARNING '❌ Trigger trg_notify_asker_on_question_answer NO está activo';
  END IF;
END $$;

-- ============================================
-- 4. Verificar que la función existe
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'notify_asker_on_question_answer'
  ) THEN
    RAISE NOTICE '✅ Función notify_asker_on_question_answer existe';
  ELSE
    RAISE WARNING '❌ Función notify_asker_on_question_answer NO existe';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar este script:
-- 1. Las notificaciones se crearán automáticamente cuando respondas una pregunta
-- 2. El comprador verá el punto rosa parpadeante en el menú superior
-- 3. La notificación aparecerá en /dashboard/notificaciones
