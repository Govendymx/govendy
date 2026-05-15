-- ============================================
-- VER NOTIFICACIONES: Consulta Simple
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- Ver las últimas 10 notificaciones
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  created_at,
  is_read,
  data->>'kind' as kind,
  data->>'listingId' as listing_id,
  data->>'questionId' as question_id
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;
