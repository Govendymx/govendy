-- ============================================================
-- SCRIPT DE VERIFICACIÓN Y PREPARACIÓN
-- Ejecuta esto ANTES de las funciones atómicas
-- Asegura que todas las columnas necesarias existan
-- ============================================================

-- 1. Verificar y agregar columnas de guía de devolución en disputes (si no existen)
DO $$
BEGIN
  -- return_guide_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'return_guide_url'
  ) THEN
    ALTER TABLE public.disputes ADD COLUMN return_guide_url TEXT NULL;
    COMMENT ON COLUMN public.disputes.return_guide_url IS 'URL de la guía de devolución (upload)';
  END IF;
  
  -- return_tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'return_tracking'
  ) THEN
    ALTER TABLE public.disputes ADD COLUMN return_tracking TEXT NULL;
    COMMENT ON COLUMN public.disputes.return_tracking IS 'Número de rastreo de la guía';
  END IF;
  
  -- return_guide_cost
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'return_guide_cost'
  ) THEN
    ALTER TABLE public.disputes ADD COLUMN return_guide_cost NUMERIC DEFAULT NULL;
    COMMENT ON COLUMN public.disputes.return_guide_cost IS 'Costo de la guía (MXN). Se descuenta a comprador o vendedor según return_guide_charged_to.';
  END IF;
  
  -- return_guide_charged_to
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'disputes' 
    AND column_name = 'return_guide_charged_to'
  ) THEN
    ALTER TABLE public.disputes ADD COLUMN return_guide_charged_to TEXT NULL;
    COMMENT ON COLUMN public.disputes.return_guide_charged_to IS 'Guía con cargo a: buyer | seller';
  END IF;
END $$;

-- 2. Verificar y agregar columna paid_at en orders (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN paid_at TIMESTAMPTZ NULL;
    COMMENT ON COLUMN public.orders.paid_at IS 'Fecha y hora en que se confirmó el pago (para pagos offline)';
  END IF;
END $$;

-- 3. Verificar que checkout_sessions tiene las columnas necesarias
DO $$
BEGIN
  -- paid_confirmed_by_name (puede no existir)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'checkout_sessions' 
    AND column_name = 'paid_confirmed_by_name'
  ) THEN
    ALTER TABLE public.checkout_sessions ADD COLUMN paid_confirmed_by_name TEXT NULL;
    COMMENT ON COLUMN public.checkout_sessions.paid_confirmed_by_name IS 'Nombre del admin que confirmó el pago';
  END IF;
END $$;

-- 4. Verificar que las funciones helper existen
DO $$
BEGIN
  -- Función is_admin (si no existe)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.is_admin(user_id_param UUID)
    RETURNS BOOLEAN AS $$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE admin_users.user_id = user_id_param
      );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

-- 5. Mostrar resumen de verificación
SELECT 
  'VERIFICACIÓN COMPLETA' as estado,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'disputes' AND column_name IN ('return_guide_url', 'return_tracking', 'return_guide_cost', 'return_guide_charged_to')) as columnas_disputes,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'paid_at') as columna_paid_at,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'checkout_sessions' AND column_name = 'paid_confirmed_by_name') as columna_admin_name,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) as funcion_is_admin;
