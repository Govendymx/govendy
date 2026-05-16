-- =============================================================================
-- GoVendy — DIAGNÓSTICO: qué SQL falta en tu proyecto Supabase
-- Ejecuta TODO en SQL Editor. Revisa filas con estado ❌ FALTA
-- =============================================================================

-- ── A) TABLAS CRÍTICAS ───────────────────────────────────────────────────────
WITH required_tables AS (
  SELECT unnest(ARRAY[
    'profiles', 'listings', 'cart_items', 'orders', 'order_items',
    'checkout_sessions', 'notifications', 'listing_questions',
    'favorites', 'admin_users', 'app_settings', 'user_admin_states',
    'wallets', 'wallet_transactions', 'disputes', 'dispute_messages',
    'order_messages', 'order_chat_reads', 'support_conversations', 'support_messages',
    'home_banners', 'featured_listings', 'category_requests', 'bids',
    'estafeta_quotes', 'digital_deliveries', 'seller_withdrawals',
    'follows', 'user_ratings', 'pro_subscription_logs'
  ]) AS table_name
)
SELECT
  'TABLA' AS tipo,
  rt.table_name AS nombre,
  CASE WHEN t.table_name IS NOT NULL THEN '✅ OK' ELSE '❌ FALTA — crear tabla' END AS estado
FROM required_tables rt
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = rt.table_name
ORDER BY estado DESC, nombre;

-- ── B) COLUMNAS: cart_items (carrito) ────────────────────────────────────────
WITH req AS (
  SELECT unnest(ARRAY[
    'id', 'user_id', 'listing_id', 'quantity',
    'selected_color', 'selected_size',
    'created_at', 'updated_at', 'last_reminder_at'
  ]) AS col
)
SELECT
  'cart_items' AS tabla,
  r.col AS columna,
  CASE WHEN c.column_name IS NOT NULL THEN '✅ OK' ELSE '❌ FALTA' END AS estado
FROM req r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'cart_items' AND c.column_name = r.col
ORDER BY estado DESC, col;

-- Índice único de variantes (recomendado tras supabase_cart_items_complete.sql)
SELECT
  'cart_items' AS tabla,
  'cart_items_user_listing_variant_uidx' AS columna,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'cart_items'
      AND indexname = 'cart_items_user_listing_variant_uidx'
  ) THEN '✅ OK'
    ELSE '❌ FALTA — ejecutar supabase_cart_items_complete.sql'
  END AS estado;

-- RLS cart_items (siempre devuelve 1 fila)
SELECT
  'cart_items RLS' AS tabla,
  COALESCE(
    (SELECT string_agg(policyname, ', ' ORDER BY policyname)
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'cart_items'),
    '(sin políticas)'
  ) AS columna,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cart_items') >= 4
      THEN '✅ OK (' || (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cart_items') || ' políticas)'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cart_items') > 0
      THEN '⚠️ PARCIAL (' || (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cart_items') || ')'
    ELSE '❌ FALTA — políticas RLS'
  END AS estado;

-- ── C) COLUMNAS: listings (publicar / carrito / checkout) ───────────────────
WITH req AS (
  SELECT unnest(ARRAY[
    'id', 'seller_id', 'title', 'price', 'status', 'images', 'stock',
    'color', 'size', 'color_variants', 'size_variants', 'size_stock', 'size_type',
    'sale_type', 'condition', 'category', 'subcategory', 'gender', 'tags', 'attributes',
    'free_shipping', 'shipping_by_seller', 'shipping_price', 'shipping_subsidy',
    'weight_kg', 'length_cm', 'width_cm', 'height_cm',
    'allow_personal_delivery', 'handling_days', 'shipping_carrier',
    'auction_start_at', 'auction_end_at', 'auction_starting_bid',
    'auction_bid_increment', 'auction_highest_bid',
    'wholesale_tiers', 'product_type', 'digital_delivery_type', 'digital_delivery_fields',
    'description_blocks', 'is_featured', 'public_id', 'nickname', 'brand', 'model',
    'youtube_url', 'expires_at', 'view_count'
  ]) AS col
)
SELECT
  'listings' AS tabla,
  r.col AS columna,
  CASE WHEN c.column_name IS NOT NULL THEN '✅ OK' ELSE '❌ FALTA' END AS estado
FROM req r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'listings' AND c.column_name = r.col
ORDER BY estado DESC, col;

-- ── D) COLUMNAS: profiles (perfil, verificación, planes) ─────────────────────
WITH req AS (
  SELECT unnest(ARRAY[
    'id', 'full_name', 'first_name', 'last_name', 'nickname', 'phone', 'email',
    'apellido_paterno', 'apellido_materno', 'rfc', 'curp',
    'address_street', 'ext_number', 'int_number', 'neighborhood',
    'zip_code', 'state', 'city', 'references', 'cross_streets',
    'plan_type', 'pro_subscription_end', 'is_verified', 'verification_status',
    'ine_front_url', 'ine_back_url', 'selfie_ine_url',
    'payout_bank_name', 'payout_account_holder', 'payout_clabe', 'mercadopago_account',
    'store_logo_url', 'is_official_store', 'has_seen_onboarding_tour',
    'is_wholesaler', 'is_manufacturer', 'live_hours_balance'
  ]) AS col
)
SELECT
  'profiles' AS tabla,
  r.col AS columna,
  CASE WHEN c.column_name IS NOT NULL THEN '✅ OK' ELSE '❌ FALTA' END AS estado
FROM req r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'profiles' AND c.column_name = r.col
ORDER BY estado DESC, col;

-- ── E) COLUMNAS: orders / order_items ───────────────────────────────────────
WITH req_orders AS (
  SELECT unnest(ARRAY[
    'id', 'buyer_id', 'seller_id', 'status', 'total_amount', 'payment_method',
    'shipping_label_url', 'paid_to_seller_at', 'tracking_number', 'delivery_proof_url'
  ]) AS col
)
SELECT 'orders' AS tabla, r.col AS columna,
  CASE WHEN c.column_name IS NOT NULL THEN '✅ OK' ELSE '❌ FALTA' END AS estado
FROM req_orders r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'orders' AND c.column_name = r.col
ORDER BY estado DESC, col;

WITH req_oi AS (
  SELECT unnest(ARRAY[
    'id', 'order_id', 'listing_id', 'title', 'quantity', 'line_total',
    'selected_size', 'selected_color'
  ]) AS col
)
SELECT 'order_items' AS tabla, r.col AS columna,
  CASE WHEN c.column_name IS NOT NULL THEN '✅ OK' ELSE '❌ FALTA' END AS estado
FROM req_oi r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'order_items' AND c.column_name = r.col
ORDER BY estado DESC, col;

-- ── F) FUNCIONES RPC usadas por la app ───────────────────────────────────────
WITH req AS (
  SELECT unnest(ARRAY[
    'decrement_listing_stock',
    'is_admin'
  ]) AS fn
)
SELECT
  'FUNCIÓN' AS tipo,
  r.fn AS nombre,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE p.proname = r.fn
  ) THEN '✅ OK' ELSE '❌ FALTA' END AS estado
FROM req r;

-- ── G) RESUMEN: solo lo que FALTA (compacto) ─────────────────────────────────
SELECT 'RESUMEN FALTANTE' AS seccion, nombre, estado FROM (
  SELECT rt.table_name AS nombre,
    'TABLA' AS estado
  FROM (SELECT unnest(ARRAY[
    'profiles','listings','cart_items','orders','order_items','wallets',
    'notifications','listing_questions','admin_users','app_settings'
  ]) AS table_name) rt
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public' AND t.table_name = rt.table_name
  WHERE t.table_name IS NULL

  UNION ALL

  SELECT 'cart_items.' || r.col,
    'COLUMNA'
  FROM (SELECT unnest(ARRAY['selected_color','selected_size']) AS col) r
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'cart_items' AND c.column_name = r.col
  WHERE c.column_name IS NULL

  UNION ALL

  SELECT 'listings.' || r.col, 'COLUMNA'
  FROM (SELECT unnest(ARRAY['size_stock','color_variants','size_variants','stock','wholesale_tiers']) AS col) r
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public' AND c.table_name = 'listings' AND c.column_name = r.col
  WHERE c.column_name IS NULL
) x
ORDER BY seccion, nombre;
