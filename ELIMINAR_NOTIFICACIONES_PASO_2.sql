-- ============================================
-- PASO 2: Eliminar notificaciones con fechas futuras
-- ============================================
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real
-- Ejecuta este script DESPUÉS del PASO 1
DELETE FROM public.notifications 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
)
AND created_at > NOW() + INTERVAL '1 day';
