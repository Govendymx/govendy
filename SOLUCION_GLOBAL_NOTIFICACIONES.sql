-- ============================================
-- SOLUCIÓN GLOBAL: Notificaciones para TODOS los Usuarios
-- Ejecuta este SQL en Supabase → SQL Editor
-- Esto garantiza que TODOS los usuarios reciban notificaciones
-- ============================================

-- ============================================
-- PASO 1: Asegurar que la tabla notifications existe
-- ============================================
-- Si no existe, créala primero con supabase_notifications.sql

-- ============================================
-- PASO 2: Crear/Reemplazar función para notificar al VENDEDOR (nueva pregunta)
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_seller_on_new_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
  notification_created boolean := false;
BEGIN
  -- Evitar notificar si está marcada como borrada
  IF NEW.is_deleted = true THEN
    RETURN NEW;
  END IF;

  -- Verificar que seller_id existe
  IF NEW.seller_id IS NULL THEN
    RAISE WARNING 'Pregunta sin seller_id, no se puede notificar. question_id: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Obtener título del listing
  SELECT COALESCE(l.title, 'Tu publicación') INTO listing_title
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  -- Intento 1: tipo listing_question (el correcto)
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    VALUES (
      NEW.seller_id,
      'listing_question',
      'Nueva pregunta en tu publicación',
      '"' || listing_title || '": ' || LEFT(NEW.question_text, 80),
      jsonb_build_object(
        'kind', 'listing_question',
        'listingId', NEW.listing_id,
        'questionId', NEW.id,
        'questionPreview', LEFT(NEW.question_text, 80),
        'href', '/dashboard/preguntas',
        'link', '/dashboard/preguntas',
        'link_url', '/listings/' || NEW.listing_id
      ),
      false
    );
    notification_created := true;
  EXCEPTION WHEN others THEN
    -- Continuar con siguiente intento
    RAISE WARNING 'Error al crear notificación (listing_question): %', SQLERRM;
  END;

  -- Intento 2: sin type (usará DEFAULT)
  IF NOT notification_created THEN
    BEGIN
      INSERT INTO public.notifications (user_id, title, body, data, is_read)
      VALUES (
        NEW.seller_id,
        'Nueva pregunta en tu publicación',
        '"' || listing_title || '": ' || LEFT(NEW.question_text, 80),
        jsonb_build_object(
          'kind', 'listing_question',
          'listingId', NEW.listing_id,
          'questionId', NEW.id,
          'questionPreview', LEFT(NEW.question_text, 80),
          'href', '/dashboard/preguntas',
          'link', '/dashboard/preguntas'
        ),
        false
      );
      notification_created := true;
    EXCEPTION WHEN others THEN
      RAISE WARNING '❌ NO SE PUDO CREAR NOTIFICACIÓN para seller_id: %, question_id: %', NEW.seller_id, NEW.id;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca romper el flujo principal
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 3: Crear/Reemplazar función para notificar al COMPRADOR (respuesta)
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
  -- Solo cuando pasa de NULL/vacío -> NOT NULL (se agrega respuesta)
  IF TG_OP = 'UPDATE' THEN
    -- Verificar que realmente se agregó una respuesta
    IF (OLD.answer_text IS NULL OR OLD.answer_text = '' OR TRIM(OLD.answer_text) = '')
       AND (NEW.answer_text IS NOT NULL AND NEW.answer_text != '' AND TRIM(NEW.answer_text) != '')
       AND (NEW.is_deleted = false) THEN
      
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
      EXCEPTION WHEN others THEN
        -- Continuar con siguiente intento
        RAISE WARNING 'Error al crear notificación (listing_answer): %', SQLERRM;
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
          RAISE WARNING 'Error al crear notificación (listing_question fallback): %', SQLERRM;
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
-- PASO 4: Crear/Reemplazar triggers (GLOBALES para TODOS los usuarios)
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
WHEN (OLD.answer_text IS DISTINCT FROM NEW.answer_text)
EXECUTE FUNCTION public.notify_asker_on_question_answer();

-- ============================================
-- PASO 5: Verificar que los triggers están activos
-- ============================================
SELECT 
  'TRIGGER' as tipo,
  trigger_name as nombre,
  event_manipulation as evento,
  event_object_table as tabla,
  action_statement as funcion
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'listing_questions'
  AND trigger_name LIKE '%notify%'
ORDER BY trigger_name;

-- ============================================
-- PASO 6: Verificar funciones
-- ============================================
SELECT 
  'FUNCIÓN' as tipo,
  routine_name as nombre,
  routine_type as tipo_funcion,
  security_type as seguridad
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('notify_seller_on_new_question', 'notify_asker_on_question_answer')
ORDER BY routine_name;

-- ============================================
-- PASO 7: Estadísticas de notificaciones recientes
-- ============================================
SELECT 
  'ESTADÍSTICAS' as tipo,
  COUNT(*) FILTER (WHERE type = 'listing_question' OR (data->>'kind') = 'listing_question') as notificaciones_preguntas,
  COUNT(*) FILTER (WHERE type = 'listing_answer' OR (data->>'kind') = 'listing_answer') as notificaciones_respuestas,
  COUNT(*) as total_recientes
FROM public.notifications
WHERE created_at > NOW() - INTERVAL '24 hours';
