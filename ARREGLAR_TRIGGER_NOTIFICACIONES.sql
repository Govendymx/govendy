-- ============================================
-- ARREGLAR TRIGGER DE NOTIFICACIONES
-- ============================================
-- Este script arregla el trigger que NO está creando notificaciones
-- Ejecuta este SQL en Supabase → SQL Editor

-- ============================================
-- PASO 1: Verificar estado actual
-- ============================================
DO $$
DECLARE
  trigger_exists boolean;
  trigger_enabled boolean;
  function_exists boolean;
BEGIN
  -- Verificar trigger
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_notify_asker_on_question_answer'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    SELECT (tgenabled = 'O') INTO trigger_enabled
    FROM pg_trigger
    WHERE tgname = 'trg_notify_asker_on_question_answer';
    
    IF trigger_enabled THEN
      RAISE NOTICE '✅ Trigger existe y está ACTIVO';
    ELSE
      RAISE WARNING '⚠️ Trigger existe pero está DESHABILITADO';
    END IF;
  ELSE
    RAISE WARNING '❌ Trigger NO existe';
  END IF;
  
  -- Verificar función
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_asker_on_question_answer'
  ) INTO function_exists;
  
  IF function_exists THEN
    RAISE NOTICE '✅ Función existe';
  ELSE
    RAISE WARNING '❌ Función NO existe';
  END IF;
END $$;

-- ============================================
-- PASO 2: Recrear función con mejor manejo de errores
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_asker_on_question_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
  notification_id uuid;
BEGIN
  -- Solo cuando pasa de NULL -> NOT NULL (se agrega respuesta)
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.answer_text IS NULL OR OLD.answer_text = '') 
       AND (NEW.answer_text IS NOT NULL AND NEW.answer_text != '') 
       AND (NEW.is_deleted = false) THEN
      
      -- Verificar que asker_id existe
      IF NEW.asker_id IS NULL THEN
        RAISE WARNING 'Pregunta sin asker_id, no se puede notificar. question_id: %', NEW.id;
        RETURN NEW;
      END IF;

      -- Obtener título del listing
      BEGIN
        SELECT COALESCE(l.title, 'una publicación') INTO listing_title
        FROM public.listings l
        WHERE l.id = NEW.listing_id;
      EXCEPTION WHEN others THEN
        listing_title := 'una publicación';
      END;

      -- Actualizar answered_at si existe la columna
      BEGIN
        NEW.answered_at := TIMEZONE('utc'::text, NOW());
      EXCEPTION WHEN others THEN
        -- Si la columna no existe, ignorar
        NULL;
      END;

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
        )
        RETURNING id INTO notification_id;
        
        RAISE NOTICE '✅ Notificación creada (listing_answer) para asker_id: %, notification_id: %', NEW.asker_id, notification_id;
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Intento 1 falló (listing_answer): %', SQLERRM;
        notification_id := NULL;
      END;

      -- Intento 2: tipo listing_question (fallback común)
      IF notification_id IS NULL THEN
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
          )
          RETURNING id INTO notification_id;
          
          RAISE NOTICE '✅ Notificación creada (listing_question fallback) para asker_id: %, notification_id: %', NEW.asker_id, notification_id;
        EXCEPTION WHEN others THEN
          RAISE WARNING 'Intento 2 falló (listing_question): %', SQLERRM;
          notification_id := NULL;
        END;
      END IF;

      -- Intento 3: sin type (usará DEFAULT)
      IF notification_id IS NULL THEN
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
          )
          RETURNING id INTO notification_id;
          
          RAISE NOTICE '✅ Notificación creada (sin type fallback) para asker_id: %, notification_id: %', NEW.asker_id, notification_id;
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
-- PASO 3: Recrear trigger (asegurar que esté activo)
-- ============================================
DROP TRIGGER IF EXISTS trg_notify_asker_on_question_answer ON public.listing_questions;

CREATE TRIGGER trg_notify_asker_on_question_answer
AFTER UPDATE OF answer_text ON public.listing_questions
FOR EACH ROW
WHEN (OLD.answer_text IS DISTINCT FROM NEW.answer_text)
EXECUTE FUNCTION public.notify_asker_on_question_answer();

-- ============================================
-- PASO 4: Habilitar trigger explícitamente
-- ============================================
ALTER TABLE public.listing_questions ENABLE TRIGGER trg_notify_asker_on_question_answer;

-- ============================================
-- PASO 5: Verificación final
-- ============================================
DO $$
DECLARE
  trigger_enabled char;
BEGIN
  SELECT tgenabled INTO trigger_enabled
  FROM pg_trigger
  WHERE tgname = 'trg_notify_asker_on_question_answer';
  
  IF trigger_enabled = 'O' THEN
    RAISE NOTICE '✅ Trigger trg_notify_asker_on_question_answer está ACTIVO';
  ELSE
    RAISE WARNING '❌ Trigger está DESHABILITADO (estado: %)', trigger_enabled;
  END IF;
END $$;

-- ============================================
-- PASO 6: Probar con una pregunta existente (OPCIONAL)
-- ============================================
-- Descomenta las siguientes líneas para probar el trigger manualmente
-- (Solo si quieres probar, reemplaza el ID con una pregunta real)

/*
DO $$
DECLARE
  test_question_id uuid;
  test_asker_id uuid;
BEGIN
  -- Buscar una pregunta respondida recientemente
  SELECT id, asker_id INTO test_question_id, test_asker_id
  FROM listing_questions
  WHERE answer_text IS NOT NULL
    AND answer_text != ''
    AND is_deleted = false
    AND asker_id IS NOT NULL
  ORDER BY answered_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
  
  IF test_question_id IS NOT NULL THEN
    RAISE NOTICE 'Pregunta de prueba encontrada: %, asker_id: %', test_question_id, test_asker_id;
    
    -- Verificar si tiene notificación
    IF EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = test_asker_id
        AND (data->>'questionId' = test_question_id::text OR data->>'kind' = 'listing_answer')
    ) THEN
      RAISE NOTICE '✅ Esta pregunta YA tiene notificación';
    ELSE
      RAISE WARNING '❌ Esta pregunta NO tiene notificación (el trigger no funcionó)';
    END IF;
  ELSE
    RAISE NOTICE 'No hay preguntas respondidas para probar';
  END IF;
END $$;
*/

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Después de ejecutar:
-- 1. El trigger debería estar activo
-- 2. La función debería tener mejor manejo de errores
-- 3. Prueba responder una pregunta nueva
-- 4. Verifica que se cree la notificación
