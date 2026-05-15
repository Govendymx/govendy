-- ============================================================
-- VERIFICAR Y RECREAR TRIGGER DE NOTIFICACIONES PARA PREGUNTAS
-- ============================================================
-- Este script verifica si el trigger existe y lo recrea si es necesario
-- ============================================================

-- PASO 1: Verificar si el trigger existe
-- ============================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_notify_seller_on_new_question'
  AND event_object_table = 'listing_questions';

-- PASO 2: Verificar si la función existe
-- ============================================================
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'notify_seller_on_new_question';

-- PASO 3: RECREAR la función del trigger (asegurar que funciona)
-- ============================================================
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

  -- Crear notificación con múltiples intentos
  -- Intento 1: con type = 'listing_question'
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    VALUES (
      NEW.seller_id,
      'listing_question',
      '💬 Nueva pregunta en tu publicación',
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
    RAISE NOTICE '✅ Notificación creada exitosamente para seller_id: %, question_id: %', NEW.seller_id, NEW.id;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'Error al crear notificación (listing_question): %', SQLERRM;
  END;

  -- Intento 2: sin type (si el primero falla)
  IF NOT notification_created THEN
    BEGIN
      INSERT INTO public.notifications (user_id, title, body, data, is_read)
      VALUES (
        NEW.seller_id,
        '💬 Nueva pregunta en tu publicación',
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
      RAISE NOTICE '✅ Notificación creada exitosamente (sin type) para seller_id: %, question_id: %', NEW.seller_id, NEW.id;
    EXCEPTION WHEN others THEN
      RAISE WARNING '❌ NO SE PUDO CREAR NOTIFICACIÓN para seller_id: %, question_id: %. Error: %', NEW.seller_id, NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca romper el flujo principal
  RAISE WARNING 'Error general en trigger notify_seller_on_new_question: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- PASO 4: RECREAR el trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_notify_seller_on_new_question ON public.listing_questions;

CREATE TRIGGER trg_notify_seller_on_new_question
AFTER INSERT ON public.listing_questions
FOR EACH ROW
WHEN (NEW.is_deleted = false AND NEW.seller_id IS NOT NULL)
EXECUTE FUNCTION public.notify_seller_on_new_question();

-- PASO 5: Verificar que el trigger se creó correctamente
-- ============================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_notify_seller_on_new_question'
  AND event_object_table = 'listing_questions';

-- ============================================================
-- INSTRUCCIONES:
-- ============================================================
-- 1. Ejecuta este script completo en Supabase SQL Editor
-- 2. Verifica que el trigger se creó correctamente (PASO 5)
-- 3. Prueba haciendo una pregunta nueva
-- 4. Verifica que se crea la notificación en la tabla notifications
-- ============================================================
