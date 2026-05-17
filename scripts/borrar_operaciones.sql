-- BORRAR TODAS LAS ÓRDENES Y SUS ITEMS
-- Ejecutar en el SQL Editor de Supabase
BEGIN;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.checkout_sessions;
COMMIT;
