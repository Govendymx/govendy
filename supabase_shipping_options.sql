-- Tabla para opciones de envío (hasta 5 opciones)
CREATE TABLE IF NOT EXISTS public.shipping_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '', -- Nombre de la paquetería (ej: "Estafeta", "FedEx", "DHL")
  logo_url TEXT NOT NULL DEFAULT '', -- URL del logo PNG en Supabase Storage
  cost NUMERIC NOT NULL DEFAULT 0, -- Costo de envío
  delivery_days INTEGER NOT NULL DEFAULT 1, -- Días estimados de entrega
  is_active BOOLEAN NOT NULL DEFAULT true, -- Si está activa y visible en checkout
  display_order INTEGER NOT NULL DEFAULT 0, -- Orden de visualización (0-4 para hasta 5 opciones)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT shipping_options_display_order_check CHECK (display_order >= 0 AND display_order < 5)
);

-- Índice para ordenar por display_order
CREATE INDEX IF NOT EXISTS idx_shipping_options_display_order ON public.shipping_options(display_order);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_shipping_options_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_shipping_options_updated_at ON public.shipping_options;
CREATE TRIGGER trg_update_shipping_options_updated_at
  BEFORE UPDATE ON public.shipping_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_shipping_options_updated_at();

-- RLS: Lectura pública (necesario para checkout)
ALTER TABLE public.shipping_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active shipping options" ON public.shipping_options;
CREATE POLICY "Anyone can read active shipping options"
  ON public.shipping_options
  FOR SELECT
  TO public
  USING (is_active = true);

-- RLS: Solo admins pueden insertar/actualizar/eliminar
DROP POLICY IF EXISTS "Admins can manage shipping options" ON public.shipping_options;
CREATE POLICY "Admins can manage shipping options"
  ON public.shipping_options
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Agregar columna shipping_option_id a orders (opcional, para tracking)
-- Si la columna ya existe, no hará nada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'shipping_option_id'
  ) THEN
    ALTER TABLE public.orders 
    ADD COLUMN shipping_option_id UUID REFERENCES public.shipping_options(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Comentarios
COMMENT ON TABLE public.shipping_options IS 'Opciones de envío disponibles para que el cliente elija en checkout (máximo 5 opciones activas)';
COMMENT ON COLUMN public.shipping_options.name IS 'Nombre de la paquetería o método de envío';
COMMENT ON COLUMN public.shipping_options.logo_url IS 'URL del logo PNG almacenado en Supabase Storage';
COMMENT ON COLUMN public.shipping_options.cost IS 'Costo del envío en la moneda base';
COMMENT ON COLUMN public.shipping_options.delivery_days IS 'Días estimados de entrega';
COMMENT ON COLUMN public.shipping_options.is_active IS 'Si está activa y visible en el checkout';
COMMENT ON COLUMN public.shipping_options.display_order IS 'Orden de visualización (0-4 para hasta 5 opciones)';
