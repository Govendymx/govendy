-- Agregar variantes de talla a listings y selected_size a cart_items
-- Ejecuta en Supabase → SQL Editor

-- 1) Agregar columna size_variants a listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'size_variants'
  ) THEN
    ALTER TABLE public.listings
      ADD COLUMN size_variants TEXT[] NULL DEFAULT '{}'::text[];
  END IF;
END $$;

COMMENT ON COLUMN public.listings.size_variants IS 'Array de tallas disponibles como variantes del producto (máximo 12)';

-- 2) Crear función para validar que size_variants no tenga más de 12 elementos
CREATE OR REPLACE FUNCTION public.validate_size_variants()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.size_variants IS NOT NULL AND array_length(NEW.size_variants, 1) > 12 THEN
    RAISE EXCEPTION 'size_variants no puede tener más de 12 tallas';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Crear trigger para validar size_variants
DROP TRIGGER IF EXISTS trg_validate_size_variants ON public.listings;
CREATE TRIGGER trg_validate_size_variants
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_size_variants();

-- 4) Agregar campo selected_size a cart_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'selected_size'
  ) THEN
    ALTER TABLE public.cart_items
      ADD COLUMN selected_size TEXT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.cart_items.selected_size IS 'Talla seleccionada por el cliente cuando el listing tiene variantes de talla (size_variants).';

-- 5) Actualizar constraint UNIQUE de cart_items para incluir selected_size
DO $$
BEGIN
  -- Eliminar constraint antiguo si existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_items_user_id_listing_id_selected_color_key'
  ) THEN
    ALTER TABLE public.cart_items
      DROP CONSTRAINT cart_items_user_id_listing_id_selected_color_key;
  END IF;
  
  -- Crear nuevo constraint que incluye selected_color y selected_size
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_items_user_id_listing_id_selected_color_selected_size_key'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_user_id_listing_id_selected_color_selected_size_key
      UNIQUE (user_id, listing_id, selected_color, selected_size);
  END IF;
END $$;
