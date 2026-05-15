-- Agregar campo selected_color a cart_items para guardar el color seleccionado
-- Ejecuta en Supabase → SQL Editor

DO $$
BEGIN
  -- Agregar columna selected_color si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'selected_color'
  ) THEN
    ALTER TABLE public.cart_items
      ADD COLUMN selected_color TEXT NULL;
  END IF;
  
  -- Eliminar el constraint UNIQUE antiguo (user_id, listing_id) si existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_items_user_id_listing_id_key'
  ) THEN
    ALTER TABLE public.cart_items
      DROP CONSTRAINT cart_items_user_id_listing_id_key;
  END IF;
  
  -- Crear nuevo constraint UNIQUE que incluye selected_color
  -- Esto permite tener el mismo listing con diferentes colores en el carrito
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_items_user_id_listing_id_selected_color_key'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_user_id_listing_id_selected_color_key
      UNIQUE (user_id, listing_id, selected_color);
  END IF;
END $$;

COMMENT ON COLUMN public.cart_items.selected_color IS 'Color seleccionado por el cliente cuando el listing tiene variantes de color (color_variants). Permite tener el mismo listing con diferentes colores en el carrito.';
