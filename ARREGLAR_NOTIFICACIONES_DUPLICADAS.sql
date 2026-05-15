-- ============================================
-- ARREGLAR: Notificaciones Duplicadas y Problemas
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- ============================================
-- PASO 1: Eliminar TODOS los triggers antiguos para evitar duplicados
-- ============================================
DROP TRIGGER IF EXISTS trg_notify_seller_on_new_question ON public.listing_questions;
DROP TRIGGER IF EXISTS trg_notify_asker_on_question_answer ON public.listing_questions;
DROP TRIGGER IF EXISTS trg_notify_seller_on_new_question_old ON public.listing_questions;
DROP TRIGGER IF EXISTS trg_notify_asker_on_question_answer_old ON public.listing_questions;

-- ============================================
-- PASO 2: Eliminar funciones antiguas (si existen versiones duplicadas)
-- ============================================
-- Las funciones se recrearán en el siguiente paso

-- ============================================
-- PASO 3: Crear función ÚNICA para notificar al VENDEDOR (sin duplicados)
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
  -- Evitar notificar si está marcada como borrada
  IF NEW.is_deleted = true THEN
    RETURN NEW;
  END IF;

  -- Verificar que seller_id existe
  IF NEW.seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener título del listing
  SELECT COALESCE(l.title, 'Tu publicación') INTO listing_title
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  -- Crear notificación (un solo intento, sin fallbacks que puedan duplicar)
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    VALUES (
      NEW.seller_id,
      'listing_question',
      'Nueva pregunta en tu publicación',
      '"' || listing_title || '": ' || LEFT(NEW.question_text, 80),
      jsonb_build_object(
        'kind', 'listing_question',
        'listingId', NEW.listing_id, -- UUID correcto
        'questionId', NEW.id,
        'questionPreview', LEFT(NEW.question_text, 80),
        'href', '/dashboard/preguntas',
        'link', '/dashboard/preguntas',
        'link_url', '/listings/' || NEW.listing_id -- UUID correcto
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
-- PASO 4: Crear función ÚNICA para notificar al COMPRADOR (sin duplicados)
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_asker_on_question_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
BEGIN
  -- Solo cuando pasa de NULL/vacío -> NOT NULL (se agrega respuesta)
  IF TG_OP = 'UPDATE' THEN
    -- Verificar que realmente se agregó una respuesta
    IF (OLD.answer_text IS NULL OR OLD.answer_text = '' OR TRIM(OLD.answer_text) = '')
       AND (NEW.answer_text IS NOT NULL AND NEW.answer_text != '' AND TRIM(NEW.answer_text) != '')
       AND (NEW.is_deleted = false) THEN
      
      -- Verificar que asker_id existe
      IF NEW.asker_id IS NULL THEN
        RETURN NEW;
      END IF;

      -- Obtener título del listing (solo para el mensaje)
      SELECT COALESCE(l.title, 'una publicación') INTO listing_title
      FROM public.listings l
      WHERE l.id = NEW.listing_id;

      -- Crear notificación (un solo intento, usando UUID correcto)
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
        VALUES (
          NEW.asker_id,
          'listing_answer',
          'El vendedor respondió tu pregunta',
          'Respondieron tu pregunta en: ' || listing_title || '.',
          jsonb_build_object(
            'kind', 'listing_answer',
            'listingId', NEW.listing_id, -- UUID correcto, NO el título
            'questionId', NEW.id,
            'href', '/listings/' || NEW.listing_id, -- UUID correcto
            'link', '/listings/' || NEW.listing_id, -- UUID correcto
            'link_url', '/listings/' || NEW.listing_id -- UUID correcto
          ),
          false
        );
      EXCEPTION WHEN others THEN
        -- Silencioso, no romper flujo principal
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 5: Crear triggers ÚNICOS (solo uno de cada tipo)
-- ============================================

-- Trigger 1: Notificar vendedor cuando hay nueva pregunta
CREATE TRIGGER trg_notify_seller_on_new_question
AFTER INSERT ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_new_question();

-- Trigger 2: Notificar comprador cuando se responde
CREATE TRIGGER trg_notify_asker_on_question_answer
AFTER UPDATE OF answer_text ON public.listing_questions
FOR EACH ROW
WHEN (OLD.answer_text IS DISTINCT FROM NEW.answer_text)
EXECUTE FUNCTION public.notify_asker_on_question_answer();

-- ============================================
-- PASO 6: Limpiar notificaciones duplicadas existentes
-- ============================================
-- Eliminar duplicados, manteniendo solo la más reciente de cada grupo
DELETE FROM public.notifications
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          user_id, 
          type, 
          (data->>'questionId')
        ORDER BY created_at DESC
      ) as rn
    FROM public.notifications
    WHERE (type IN ('listing_question', 'listing_answer')
       OR (data->>'kind') IN ('listing_question', 'listing_answer'))
  ) ranked
  WHERE rn > 1
);

-- ============================================
-- PASO 7: Corregir listing_id incorrectos (donde es título en lugar de UUID)
-- ============================================
-- Actualizar notificaciones donde listingId es un título (texto) en lugar de UUID
UPDATE public.notifications
SET data = jsonb_set(
  data,
  '{listingId}',
  to_jsonb(
    (SELECT id FROM public.listings WHERE title = data->>'listingId' LIMIT 1)
  )
)
WHERE (type = 'listing_answer' OR (data->>'kind') = 'listing_answer')
  AND data->>'listingId' IS NOT NULL
  AND data->>'listingId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -- No es UUID
  AND EXISTS (SELECT 1 FROM public.listings WHERE title = data->>'listingId');

-- ============================================
-- PASO 8: Verificaciones finales
-- ============================================

-- Verificar triggers activos (debe haber solo 2)
SELECT 
  'TRIGGERS ACTIVOS' as tipo,
  trigger_name as nombre,
  event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'listing_questions'
  AND trigger_name LIKE '%notify%'
ORDER BY trigger_name;

-- Verificar que no hay duplicados
SELECT 
  'VERIFICACIÓN DUPLICADOS' as tipo,
  COUNT(*) as total_notificaciones,
  COUNT(DISTINCT (user_id, type, data->>'questionId')) as grupos_unicos,
  COUNT(*) - COUNT(DISTINCT (user_id, type, data->>'questionId')) as duplicados_restantes
FROM public.notifications
WHERE (type IN ('listing_question', 'listing_answer')
   OR (data->>'kind') IN ('listing_question', 'listing_answer'));

-- Verificar listing_id correctos
SELECT 
  'VERIFICACIÓN LISTING_ID' as tipo,
  COUNT(*) FILTER (WHERE data->>'listingId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as con_uuid_correcto,
  COUNT(*) FILTER (WHERE data->>'listingId' IS NOT NULL AND data->>'listingId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as con_titulo_incorrecto
FROM public.notifications
WHERE (type = 'listing_answer' OR (data->>'kind') = 'listing_answer')
  AND data->>'listingId' IS NOT NULL;
