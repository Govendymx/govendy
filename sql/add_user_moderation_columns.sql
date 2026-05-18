-- sql/add_user_moderation_columns.sql

-- Añadir banderas de moderación a la tabla profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_publish BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_buy BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_until TIMESTAMP WITH TIME ZONE;

-- Refrescar la caché de PostgREST
NOTIFY pgrst, 'reload schema';
