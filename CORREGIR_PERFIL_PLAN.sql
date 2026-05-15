-- CORRECCIÓN DEL ERROR DE SINTAXIS
-- El error ocurría porque faltaba 'ALTER TABLE public.profiles' antes de 'ADD COLUMN'

-- 1. Agregar la columna 'plan_type' correctamente
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'basic';

-- 2. Eliminar la restricción anterior si existe (para evitar duplicados o conflictos)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_plan_type_check;

-- 3. Agregar la restricción para asegurar que solo sea 'basic' o 'pro'
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_plan_type_check
CHECK (plan_type IN ('basic', 'pro'));
