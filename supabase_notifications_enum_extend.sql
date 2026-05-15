-- Pocket App - Extender ENUM notification_type (idempotente)
-- Úsalo SOLO si tu columna `public.notifications.type` es ENUM (error 22P02 invalid input value for enum notification_type).
-- Ejecuta este SQL en Supabase (SQL Editor).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'notification_type') THEN
    -- Tipos usados por Pocket App (puedes agregar más si quieres)
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
  END IF;
END $$;

