-- ============================================================
-- DIAGNÓSTICO Y ELIMINACIÓN DE NOTIFICACIONES ATORADAS
-- ============================================================
-- Este script identifica y elimina notificaciones problemáticas
-- que están causando que el contador muestre números incorrectos.
-- ============================================================

-- PASO 1: Verificar el estado actual de las notificaciones
-- ============================================================
SELECT 
  'Estado de notificaciones' as diagnostico,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas,
  COUNT(*) FILTER (WHERE is_read IS NULL) as sin_estado,
  COUNT(*) FILTER (WHERE user_id = auth.uid()) as mis_notificaciones,
  COUNT(*) FILTER (WHERE user_id = auth.uid() AND is_read = false) as mis_no_leidas,
  COUNT(*) FILTER (WHERE user_id = auth.uid() AND is_read IS NULL) as mis_sin_estado
FROM notifications
WHERE user_id = auth.uid();

-- PASO 2: Ver las notificaciones problemáticas (is_read = NULL o true pero que deberían ser false)
-- ============================================================
SELECT 
  id,
  type,
  data->>'kind' as kind,
  is_read,
  created_at,
  body,
  CASE 
    WHEN is_read IS NULL THEN 'SIN ESTADO (NULL)'
    WHEN is_read = true THEN 'LEÍDA (pero contada como no leída)'
    ELSE 'OK'
  END as problema
FROM notifications
WHERE user_id = auth.uid()
  AND (is_read IS NULL OR is_read = true)
ORDER BY created_at DESC
LIMIT 20;

-- PASO 3: ELIMINAR notificaciones con is_read = NULL (estado inconsistente)
-- ============================================================
-- Estas notificaciones pueden estar causando el problema
DELETE FROM notifications
WHERE user_id = auth.uid()
  AND is_read IS NULL;

-- PASO 4: ELIMINAR notificaciones muy antiguas (más de 30 días) que están marcadas como leídas
-- ============================================================
-- Estas notificaciones antiguas no deberían aparecer en el contador
DELETE FROM notifications
WHERE user_id = auth.uid()
  AND is_read = true
  AND created_at < NOW() - INTERVAL '30 days';

-- PASO 5: FORZAR is_read = false en notificaciones que deberían ser no leídas pero tienen NULL
-- ============================================================
-- Si hay notificaciones recientes con is_read = NULL, marcarlas como no leídas
-- (Esto es por si acaso, aunque ya las eliminamos en el paso 3)
UPDATE notifications
SET is_read = false
WHERE user_id = auth.uid()
  AND is_read IS NULL
  AND created_at > NOW() - INTERVAL '7 days';

-- PASO 6: Verificar el resultado final
-- ============================================================
SELECT 
  'Resultado final' as diagnostico,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas,
  COUNT(*) FILTER (WHERE is_read IS NULL) as sin_estado
FROM notifications
WHERE user_id = auth.uid();

-- PASO 7: Mostrar las notificaciones no leídas restantes
-- ============================================================
SELECT 
  id,
  type,
  data->>'kind' as kind,
  is_read,
  created_at,
  LEFT(body, 50) as preview
FROM notifications
WHERE user_id = auth.uid()
  AND is_read = false
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- INSTRUCCIONES:
-- ============================================================
-- 1. Ejecuta este script completo en Supabase SQL Editor
-- 2. Revisa los resultados de cada paso
-- 3. Si el PASO 2 muestra notificaciones problemáticas, 
--    el PASO 3 y 4 las eliminarán
-- 4. El PASO 6 te mostrará el estado final
-- 5. El PASO 7 te mostrará las notificaciones no leídas que quedan
-- ============================================================
