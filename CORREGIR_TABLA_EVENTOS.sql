-- Script para corregir la tabla admin_operation_events
-- Agrega las columnas faltantes que causan el error "column severity does not exist"

DO $$
BEGIN
    -- 1. Agregar columna 'severity' (Crítica para el error actual)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_operation_events' AND column_name = 'severity') THEN
        ALTER TABLE public.admin_operation_events ADD COLUMN severity TEXT DEFAULT 'info';
    END IF;

    -- 2. Agregar columna 'details' (Usada por activity-logger)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_operation_events' AND column_name = 'details') THEN
        ALTER TABLE public.admin_operation_events ADD COLUMN details JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- 3. Agregar columna 'status' (Usada por events.ts)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_operation_events' AND column_name = 'status') THEN
        ALTER TABLE public.admin_operation_events ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;

    -- 4. Agregar columna 'metadata' (Usada por events.ts)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_operation_events' AND column_name = 'metadata') THEN
        ALTER TABLE public.admin_operation_events ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- 5. Agregar columna 'notified_admin' (Usada por notificaciones)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_operation_events' AND column_name = 'notified_admin') THEN
        ALTER TABLE public.admin_operation_events ADD COLUMN notified_admin BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- 6. Agregar columna 'is_read' (Para UI de notificaciones)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_operation_events' AND column_name = 'is_read') THEN
        ALTER TABLE public.admin_operation_events ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;

    -- 7. Agregar columna 'processed_at'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_operation_events' AND column_name = 'processed_at') THEN
        ALTER TABLE public.admin_operation_events ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Crear índices faltantes para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_admin_events_severity ON public.admin_operation_events(severity);
CREATE INDEX IF NOT EXISTS idx_admin_events_created_at ON public.admin_operation_events(created_at DESC);
