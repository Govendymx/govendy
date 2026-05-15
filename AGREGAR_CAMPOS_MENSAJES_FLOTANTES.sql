-- Agregar campos para usuarios específicos y URL de redirección a mensajes flotantes

-- Agregar columna para usuarios específicos (array de UUIDs)
-- Si es NULL o vacío, el mensaje se muestra a todos los usuarios
ALTER TABLE public.admin_floating_messages
  ADD COLUMN IF NOT EXISTS target_user_ids UUID[] DEFAULT NULL;

-- Agregar columna para URL de redirección
-- Si tiene valor, el mensaje será clickeable y redirigirá a esta URL
ALTER TABLE public.admin_floating_messages
  ADD COLUMN IF NOT EXISTS redirect_url TEXT DEFAULT NULL;

-- Índice para búsquedas por usuarios específicos
CREATE INDEX IF NOT EXISTS admin_floating_messages_target_users_idx 
  ON public.admin_floating_messages USING GIN (target_user_ids);
