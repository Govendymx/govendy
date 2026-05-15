-- Pocket App - Triggers para notificaciones (idempotente)
-- Ejecuta este SQL en Supabase (SQL Editor) DESPUÉS de:
-- - supabase_notifications.sql
-- - supabase_listing_questions.sql
--
-- Objetivo:
-- - Crear notificación automática cuando entra una pregunta (listing_questions INSERT)
-- - Crear notificación automática cuando entra una orden (orders INSERT)
-- - Crear notificación automática cuando una orden cambia a 'paid' (orders UPDATE status)

-- 1) Preguntas -> notificar vendedor
CREATE OR REPLACE FUNCTION public.notify_seller_on_new_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
BEGIN
  -- Evitar notificar si está marcada como borrada (por si insertan con is_deleted=true)
  IF NEW.is_deleted = true THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.title, 'Tu publicación') INTO listing_title
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
  VALUES (
    NEW.seller_id,
    'listing_question',
    'Nueva pregunta en tu publicación',
    'Te preguntaron: ' || listing_title || '.',
    jsonb_build_object('kind','listing_question','listingId', NEW.listing_id, 'questionId', NEW.id),
    false
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca romper el flujo principal por notificaciones
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_seller_on_new_question ON public.listing_questions;
CREATE TRIGGER trg_notify_seller_on_new_question
AFTER INSERT ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_new_question();

-- 1b) Respuesta -> notificar comprador/interesado (asker)
CREATE OR REPLACE FUNCTION public.notify_asker_on_question_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
BEGIN
  -- Solo cuando pasa de NULL -> NOT NULL
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.answer_text IS NULL) AND (NEW.answer_text IS NOT NULL) AND (NEW.is_deleted = false) THEN
      IF NEW.asker_id IS NULL THEN
        RETURN NEW;
      END IF;

      SELECT COALESCE(l.title, 'una publicación') INTO listing_title
      FROM public.listings l
      WHERE l.id = NEW.listing_id;

      -- Intento 1: tipo correcto
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
        VALUES (
          NEW.asker_id,
          'listing_answer',
          'El vendedor respondió tu pregunta',
          'Respondieron tu pregunta en: ' || listing_title || '.',
          jsonb_build_object('kind','listing_answer','listingId', NEW.listing_id, 'questionId', NEW.id),
          false
        );
      EXCEPTION WHEN others THEN
        -- Fallback (por ENUMs/variantes): usar un type existente, pero conservar el kind real
        BEGIN
          INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
          VALUES (
            NEW.asker_id,
            'listing_question',
            'El vendedor respondió tu pregunta',
            'Respondieron tu pregunta en: ' || listing_title || '.',
            jsonb_build_object('kind','listing_answer','listingId', NEW.listing_id, 'questionId', NEW.id),
            false
          );
        EXCEPTION WHEN others THEN
          -- Nunca romper flujo principal
          NULL;
        END;
      END;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_asker_on_question_answer ON public.listing_questions;
CREATE TRIGGER trg_notify_asker_on_question_answer
AFTER UPDATE OF answer_text ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_asker_on_question_answer();

-- 2) Órdenes -> notificar vendedor al crear (venta nueva)
CREATE OR REPLACE FUNCTION public.notify_seller_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
  VALUES (
    NEW.seller_id,
    'new_sale',
    'Tienes una venta',
    'Recibiste una compra. Orden: ' || left(NEW.id::text, 8) || '…',
    jsonb_build_object('kind','new_sale','orderId', NEW.id, 'status', COALESCE(NEW.status, 'pending')),
    false
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_seller_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_seller_on_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_new_order();

-- 3) Órdenes -> notificar vendedor cuando se paga (status -> paid)
CREATE OR REPLACE FUNCTION public.notify_seller_on_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'paid' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    VALUES (
      NEW.seller_id,
      'sale_paid',
      'Pago acreditado',
      'Se acreditó el pago de una compra. Orden: ' || left(NEW.id::text, 8) || '…',
      jsonb_build_object('kind','sale_paid','orderId', NEW.id, 'status', NEW.status),
      false
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_seller_on_order_paid ON public.orders;
CREATE TRIGGER trg_notify_seller_on_order_paid
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_order_paid();

