-- ============================================
-- VERIFICAR QUÉ CAUSA EL CONTADOR DEL PUNTO ROSA
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- Este script te muestra EXACTAMENTE qué está causando el contador
-- 
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real

-- ============================================
-- PASO 1: Obtener tu user_id
-- ============================================
-- Esto te mostrará tu user_id para usar en los siguientes pasos
SELECT 
  id as user_id,
  email
FROM auth.users
WHERE email = 'tu-email@ejemplo.com'
LIMIT 1;

-- ============================================
-- PASO 2: Ver TODAS las alertas que causan el contador
-- ============================================
-- Este es el desglose completo de qué está causando el contador

WITH user_info AS (
  SELECT id as user_id
  FROM auth.users
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
),
notificaciones AS (
  SELECT 
    'NOTIFICACIONES' as tipo,
    COUNT(*) as cantidad,
    'Tabla: notifications' as fuente
  FROM public.notifications n, user_info u
  WHERE n.user_id = u.user_id
    AND n.is_read = false
),
ventas AS (
  SELECT 
    'VENTAS' as tipo,
    COUNT(*) as cantidad,
    'Tabla: notifications (new_sale, sale_paid)' as fuente
  FROM public.notifications n, user_info u
  WHERE n.user_id = u.user_id
    AND n.is_read = false
    AND (
      LOWER(COALESCE(n.data->>'kind', n.type::text, '')) IN ('new_sale', 'sale_paid')
      OR LOWER(COALESCE(n.type::text, '')) IN ('new_sale', 'sale_paid')
    )
),
soporte AS (
  SELECT 
    'SOPORTE' as tipo,
    COUNT(*) as cantidad,
    'Tabla: notifications (support_*)' as fuente
  FROM public.notifications n, user_info u
  WHERE n.user_id = u.user_id
    AND n.is_read = false
    AND (
      LOWER(COALESCE(n.data->>'kind', n.type::text, '')) LIKE 'support%'
      OR LOWER(COALESCE(n.type::text, '')) LIKE 'support%'
    )
),
otras_notificaciones AS (
  SELECT 
    'OTRAS NOTIFICACIONES' as tipo,
    COUNT(*) as cantidad,
    'Tabla: notifications (otras)' as fuente
  FROM public.notifications n, user_info u
  WHERE n.user_id = u.user_id
    AND n.is_read = false
    AND NOT (
      LOWER(COALESCE(n.data->>'kind', n.type::text, '')) IN ('new_sale', 'sale_paid', 'outbid', 'rating_received', 'ratings_complete')
      OR LOWER(COALESCE(n.data->>'kind', n.type::text, '')) LIKE 'support%'
    )
),
preguntas_respondidas AS (
  SELECT 
    'PREGUNTAS RESPONDIDAS' as tipo,
    COUNT(*) as cantidad,
    'Tabla: listing_questions' as fuente
  FROM public.listing_questions lq, user_info u
  WHERE lq.asker_id = u.user_id
    AND lq.is_deleted = false
    AND lq.answer_text IS NOT NULL
),
preguntas_sin_responder AS (
  SELECT 
    'PREGUNTAS SIN RESPONDER' as tipo,
    COUNT(*) as cantidad,
    'Tabla: listing_questions' as fuente
  FROM public.listing_questions lq, user_info u
  WHERE lq.seller_id = u.user_id
    AND lq.is_deleted = false
    AND lq.answer_text IS NULL
),
subastas_terminando AS (
  SELECT 
    ' SUBASTAS TERMINANDO' as tipo,
    COUNT(*) as cantidad,
    'Tabla: listings + favorites' as fuente
  FROM public.favorites f, public.listings l, user_info u
  WHERE f.user_id = u.user_id
    AND f.listing_id = l.id
    AND l.sale_type = 'auction'
    AND l.auction_end_at > NOW()
    AND l.auction_end_at < NOW() + INTERVAL '24 hours'
)
SELECT * FROM notificaciones
UNION ALL
SELECT * FROM ventas
UNION ALL
SELECT * FROM soporte
UNION ALL
SELECT * FROM otras_notificaciones
UNION ALL
SELECT * FROM preguntas_respondidas
UNION ALL
SELECT * FROM preguntas_sin_responder
UNION ALL
SELECT * FROM subastas_terminando
ORDER BY cantidad DESC;

-- ============================================
-- PASO 3: Total de alertas (igual que el contador)
-- ============================================
-- Este es el número total que muestra el punto rosa
WITH user_info AS (
  SELECT id as user_id
  FROM auth.users
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
),
total_notificaciones AS (
  SELECT COUNT(*) as cnt
  FROM public.notifications n, user_info u
  WHERE n.user_id = u.user_id
    AND n.is_read = false
),
total_preguntas_respondidas AS (
  SELECT COUNT(*) as cnt
  FROM public.listing_questions lq, user_info u
  WHERE lq.asker_id = u.user_id
    AND lq.is_deleted = false
    AND lq.answer_text IS NOT NULL
),
total_preguntas_sin_responder AS (
  SELECT COUNT(*) as cnt
  FROM public.listing_questions lq, user_info u
  WHERE lq.seller_id = u.user_id
    AND lq.is_deleted = false
    AND lq.answer_text IS NULL
),
total_subastas AS (
  SELECT COUNT(*) as cnt
  FROM public.favorites f, public.listings l, user_info u
  WHERE f.user_id = u.user_id
    AND f.listing_id = l.id
    AND l.sale_type = 'auction'
    AND l.auction_end_at > NOW()
    AND l.auction_end_at < NOW() + INTERVAL '24 hours'
)
SELECT 
  'TOTAL DE ALERTAS' as descripcion,
  (SELECT cnt FROM total_notificaciones) +
  (SELECT cnt FROM total_preguntas_respondidas) +
  (SELECT cnt FROM total_preguntas_sin_responder) +
  (SELECT cnt FROM total_subastas) as total,
  'Este es el número que muestra el punto rosa' as nota;
