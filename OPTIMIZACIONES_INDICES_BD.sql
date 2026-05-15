-- ============================================
-- OPTIMIZACIONES DE ÍNDICES PARA BASE DE DATOS
-- ============================================
-- Este script agrega índices para mejorar el rendimiento de consultas frecuentes
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Índices para la tabla 'listings' (consultas frecuentes)
CREATE INDEX IF NOT EXISTS idx_listings_status_active ON listings(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_sale_type ON listings(sale_type);
CREATE INDEX IF NOT EXISTS idx_listings_auction_end_at ON listings(auction_end_at) WHERE sale_type = 'auction';
CREATE INDEX IF NOT EXISTS idx_listings_is_featured ON listings(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_listings_created_at_desc ON listings(created_at DESC);

-- Índice compuesto para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_listings_status_featured_created ON listings(status, is_featured, created_at DESC) WHERE status = 'active';

-- 2. Índices para la tabla 'listing_questions' (consultas frecuentes)
CREATE INDEX IF NOT EXISTS idx_listing_questions_seller_id ON listing_questions(seller_id);
CREATE INDEX IF NOT EXISTS idx_listing_questions_asker_id ON listing_questions(asker_id);
CREATE INDEX IF NOT EXISTS idx_listing_questions_listing_id ON listing_questions(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_questions_answer_text_null ON listing_questions(seller_id, is_deleted) WHERE answer_text IS NULL AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_listing_questions_created_at_desc ON listing_questions(created_at DESC);

-- 3. Índices para la tabla 'orders' (consultas frecuentes)
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON orders(shipped_at) WHERE shipped_at IS NOT NULL;

-- Índice compuesto para consultas de ventas
CREATE INDEX IF NOT EXISTS idx_orders_seller_status_created ON orders(seller_id, status, created_at DESC);

-- 4. Índices para la tabla 'notifications' (consultas muy frecuentes)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(user_id, type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at_desc ON notifications(created_at DESC);

-- Índice compuesto para consultas de alertas
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = false;

-- 5. Índices para la tabla 'estafeta_quotes' (nuevo sistema)
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_user_id ON estafeta_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_status ON estafeta_quotes(status);
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_paid_at ON estafeta_quotes(paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_created_at_desc ON estafeta_quotes(created_at DESC);

-- Índice compuesto para consultas del admin
CREATE INDEX IF NOT EXISTS idx_estafeta_quotes_status_guide ON estafeta_quotes(status, guide_file_url) WHERE status IN ('paid', 'processing');

-- 6. Índices para la tabla 'favorites' (consultas frecuentes)
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_listing ON favorites(user_id, listing_id);

-- 7. Índices para la tabla 'order_items' (consultas frecuentes)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_listing_id ON order_items(listing_id);

-- 8. Índices para la tabla 'user_ratings' (consultas frecuentes)
CREATE INDEX IF NOT EXISTS idx_user_ratings_order_id ON user_ratings(order_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_rater_id ON user_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_direction ON user_ratings(order_id, direction);

-- 9. Índices para la tabla 'home_banners' (consultas frecuentes)
CREATE INDEX IF NOT EXISTS idx_home_banners_placement_active ON home_banners(placement, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_home_banners_sort_order ON home_banners(placement, sort_order, is_active) WHERE is_active = true;

-- 10. Índices para la tabla 'order_messages' (chat de órdenes)
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created_at_desc ON order_messages(order_id, created_at DESC);

-- 11. Índices para la tabla 'order_chat_reads' (chat de órdenes)
CREATE INDEX IF NOT EXISTS idx_order_chat_reads_user_order ON order_chat_reads(user_id, order_id);

-- ============================================
-- ÍNDICES ADICIONALES PARA 10K-50K USUARIOS
-- ============================================

-- 12. Índices compuestos optimizados para consultas de paginación
CREATE INDEX IF NOT EXISTS idx_listing_questions_seller_unanswered_paginated 
ON listing_questions(seller_id, created_at DESC) 
WHERE answer_text IS NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_orders_seller_status_created_paginated 
ON orders(seller_id, status, created_at DESC) 
WHERE status IN ('paid', 'shipped', 'delivered', 'pending_payment');

CREATE INDEX IF NOT EXISTS idx_orders_buyer_status_created_paginated 
ON orders(buyer_id, status, created_at DESC) 
WHERE status IN ('paid', 'shipped', 'delivered', 'pending_payment');

-- 13. Índices para consultas de búsqueda y filtrado
CREATE INDEX IF NOT EXISTS idx_listings_title_search ON listings USING gin(to_tsvector('spanish', title));
CREATE INDEX IF NOT EXISTS idx_listings_description_search ON listings USING gin(to_tsvector('spanish', description));

-- 14. Índices para consultas de agregación (counts, sums)
CREATE INDEX IF NOT EXISTS idx_orders_seller_status_count ON orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status_count ON orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_listing_questions_seller_answered_count 
ON listing_questions(seller_id, is_deleted) 
WHERE answer_text IS NOT NULL AND is_deleted = false;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. Estos índices mejorarán significativamente el rendimiento de consultas frecuentes
-- 2. Los índices ocupan espacio en disco, pero mejoran mucho la velocidad de consultas
-- 3. Los índices parciales (WHERE) son más eficientes y ocupan menos espacio
-- 4. Después de crear los índices, las consultas deberían ser más rápidas
-- 5. Monitorear el uso de espacio y rendimiento después de aplicar estos índices
-- ============================================
