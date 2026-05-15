-- ============================================
-- CREAR TODO: Sistema Completo de Notificaciones
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script crea TODO lo necesario automáticamente
-- Puede ejecutarse múltiples veces sin problemas
-- ============================================

-- ============================================
-- PASO 1: Crear tabla notifications si no existe
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

-- ============================================
-- PASO 2: Agregar columnas faltantes si no existen
-- ============================================
DO $$
BEGIN
  -- Agregar 'type' si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'type'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN type TEXT;
  END IF;

  -- Agregar 'title' si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'title'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN title TEXT;
  END IF;

  -- Agregar 'body' si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'body'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN body TEXT;
  END IF;

  -- Agregar 'data' si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'data'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN data JSONB;
  END IF;

  -- Agregar 'is_read' si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'is_read'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;

  -- Agregar 'created_at' si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notifications' 
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- PASO 3: Crear índices para mejor rendimiento
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type) WHERE type IS NOT NULL;

-- ============================================
-- PASO 4: Habilitar RLS (Row Level Security)
-- ============================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 5: Crear políticas RLS (si no existen)
-- ============================================
-- Política: Usuarios pueden leer sus propias notificaciones
DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
CREATE POLICY "Users can read their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Política: Sistema puede insertar notificaciones (para triggers)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: Usuarios pueden actualizar sus propias notificaciones (marcar como leídas)
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- PASO 6: Crear función para notificar al VENDEDOR (nueva pregunta)
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

  -- Intento 2: sin type (usará DEFAULT o NULL)
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
-- PASO 7: Crear función para notificar al COMPRADOR (respuesta)
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

      -- Intento 3: sin type (usará DEFAULT o NULL)
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
-- PASO 8: Crear triggers (GLOBALES para TODOS los usuarios)
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
-- PASO 9: Verificaciones finales
-- ============================================

-- Verificar tabla
SELECT 
  '✅ TABLA' as estado,
  'notifications' as nombre,
  COUNT(*) as columnas
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications';

-- Verificar triggers
SELECT 
  '✅ TRIGGER' as estado,
  trigger_name as nombre,
  event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'listing_questions'
  AND trigger_name LIKE '%notify%'
ORDER BY trigger_name;

-- Verificar funciones
SELECT 
  '✅ FUNCIÓN' as estado,
  routine_name as nombre,
  security_type as seguridad
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('notify_seller_on_new_question', 'notify_asker_on_question_answer')
ORDER BY routine_name;

-- Estadísticas
SELECT 
  '✅ ESTADÍSTICAS' as estado,
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as ultimas_24h
FROM public.notifications;
