-- Add plan columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'basic';

-- Add check constraint to ensure valid plan types
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_plan_type_check;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_plan_type_check 
CHECK (plan_type IN ('basic', 'pro'));

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_profiles_plan_type ON public.profiles(plan_type);

-- Plan Definitions (Reference):
-- basic: 
--   - Precio: Gratis
--   - Publicaciones: 50
--   - Comisión: 20%
--   - Subastas: 15
--   - Destacados: 3
--   - Cupones: 25
--   - Retiros: Semanales

-- pro: 
--   - Precio: $699.00/mes
--   - Publicaciones: ILIMITADAS
--   - Comisión: 15%
--   - Subastas: ILIMITADAS
--   - Destacados: 15
--   - Cupones: ILIMITADOS
--   - Retiros: 48 horas
--   - Extra: Entregas personales, Envíos propios
