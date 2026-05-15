-- ==================================================================
-- FIX DIGITAL LISTINGS (RETROACTIVO)
-- 
-- Objetivo:
--   1) Asegurar que las publicaciones antiguas usadas como "producto digital"
--      queden marcadas con product_type = 'digital' y configuración coherente.
--   2) Habilitar que aparezcan con el chip "💎 PRODUCTO DIGITAL" en el frontend
--      (ListingCard usa p.product_type === 'digital').
--
-- Alcance:
--   - Publicaciones cuyo título contiene "ENVIO DIGITAL" o "ENVÍO DIGITAL".
--   - El listing de "Licencia Adobe CREATIVE CLOUD" referenciado por la orden
--     7a4c89e9-0f81-4687-907b-8ea91ec1929f (idempotente).
--
-- Seguridad:
--   - Diseñado para ser idempotente: se puede ejecutar múltiples veces sin
--     romper datos; solo normaliza a estado "digital".
-- ==================================================================

-- 1. Asegurar columnas necesarias (si no existían aún)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'physical';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS digital_delivery_type TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS digital_delivery_fields JSONB;

-- 2. Normalizar listing conocido de licencia digital (Adobe Creative Cloud)
UPDATE listings
SET product_type = 'digital',
    digital_delivery_type = 'manual',
    digital_delivery_fields = COALESCE(digital_delivery_fields, '[{"label": "Serial"}]'::jsonb),
    free_shipping = true,
    shipping_by_seller = false,
    allow_personal_delivery = false,
    weight_kg = 0,
    length_cm = 0,
    width_cm = 0,
    height_cm = 0,
    handling_days = 0,
    shipping_subsidy = 0
WHERE id IN (
  SELECT listing_id
  FROM order_items
  WHERE order_id = '7a4c89e9-0f81-4687-907b-8ea91ec1929f'
);

-- 3. Marcar como digitales las publicaciones "ENVÍO DIGITAL" antiguas
UPDATE listings
SET product_type = 'digital',
    digital_delivery_type = COALESCE(digital_delivery_type, 'manual'),
    digital_delivery_fields = COALESCE(digital_delivery_fields, '[{"label": "Serial"}]'::jsonb),
    free_shipping = true,
    shipping_by_seller = false,
    allow_personal_delivery = false,
    weight_kg = 0,
    length_cm = 0,
    width_cm = 0,
    height_cm = 0,
    handling_days = 0,
    shipping_subsidy = 0
WHERE (product_type IS NULL OR product_type <> 'digital')
  AND (
    title ILIKE '%ENVIO DIGITAL%' OR
    title ILIKE '%ENVÍO DIGITAL%'
  );

-- 4. Verificación rápida (opcional en logs de migración)
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM listings
  WHERE product_type = 'digital'
    AND (
      title ILIKE '%ENVIO DIGITAL%' OR
      title ILIKE '%ENVÍO DIGITAL%'
      OR id IN (
        SELECT listing_id
        FROM order_items
        WHERE order_id = '7a4c89e9-0f81-4687-907b-8ea91ec1929f'
      )
    );

  RAISE NOTICE 'Digital listings normalized (ENVIO DIGITAL + Adobe license): %', affected_count;
END $$;

