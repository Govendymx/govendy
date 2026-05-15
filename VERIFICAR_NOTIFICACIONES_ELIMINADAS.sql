-- ============================================
-- VERIFICAR NOTIFICACIONES ELIMINADAS
-- ============================================
-- Ejecuta este SQL DESPUÉS de eliminar las notificaciones
-- 
-- ⚠️ REEMPLAZA 'tu-email@ejemplo.com' con tu email real

SELECT 
  'VERIFICACIÓN' as estado,
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas,
  COUNT(*) FILTER (WHERE created_at > NOW()) as fechas_futuras
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'tu-email@ejemplo.com'
  LIMIT 1
);

-- Si el resultado muestra no_leidas = 0, todas las notificaciones no leídas fueron eliminadas correctamente.
