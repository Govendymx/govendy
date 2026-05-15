-- ============================================
-- ELIMINAR TODAS LAS NOTIFICACIONES DE UN USUARIO
-- ============================================
-- Ejecuta este SQL en Supabase → SQL Editor
-- 
-- ⚠️ IMPORTANTE: Este script requiere que reemplaces 'TU_USER_ID' con un UUID válido
-- 
-- OPCIONES PARA OBTENER TU USER_ID:
-- 1. Ejecuta primero: OBTENER_MI_USER_ID.sql (usa auth.uid() automáticamente)
-- 2. O usa: ELIMINAR_MIS_NOTIFICACIONES.sql (no requiere ID, usa auth.uid())
-- 3. O usa: ELIMINAR_NOTIFICACIONES_POR_EMAIL.sql (usa tu email en lugar del ID)
--
-- Si necesitas usar este script con un UUID específico:
-- Ejemplo de UUID válido: '123e4567-e89b-12d3-a456-426614174000'
-- ⚠️ NO uses 'TU_USER_ID' literal, debe ser un UUID real

-- ============================================
-- OPCIÓN 1: Eliminar TODAS las notificaciones (leídas y no leídas)
-- ============================================
-- ⚠️ REEMPLAZA 'TU_USER_ID' con tu UUID real (ejemplo: '123e4567-e89b-12d3-a456-426614174000')
DELETE FROM public.notifications 
WHERE user_id = 'TU_USER_ID'::uuid;

-- ============================================
-- OPCIÓN 2: Eliminar solo las NO LEÍDAS
-- ============================================
-- ⚠️ REEMPLAZA 'TU_USER_ID' con tu UUID real
DELETE FROM public.notifications 
WHERE user_id = 'TU_USER_ID'::uuid
  AND is_read = false;

-- ============================================
-- OPCIÓN 3: Eliminar notificaciones problemáticas específicas
-- ============================================
-- Eliminar notificaciones con fechas futuras
-- ⚠️ REEMPLAZA 'TU_USER_ID' con tu UUID real
DELETE FROM public.notifications 
WHERE user_id = 'TU_USER_ID'::uuid
  AND created_at > NOW() + INTERVAL '1 day';

-- Eliminar notificaciones muy antiguas no leídas
-- ⚠️ REEMPLAZA 'TU_USER_ID' con tu UUID real
DELETE FROM public.notifications 
WHERE user_id = 'TU_USER_ID'::uuid
  AND is_read = false 
  AND created_at < NOW() - INTERVAL '1 year';

-- ============================================
-- Verificar que se eliminaron
-- ============================================
-- ⚠️ REEMPLAZA 'TU_USER_ID' con tu UUID real
SELECT 
  COUNT(*) as total_notificaciones,
  COUNT(*) FILTER (WHERE is_read = false) as no_leidas,
  COUNT(*) FILTER (WHERE is_read = true) as leidas
FROM public.notifications
WHERE user_id = 'TU_USER_ID'::uuid;

-- Si el resultado muestra 0 en todas las columnas, todas las notificaciones fueron eliminadas.
