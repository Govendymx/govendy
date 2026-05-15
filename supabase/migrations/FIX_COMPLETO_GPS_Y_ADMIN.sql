-- ========================================
-- FIX COMPLETO: GPS + ADMIN ACCESS
-- ========================================
-- Este script corrige TODOS los problemas:
-- 1. Permite a usuarios insertar ubicaciones GPS
-- 2. Te agrega como administrador si no lo eres
-- ========================================

-- PARTE 1: Políticas RLS para GPS
-- ----------------------------------------

-- Drop existing restrictive policies if exist
DROP POLICY IF EXISTS "Users can insert own IPs" ON public.user_ips;
DROP POLICY IF EXISTS "Users can view own IPs" ON public.user_ips;
DROP POLICY IF EXISTS "Users can update own recent IPs" ON public.user_ips;

-- Create policy for users to insert their own IP records
CREATE POLICY "Users can insert own IPs" ON public.user_ips
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own records
CREATE POLICY "Users can view own IPs" ON public.user_ips
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to update their own recent records (for GPS updates)
CREATE POLICY "Users can update own recent IPs" ON public.user_ips
    FOR UPDATE
    USING (
        auth.uid() = user_id 
        AND detected_at > NOW() - INTERVAL '1 hour'
    )
    WITH CHECK (auth.uid() = user_id);

-- PARTE 2: AGREGAR USUARIO COMO ADMIN
-- ----------------------------------------
-- IMPORTANTE: Esto agregará al usuario actual como admin
-- Si ya existe, no hará nada (ON CONFLICT DO NOTHING)

-- Primero vemos si hay algún usuario logueado en profiles
-- Si existe, lo agregamos como admin
INSERT INTO public.admin_users (user_id, created_at, updated_at)
SELECT 
    id, 
    NOW(), 
    NOW()
FROM public.profiles
WHERE email IS NOT NULL
  AND id NOT IN (SELECT user_id FROM public.admin_users)
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (user_id) DO NOTHING;

-- Verificación: Mostrar todos los admins actuales
SELECT 
    au.user_id,
    p.full_name,
    p.email,
    au.created_at as admin_since
FROM public.admin_users au
LEFT JOIN public.profiles p ON au.user_id = p.id
ORDER BY au.created_at DESC;
