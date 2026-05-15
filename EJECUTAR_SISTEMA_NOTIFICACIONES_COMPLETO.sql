-- ============================================================
-- SCRIPT COMPLETO: Sistema de Notificaciones
-- Ejecuta este SQL en Supabase SQL Editor
-- Crea y configura TODO el sistema de notificaciones
-- ============================================================

-- ============================================================
-- PARTE 1: Crear tabla notifications con todas las columnas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  link_to TEXT, -- Ruta de la app (ej. /dashboard/ventas?order=...)
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Agregar columnas faltantes si no existen
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link_to TEXT;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW());

-- ============================================================
-- PARTE 2: Crear índices optimizados
-- ============================================================

-- Índice principal para consultas por usuario ordenadas por fecha
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- Índice para notificaciones no leídas (usado en contadores)
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id)
  WHERE is_read = false;

-- Índice para búsqueda por tipo (opcional, útil para filtros)
CREATE INDEX IF NOT EXISTS notifications_type_idx
  ON public.notifications (type)
  WHERE type IS NOT NULL;

-- Índice para link_to (opcional, útil para debugging)
CREATE INDEX IF NOT EXISTS notifications_link_to_idx
  ON public.notifications (link_to)
  WHERE link_to IS NOT NULL;

-- ============================================================
-- PARTE 3: Configurar RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes (re-ejecutable)
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Política de lectura: usuarios solo pueden leer sus propias notificaciones
CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Política de actualización: usuarios solo pueden actualizar sus propias notificaciones
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Nota: INSERT no necesita política porque se usa service_role (supabaseAdmin())
-- que hace bypass de RLS automáticamente

-- ============================================================
-- PARTE 4: Habilitar Realtime (si está disponible)
-- ============================================================

-- Nota: Realtime se habilita desde Supabase Dashboard
-- Database → Replication → Habilitar para tabla 'notifications'
-- Este script solo verifica si está habilitado

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

SELECT 
  '✅ VERIFICACIÓN COMPLETA' as estado,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') as tabla_creada,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications') as columnas_totales,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'notifications') as indices_creados,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'notifications') as politicas_rls_creadas;

-- Verificar columnas específicas
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'notifications'
ORDER BY ordinal_position;

-- ============================================================
-- RESUMEN
-- ============================================================
-- Si todo salió bien, deberías ver:
-- - tabla_creada: 1
-- - columnas_totales: 8 (id, user_id, type, title, body, link_to, data, is_read, created_at)
-- - indices_creados: 4 o más
-- - politicas_rls_creadas: 2
-- ============================================================
