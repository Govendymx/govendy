-- Script para agregar la columna has_seen_onboarding_tour a la tabla profiles
-- Ejecuta esto en Supabase SQL Editor

-- Agregar columna si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'has_seen_onboarding_tour'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN has_seen_onboarding_tour BOOLEAN DEFAULT false;
    
    -- Crear índice para mejorar consultas
    CREATE INDEX IF NOT EXISTS idx_profiles_has_seen_onboarding_tour 
    ON public.profiles(has_seen_onboarding_tour) 
    WHERE has_seen_onboarding_tour = false;
    
    RAISE NOTICE 'Columna has_seen_onboarding_tour agregada exitosamente';
  ELSE
    RAISE NOTICE 'La columna has_seen_onboarding_tour ya existe';
  END IF;
END $$;

-- Verificar que se creó correctamente
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'has_seen_onboarding_tour';
