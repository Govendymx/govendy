-- 1. Añadir columna email a profiles si no existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Crear función para sincronizar email automáticamente cuando cambie en Auth
CREATE OR REPLACE FUNCTION public.handle_user_email_sync() 
RETURNS TRIGGER AS $$
BEGIN
  -- Si el registro en profiles no existe, no hacemos nada (el trigger de creación se encarga)
  -- Solo actualizamos si existe
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para escuchar cambios en auth.users
DROP TRIGGER IF EXISTS on_auth_user_email_update ON auth.users;
CREATE TRIGGER on_auth_user_email_update
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_sync();

-- 4. BACKFILL: Rellenar los emails vacíos en profiles usando auth.users
-- IMPORTANTE: Esto debe ejecutarse con privilegios de superusuario o postgres
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
