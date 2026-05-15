-- ============================================================
-- CREAR NOTIFICACIÓN DE PRUEBA
-- ============================================================
-- Este script crea una notificación de prueba para verificar
-- que el sistema de notificaciones funciona correctamente
-- ============================================================

-- PASO 1: Obtener tu user_id
-- ============================================================
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'TU_EMAIL_AQUI@ejemplo.com'
LIMIT 1;

-- PASO 2: Crear notificación de prueba (reemplaza TU_USER_ID con el ID del paso 1)
-- ============================================================
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  body,
  data,
  is_read
) VALUES (
  'TU_USER_ID'::uuid,  -- Reemplaza con tu user_id del paso 1
  'listing_question',
  '💬 Nueva pregunta en tu publicación',
  '"Producto de prueba": Esta es una notificación de prueba para verificar que el sistema funciona.',
  jsonb_build_object(
    'kind', 'listing_question',
    'listingId', '00000000-0000-0000-0000-000000000000',
    'questionId', '00000000-0000-0000-0000-000000000000',
    'questionPreview', 'Esta es una notificación de prueba',
    'href', '/dashboard/preguntas',
    'link', '/dashboard/preguntas'
  ),
  false
);

-- PASO 3: Verificar que se creó
-- ============================================================
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  is_read,
  created_at
FROM public.notifications
WHERE user_id = 'TU_USER_ID'::uuid  -- Reemplaza con tu user_id
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- INSTRUCCIONES:
-- ============================================================
-- 1. Ejecuta el PASO 1 y copia tu user_id
-- 2. Reemplaza 'TU_USER_ID' en el PASO 2 con tu user_id
-- 3. Ejecuta el PASO 2 para crear la notificación
-- 4. Ejecuta el PASO 3 para verificar que se creó
-- 5. Recarga el dashboard y deberías ver la notificación
-- ============================================================
