-- ============================================
-- Migración: agregar link_to a notifications
-- Ejecuta en Supabase → SQL Editor
-- Compatible con esquema existente (CREAR_TODO_NOTIFICACIONES, etc.)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'link_to'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN link_to TEXT;
  END IF;
END $$;

-- Índice opcional para búsquedas por link_to (solo si se filtra)
-- CREATE INDEX IF NOT EXISTS idx_notifications_link_to ON public.notifications(link_to) WHERE link_to IS NOT NULL;
