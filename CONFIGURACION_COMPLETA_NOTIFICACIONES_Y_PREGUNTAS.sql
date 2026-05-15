-- ============================================
-- CONFIGURACIÓN COMPLETA: Notificaciones y Preguntas
-- ============================================
-- Este script configura TODO lo necesario para que funcionen:
-- 1. Notificaciones cuando respondes preguntas
-- 2. Preguntas que desaparecen al responderlas
-- 3. Políticas RLS correctas
-- 4. Triggers automáticos
--
-- IMPORTANTE: Ejecuta este script completo de una vez en Supabase SQL Editor
-- ============================================

-- ============================================
-- PASO 1: Extender ENUM si existe (evitar errores)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'notification_type') THEN
    -- Extender ENUM con todos los tipos necesarios
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'listing_question'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'listing_answer'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'new_sale'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'sale_paid'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_approved'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_rejected'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'order_completed'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_announcement'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'support_message'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'support_reply'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'bid_received'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_ended'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'cart_reminder'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'shipped'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'rating_received'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dispute_opened'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dispute_message'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'test'; EXCEPTION WHEN others THEN END;
    RAISE NOTICE '✅ ENUM notification_type extendido (si existía)';
  ELSE
    RAISE NOTICE 'ℹ️ No hay ENUM notification_type, usando TEXT (normal)';
  END IF;
END $$;

-- ============================================
-- PASO 2: Crear/Verificar tabla notifications
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

-- Asegurar todas las columnas (por si la tabla ya existía)
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
  RAISE NOTICE '✅ Tabla notifications verificada/creada';
END $$;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para notifications
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
-- PASO 3: Crear/Verificar tabla listing_questions
-- ============================================
CREATE TABLE IF NOT EXISTS public.listing_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  asker_id UUID NOT NULL,
  question_text TEXT NOT NULL DEFAULT '',
  answer_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  answered_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Asegurar todas las columnas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listing_questions' AND column_name = 'answered_at') THEN
    ALTER TABLE public.listing_questions ADD COLUMN answered_at TIMESTAMP WITH TIME ZONE;
  END IF;
  RAISE NOTICE '✅ Tabla listing_questions verificada/creada';
END $$;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS listing_questions_listing_id_created_at_idx
  ON public.listing_questions (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_questions_seller_id_created_at_idx
  ON public.listing_questions (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_questions_asker_id_idx
  ON public.listing_questions (asker_id);

-- Habilitar RLS
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para listing_questions
DROP POLICY IF EXISTS "Public can read listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Authenticated can ask listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Seller can answer listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Sellers can read their own questions" ON public.listing_questions;

-- Política 1: Público puede leer preguntas no eliminadas
CREATE POLICY "Public can read listing questions"
  ON public.listing_questions
  FOR SELECT
  TO anon, authenticated
  USING (is_deleted = false);

-- Política 2: Vendedores pueden leer sus propias preguntas (IMPORTANTE para /dashboard/preguntas)
CREATE POLICY "Sellers can read their own questions"
  ON public.listing_questions
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- Política 3: Usuarios autenticados pueden hacer preguntas
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

-- Política 4: Vendedores pueden responder (actualizar answer_text)
CREATE POLICY "Seller can answer listing questions"
  ON public.listing_questions
  FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- ============================================
-- PASO 4: Crear función para notificar al vendedor (nueva pregunta)
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
      jsonb_build_object('kind','listing_question','listingId', NEW.listing_id, 'questionId', NEW.id),
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
-- PASO 5: Crear función para notificar al comprador (respuesta) - LA MÁS IMPORTANTE
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
        );
        notification_created := true;
      EXCEPTION WHEN others THEN
        -- Continuar con siguiente intento
        NULL;
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
        EXCEPTION WHEN others THEN
          -- Continuar con siguiente intento
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
              'link', '/listings/' || NEW.listing_id,
              'link_url', '/listings/' || NEW.listing_id
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
-- PASO 6: Crear triggers
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
-- PASO 7: Verificaciones finales
-- ============================================
DO $$
DECLARE
  trigger1_exists boolean;
  trigger2_exists boolean;
  function1_exists boolean;
  function2_exists boolean;
  notifications_table_exists boolean;
  questions_table_exists boolean;
BEGIN
  -- Verificar triggers
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_notify_seller_on_new_question'
    AND tgenabled = 'O'
  ) INTO trigger1_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_notify_asker_on_question_answer'
    AND tgenabled = 'O'
  ) INTO trigger2_exists;
  
  -- Verificar funciones
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_seller_on_new_question'
  ) INTO function1_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_asker_on_question_answer'
  ) INTO function2_exists;
  
  -- Verificar tablas
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'notifications'
  ) INTO notifications_table_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'listing_questions'
  ) INTO questions_table_exists;
  
  -- Mostrar resultados
  IF notifications_table_exists THEN
    RAISE NOTICE '✅ Tabla notifications existe';
  ELSE
    RAISE WARNING '❌ Tabla notifications NO existe';
  END IF;
  
  IF questions_table_exists THEN
    RAISE NOTICE '✅ Tabla listing_questions existe';
  ELSE
    RAISE WARNING '❌ Tabla listing_questions NO existe';
  END IF;
  
  IF function1_exists THEN
    RAISE NOTICE '✅ Función notify_seller_on_new_question existe';
  ELSE
    RAISE WARNING '❌ Función notify_seller_on_new_question NO existe';
  END IF;
  
  IF function2_exists THEN
    RAISE NOTICE '✅ Función notify_asker_on_question_answer existe';
  ELSE
    RAISE WARNING '❌ Función notify_asker_on_question_answer NO existe';
  END IF;
  
  IF trigger1_exists THEN
    RAISE NOTICE '✅ Trigger trg_notify_seller_on_new_question está ACTIVO';
  ELSE
    RAISE WARNING '❌ Trigger trg_notify_seller_on_new_question NO está activo';
  END IF;
  
  IF trigger2_exists THEN
    RAISE NOTICE '✅ Trigger trg_notify_asker_on_question_answer está ACTIVO';
  ELSE
    RAISE WARNING '❌ Trigger trg_notify_asker_on_question_answer NO está activo';
  END IF;
  
  -- Resumen final
  IF trigger1_exists AND trigger2_exists AND function1_exists AND function2_exists 
     AND notifications_table_exists AND questions_table_exists THEN
    RAISE NOTICE '🎉 TODO CONFIGURADO CORRECTAMENTE';
    RAISE NOTICE '📋 Próximos pasos:';
    RAISE NOTICE '   1. Responde una pregunta desde /dashboard/preguntas';
    RAISE NOTICE '   2. La pregunta debe desaparecer inmediatamente';
    RAISE NOTICE '   3. El comprador debería ver el punto rosa parpadeante';
  ELSE
    RAISE WARNING '⚠️ HAY PROBLEMAS. Revisa los mensajes anteriores.';
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Este script ha configurado:
-- ✅ Tabla notifications con todas las columnas
-- ✅ Tabla listing_questions con todas las columnas
-- ✅ Políticas RLS para ambas tablas
-- ✅ Función notify_seller_on_new_question (notifica al vendedor)
-- ✅ Función notify_asker_on_question_answer (notifica al comprador)
-- ✅ Trigger trg_notify_seller_on_new_question (nueva pregunta)
-- ✅ Trigger trg_notify_asker_on_question_answer (respuesta) - EL MÁS IMPORTANTE
--
-- Revisa la pestaña "Results" para ver los mensajes de verificación
