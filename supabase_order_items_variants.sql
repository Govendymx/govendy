-- Agregar campos selected_size y selected_color a order_items
-- Ejecuta en Supabase → SQL Editor

DO $$
BEGIN
  -- Agregar columna selected_size si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'selected_size'
  ) THEN
    ALTER TABLE public.order_items
      ADD COLUMN selected_size TEXT NULL;
  END IF;
  
  -- Agregar columna selected_color si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'selected_color'
  ) THEN
    ALTER TABLE public.order_items
      ADD COLUMN selected_color TEXT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.order_items.selected_size IS 'Talla seleccionada por el comprador cuando el listing tiene variantes de talla (size_variants).';
COMMENT ON COLUMN public.order_items.selected_color IS 'Color seleccionado por el comprador cuando el listing tiene variantes de color (color_variants).';
