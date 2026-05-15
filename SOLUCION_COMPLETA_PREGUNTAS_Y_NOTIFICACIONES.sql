-- ============================================
-- SOLUCIÓN COMPLETA: Preguntas y Notificaciones
-- Ejecuta esto en Supabase → SQL Editor
-- Esto corrige TODO automáticamente
-- ============================================

-- ============================================
-- PASO 1: Corregir seller_id en TODAS las preguntas
-- ============================================
-- Esto asegura que todas las preguntas tengan seller_id correcto
UPDATE public.listing_questions q
SET seller_id = l.seller_id
FROM public.listings l
WHERE q.listing_id = l.id
  AND l.seller_id IS NOT NULL
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
  AND q.is_deleted = false;

-- Verificar cuántas se corrigieron
SELECT 
  'CORRECCIÓN SELLER_ID' as tipo,
  COUNT(*) as preguntas_corregidas
FROM public.listing_questions q
JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND q.seller_id = l.seller_id
  AND (q.answer_text IS NULL OR q.answer_text = '');

-- ============================================
-- PASO 2: Extender ENUM notification_type si existe
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'notification_type') THEN
    -- Extender ENUM con los tipos necesarios
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'listing_question'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'listing_answer'; EXCEPTION WHEN others THEN END;
    RAISE NOTICE '✅ ENUM notification_type extendido';
  ELSE
    RAISE NOTICE 'ℹ️ No hay ENUM notification_type, usando TEXT (normal)';
  END IF;
END $$;

-- ============================================
-- PASO 3: Asegurar que la tabla notifications existe
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT,
  title TEXT,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar columnas faltantes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'type') THEN
    -- Verificar si existe el ENUM
    IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'notification_type') THEN
      ALTER TABLE public.notifications ADD COLUMN type notification_type;
    ELSE
      ALTER TABLE public.notifications ADD COLUMN type TEXT;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'title') THEN
    ALTER TABLE public.notifications ADD COLUMN title TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'body') THEN
    ALTER TABLE public.notifications ADD COLUMN body TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'data') THEN
    ALTER TABLE public.notifications ADD COLUMN data JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read') THEN
    ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'created_at') THEN
    ALTER TABLE public.notifications ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
CREATE POLICY "Users can read their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- PASO 3: Eliminar TODOS los triggers antiguos
-- ============================================
DROP TRIGGER IF EXISTS trg_notify_seller_on_new_question ON public.listing_questions;
DROP TRIGGER IF EXISTS trg_notify_asker_on_question_answer ON public.listing_questions;

-- ============================================
-- PASO 5: Crear función para notificar al VENDEDOR
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_seller_on_new_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
  final_seller_id UUID;
BEGIN
  -- Evitar notificar si está marcada como borrada
  IF NEW.is_deleted = true THEN
    RETURN NEW;
  END IF;

  -- Obtener seller_id (de la pregunta o del listing)
  final_seller_id := NEW.seller_id;
  IF final_seller_id IS NULL THEN
    SELECT l.seller_id INTO final_seller_id
    FROM public.listings l
    WHERE l.id = NEW.listing_id;
    
    -- Si encontramos seller_id, actualizar la pregunta
    IF final_seller_id IS NOT NULL THEN
      UPDATE public.listing_questions
      SET seller_id = final_seller_id
      WHERE id = NEW.id;
    END IF;
  END IF;

  -- Si aún no tenemos seller_id, no podemos notificar
  IF final_seller_id IS NULL THEN
    RAISE WARNING 'Pregunta sin seller_id, no se puede notificar. question_id: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Obtener título del listing
  SELECT COALESCE(l.title, 'Tu publicación') INTO listing_title
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  -- Crear notificación (con cast apropiado según si existe ENUM)
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'notification_type') THEN
      -- Si existe ENUM, hacer cast explícito
      INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
      VALUES (
        final_seller_id,
        'listing_question'::notification_type,
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
    ELSE
      -- Si no existe ENUM, usar TEXT
      INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
      VALUES (
        final_seller_id,
        'listing_question'::text,
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
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'Error al crear notificación: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 6: Crear función para notificar al COMPRADOR
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
    IF (OLD.answer_text IS NULL OR OLD.answer_text = '' OR TRIM(OLD.answer_text) = '')
       AND (NEW.answer_text IS NOT NULL AND NEW.answer_text != '' AND TRIM(NEW.answer_text) != '')
       AND (NEW.is_deleted = false) THEN
      
      -- Verificar que asker_id existe
      IF NEW.asker_id IS NULL THEN
        RETURN NEW;
      END IF;

      -- Obtener título del listing
      SELECT COALESCE(l.title, 'una publicación') INTO listing_title
      FROM public.listings l
      WHERE l.id = NEW.listing_id;

      -- Crear notificación (con cast apropiado según si existe ENUM)
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'notification_type') THEN
          -- Si existe ENUM, hacer cast explícito
          INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
          VALUES (
            NEW.asker_id,
            'listing_answer'::notification_type,
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
        ELSE
          -- Si no existe ENUM, usar TEXT
          INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
          VALUES (
            NEW.asker_id,
            'listing_answer'::text,
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
        END IF;
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Error al crear notificación: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

-- ============================================
-- PASO 7: Crear triggers ÚNICOS
-- ============================================
CREATE TRIGGER trg_notify_seller_on_new_question
AFTER INSERT ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_new_question();

CREATE TRIGGER trg_notify_asker_on_question_answer
AFTER UPDATE OF answer_text ON public.listing_questions
FOR EACH ROW
WHEN (OLD.answer_text IS DISTINCT FROM NEW.answer_text)
EXECUTE FUNCTION public.notify_asker_on_question_answer();

-- ============================================
-- PASO 8: Crear notificaciones para preguntas existentes sin notificación
-- ============================================
-- Esto crea notificaciones para preguntas que ya existen pero no tienen notificación
DO $$
BEGIN
  -- Insertar según si existe ENUM o no
  IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'notification_type') THEN
    -- Si existe ENUM, hacer cast explícito
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    SELECT DISTINCT
      q.seller_id,
      'listing_question'::notification_type,
  'Nueva pregunta en tu publicación',
  '"' || COALESCE(l.title, 'Tu publicación') || '": ' || LEFT(q.question_text, 80),
  jsonb_build_object(
    'kind', 'listing_question',
    'listingId', q.listing_id,
    'questionId', q.id,
    'questionPreview', LEFT(q.question_text, 80),
    'href', '/dashboard/preguntas',
    'link', '/dashboard/preguntas'
  ),
  false
    FROM public.listing_questions q
    LEFT JOIN public.listings l ON l.id = q.listing_id
    WHERE q.is_deleted = false
      AND (q.answer_text IS NULL OR q.answer_text = '')
      AND q.seller_id IS NOT NULL
      AND q.created_at > NOW() - INTERVAL '7 days' -- Solo preguntas recientes
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = q.seller_id
          AND (n.type::text = 'listing_question' OR (n.data->>'kind') = 'listing_question')
          AND (n.data->>'questionId') = q.id::text
      );
  ELSE
    -- Si no existe ENUM, usar TEXT
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    SELECT DISTINCT
      q.seller_id,
      'listing_question'::text,
      'Nueva pregunta en tu publicación',
      '"' || COALESCE(l.title, 'Tu publicación') || '": ' || LEFT(q.question_text, 80),
      jsonb_build_object(
        'kind', 'listing_question',
        'listingId', q.listing_id,
        'questionId', q.id,
        'questionPreview', LEFT(q.question_text, 80),
        'href', '/dashboard/preguntas',
        'link', '/dashboard/preguntas'
      ),
      false
    FROM public.listing_questions q
    LEFT JOIN public.listings l ON l.id = q.listing_id
    WHERE q.is_deleted = false
      AND (q.answer_text IS NULL OR q.answer_text = '')
      AND q.seller_id IS NOT NULL
      AND q.created_at > NOW() - INTERVAL '7 days' -- Solo preguntas recientes
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = q.seller_id
          AND (n.type::text = 'listing_question' OR (n.data->>'kind') = 'listing_question')
          AND (n.data->>'questionId') = q.id::text
      );
  END IF;
END $$;

-- ============================================
-- PASO 9: Verificaciones finales
-- ============================================

-- Verificar triggers
SELECT 
  '✅ TRIGGERS' as estado,
  trigger_name as nombre,
  event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'listing_questions'
  AND trigger_name LIKE '%notify%'
ORDER BY trigger_name;

-- Verificar preguntas sin respuesta
SELECT 
  '✅ PREGUNTAS SIN RESPUESTA' as estado,
  COUNT(*) FILTER (WHERE seller_id IS NOT NULL) as con_seller_id,
  COUNT(*) FILTER (WHERE seller_id IS NULL) as sin_seller_id,
  COUNT(*) as total
FROM public.listing_questions
WHERE is_deleted = false
  AND (answer_text IS NULL OR answer_text = '');

-- Verificar notificaciones recientes
SELECT 
  '✅ NOTIFICACIONES' as estado,
  COUNT(*) FILTER (WHERE type::text = 'listing_question' OR (data->>'kind') = 'listing_question') as de_preguntas,
  COUNT(*) FILTER (WHERE type::text = 'listing_answer' OR (data->>'kind') = 'listing_answer') as de_respuestas,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as ultimas_24h
FROM public.notifications;
