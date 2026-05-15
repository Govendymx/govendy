-- Agregar columna para guardar el nombre del admin que autorizó el pago
-- Ejecuta este script en Supabase SQL Editor si la columna no existe

-- Verificar si la columna existe antes de agregarla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'checkout_sessions' 
        AND column_name = 'paid_confirmed_by_name'
    ) THEN
        ALTER TABLE checkout_sessions 
        ADD COLUMN paid_confirmed_by_name TEXT;
        
        COMMENT ON COLUMN checkout_sessions.paid_confirmed_by_name IS 'Nombre del administrador que autorizó el pago';
    END IF;
END $$;
