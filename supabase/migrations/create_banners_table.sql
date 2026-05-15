-- Crear tabla de banners para el slideshow de la página principal
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  cta_text TEXT,
  cta_link TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para ordenar banners
CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(display_order, is_active);

-- Políticas RLS
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública de banners activos
CREATE POLICY "Banners activos son visibles públicamente"
  ON banners FOR SELECT
  USING (is_active = true);

-- Solo admins pueden insertar/actualizar/eliminar banners
CREATE POLICY "Solo admins pueden gestionar banners"
  ON banners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_banners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW
  EXECUTE FUNCTION update_banners_updated_at();

-- Insertar banners de ejemplo
INSERT INTO banners (image_url, title, subtitle, cta_text, cta_link, display_order, is_active) VALUES
('/images/banner1.jpg', 'Nueva temporada', 'Descubre ofertas y prendas únicas', 'Empezar a vender >', '/sell', 1, true),
('/images/banner2.jpg', 'Vende fácil', 'Publica en minutos', 'Explorar', '/listings', 2, true),
('/images/banner3.jpg', 'Compra seguro', 'Protección total en cada compra', 'Ver más', '/dashboard/ayuda', 3, true)
ON CONFLICT DO NOTHING;
