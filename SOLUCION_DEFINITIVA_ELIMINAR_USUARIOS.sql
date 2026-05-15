-- ============================================================
-- SOLUCIÓN DEFINITIVA: Eliminar Usuarios Permanentemente
-- ============================================================
-- Este script modifica el trigger para que NO recree perfiles
-- de usuarios que han sido eliminados
-- ============================================================

-- ============================================================
-- PARTE 1: Modificar función handle_new_user para prevenir
-- recreación de perfiles eliminados
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si el usuario está marcado como eliminado en user_admin_states
  -- Si está eliminado, NO crear el perfil
  IF EXISTS (
    SELECT 1 FROM public.user_admin_states 
    WHERE user_id = NEW.id 
    AND status = 'deleted'
  ) THEN
    -- Usuario fue eliminado, no recrear perfil
    RAISE NOTICE 'Usuario % está marcado como eliminado, no se creará perfil', NEW.id;
    RETURN NEW;
  END IF;

  -- Verificar si ya existe un perfil (por si acaso)
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.id
  ) THEN
    -- Ya existe perfil, no crear duplicado
    RAISE NOTICE 'Perfil ya existe para usuario %, no se creará duplicado', NEW.id;
    RETURN NEW;
  END IF;

  -- Crear perfil solo si no está eliminado y no existe
  INSERT INTO public.profiles (id, full_name, address_street, ext_number, int_number, neighborhood, zip_code, state, city, "references", cross_streets, phone, ine_front_url, ine_back_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Usuario'),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  );
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Si hay error (ej: perfil ya existe), no fallar
  RAISE WARNING 'Error al crear perfil para usuario %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PARTE 2: Crear función para eliminar usuario completamente
-- (para uso desde SQL si es necesario)
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user_completely(user_id_to_delete UUID)
RETURNS JSONB AS $$
DECLARE
  deleted_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Verificar que el usuario existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_id_to_delete) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Usuario no encontrado en auth.users'
    );
  END IF;

  -- Eliminar datos relacionados
  DELETE FROM public.favorites WHERE user_id = user_id_to_delete;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  DELETE FROM public.user_coupons WHERE user_id = user_id_to_delete;
  DELETE FROM public.listing_questions WHERE asked_by = user_id_to_delete OR answered_by = user_id_to_delete;
  DELETE FROM public.notifications WHERE user_id = user_id_to_delete;
  DELETE FROM public.cart_items WHERE user_id = user_id_to_delete;
  DELETE FROM public.listings WHERE seller_id = user_id_to_delete;
  DELETE FROM public.user_admin_states WHERE user_id = user_id_to_delete;
  DELETE FROM public.profiles WHERE id = user_id_to_delete;

  -- Marcar como eliminado antes de eliminar de auth.users
  INSERT INTO public.user_admin_states (user_id, status, notes, updated_at)
  VALUES (
    user_id_to_delete,
    'deleted',
    'Eliminado completamente por función SQL',
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'deleted',
    notes = 'Eliminado completamente por función SQL',
    updated_at = NOW();

  -- NOTA: No podemos eliminar de auth.users desde aquí porque requiere
  -- permisos de administrador de Supabase. Esto debe hacerse desde la API.

  result := jsonb_build_object(
    'ok', true,
    'message', 'Datos del usuario eliminados. Eliminar de auth.users desde la API.',
    'user_id', user_id_to_delete
  );

  RETURN result;
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM,
    'user_id', user_id_to_delete
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PARTE 3: Crear función para verificar si un usuario está eliminado
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_user_deleted(user_id_to_check UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_admin_states 
    WHERE user_id = user_id_to_check 
    AND status = 'deleted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================

SELECT 
  '✅ Trigger modificado' as estado,
  proname as funcion,
  prosrc as codigo
FROM pg_proc
WHERE proname = 'handle_new_user';

-- ============================================================
-- NOTAS IMPORTANTES
-- ============================================================
-- 1. El trigger ahora verifica si el usuario está marcado como
--    'deleted' en user_admin_states antes de crear el perfil
-- 
-- 2. Para eliminar un usuario completamente desde la app:
--    - Usar /api/admin/users/delete-account (elimina de profiles + auth.users)
--    - O usar lib/admin/userManagement.executeUserAction('delete')
--
-- 3. Si necesitas eliminar desde SQL (solo datos, no auth.users):
--    SELECT public.delete_user_completely('user-id-here');
--
-- 4. Para verificar si un usuario está eliminado:
--    SELECT public.is_user_deleted('user-id-here');
-- ============================================================
