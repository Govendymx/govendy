-- =====================================================
-- GIFT CARD OFFICIAL STORE - Ejecutar en Supabase SQL Editor
-- Crea un perfil de tienda oficial para tarjetas de regalo
-- =====================================================

-- 1. Verificar si ya existe un perfil de gift cards
DO $$
DECLARE
  v_store_id UUID;
BEGIN
  -- Buscar si ya existe
  SELECT id INTO v_store_id
  FROM profiles
  WHERE official_store_name = 'PocketCash Gift Cards'
  LIMIT 1;

  IF v_store_id IS NOT NULL THEN
    -- Ya existe, solo actualizar
    UPDATE profiles SET
      is_official_store = true,
      official_store_brand_color = '#F97316',
      official_store_banner_url = NULL,
      official_store_slogan = 'Regala saldo PocketCash a quien quieras'
    WHERE id = v_store_id;
    
    RAISE NOTICE 'Tienda actualizada: %', v_store_id;
  ELSE
    -- Crear nuevo perfil
    -- NOTA: Necesitas un user_id real de Supabase Auth.
    -- Opción 1: Usa tu propio user_id de admin
    -- Opción 2: Crea un usuario dummy en Auth primero
    -- 
    -- Descomenta y reemplaza YOUR_ADMIN_USER_ID con tu ID de admin:
    
    -- UPDATE profiles SET
    --   is_official_store = true,
    --   official_store_name = 'PocketCash Gift Cards',
    --   official_store_brand_color = '#F97316',
    --   official_store_slogan = 'Regala saldo PocketCash a quien quieras',
    --   full_name = 'PocketCash Gift Cards',
    --   store_logo_url = NULL
    -- WHERE id = 'YOUR_ADMIN_USER_ID';
    
    RAISE NOTICE 'No se encontró perfil existente. Descomenta el UPDATE con tu user_id de admin.';
  END IF;
END $$;

-- =====================================================
-- ALTERNATIVA RÁPIDA: Si quieres usar tu perfil de admin como tienda oficial
-- Reemplaza ADMIN_USER_ID con tu UUID real
-- =====================================================
-- UPDATE profiles SET
--   is_official_store = true,
--   official_store_name = 'PocketCash Gift Cards', 
--   official_store_brand_color = '#F97316',
--   official_store_slogan = 'Regala saldo PocketCash a quien quieras'
-- WHERE id = 'ADMIN_USER_ID';
