-- ============================================================
-- Pocket App - TODOS LOS SCRIPTS SQL CONSOLIDADOS
-- ============================================================
-- Este archivo contiene todos los scripts SQL en el orden correcto
-- Generado automáticamente el 21/1/2026, 8:45:58 p.m.
-- 
-- INSTRUCCIONES:
-- 1. Abre el SQL Editor en tu proyecto de Supabase
-- 2. Copia y pega TODO este contenido
-- 3. Haz clic en "Run" o presiona Ctrl+Enter
-- 4. Espera a que termine la ejecución
-- 
-- NOTA: La mayoría de scripts son idempotentes (puedes ejecutarlos
-- múltiples veces sin problemas gracias a IF NOT EXISTS).
-- ============================================================


-- ============================================================
-- Script 1/40: supabase_profiles_table.sql
-- ============================================================

-- Crear tabla profiles en Supabase
-- Ejecuta este SQL en el SQL Editor de Supabase

-- Crear la tabla profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  address_street TEXT NOT NULL,
  ext_number TEXT NOT NULL,
  int_number TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  "references" TEXT NOT NULL,
  cross_streets TEXT NOT NULL,
  phone TEXT NOT NULL,
  ine_front_url TEXT NOT NULL,
  ine_back_url TEXT NOT NULL,
  reputation_score INTEGER DEFAULT 100 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo puedan leer su propio perfil
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
CREATE POLICY "Users can read their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Política para que los usuarios solo puedan insertar su propio perfil
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Política para que los usuarios solo puedan actualizar su propio perfil
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política para que los usuarios solo puedan eliminar su propio perfil
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
CREATE POLICY "Users can delete their own profile"
  ON profiles
  FOR DELETE
  USING (auth.uid() = id);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Crear función para crear automáticamente un perfil cuando se crea un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
    '',
    ''
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para ejecutar la función cuando se crea un nuevo usuario
-- Eliminar el trigger si ya existe para hacer el script idempotente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();



-- ============================================================
-- Script 2/40: supabase_admin_and_settings.sql
-- ============================================================

-- Pocket App - Admin + Settings (MercadoPago / Transferencia / Depósito / OXXO)
-- Ejecuta este SQL en el SQL Editor de Supabase.
-- Nota: Ajusta permisos/roles según tu caso. Este esquema está pensado para:
-- - Usuarios autenticados: pueden LEER configuración para checkout
-- - Admins: pueden EDITAR configuración

-- 1) Tabla de admins
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Solo el propio admin puede verse (y los admins gestionan esta tabla desde SQL o con service role)
DROP POLICY IF EXISTS "Admin can read own admin row" ON public.admin_users;
CREATE POLICY "Admin can read own admin row"
  ON public.admin_users
  FOR SELECT
  USING (auth.uid() = user_id);

-- IMPORTANTE:
-- Para evitar que cualquiera se vuelva admin, NO damos políticas de INSERT/UPDATE/DELETE desde el cliente.
-- Agrega admins manualmente desde Supabase SQL:
-- INSERT INTO public.admin_users (user_id) VALUES ('<uuid>');


-- 2) Tabla de configuración global (single-row)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_rate NUMERIC NOT NULL DEFAULT 0.05,          -- 5% por defecto
  cancel_penalty_rate NUMERIC NOT NULL DEFAULT 0.03,      -- 3% por cancelación
  featured_price NUMERIC NOT NULL DEFAULT 25.00,          -- $25 por destacados
  shipping_base NUMERIC NOT NULL DEFAULT 180.00,          -- $180 base
  shipping_extended NUMERIC NOT NULL DEFAULT 200.00,      -- +$200 zona extendida
  payment_methods JSONB NOT NULL DEFAULT jsonb_build_object(
    'mercadopago', jsonb_build_object('enabled', true),
    'bank_transfer', jsonb_build_object(
      'enabled', true,
      'bank_name', '',
      'account_holder', '',
      'clabe', '',
      'instructions', ''
    ),
    'bank_deposit', jsonb_build_object(
      'enabled', true,
      'bank_name', '',
      'account_holder', '',
      'account_number', '',
      'instructions', ''
    ),
    'oxxo', jsonb_build_object(
      'enabled', true,
      'instructions', ''
    )
  ),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Asegurar single-row
INSERT INTO public.app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Helper: ¿es admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

-- Lectura: cualquier usuario autenticado puede leer settings (necesario para checkout)
DROP POLICY IF EXISTS "Authenticated users can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Escritura: solo admins
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
CREATE POLICY "Admins can update app settings"
  ON public.app_settings
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());




-- ============================================================
-- Script 3/40: supabase_admin_user_states.sql
-- ============================================================

-- Pocket App - Estados de usuario (Admin) (idempotente)
-- Permite suspender/bloquear usuarios y guardar notas administrativas.

CREATE TABLE IF NOT EXISTS public.user_admin_states (
  user_id UUID PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | banned
  suspended_until TIMESTAMP WITH TIME ZONE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_by UUID
);

ALTER TABLE public.user_admin_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own admin state" ON public.user_admin_states;
DROP POLICY IF EXISTS "Admins can read all admin states" ON public.user_admin_states;
DROP POLICY IF EXISTS "Admins can upsert admin states" ON public.user_admin_states;

-- Usuario: puede ver su estado (para mostrar avisos en la app)
CREATE POLICY "Users can read own admin state"
  ON public.user_admin_states
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin: puede leer todo
CREATE POLICY "Admins can read all admin states"
  ON public.user_admin_states
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Admin: puede crear/actualizar estados
CREATE POLICY "Admins can upsert admin states"
  ON public.user_admin_states
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update admin states" ON public.user_admin_states;
CREATE POLICY "Admins can update admin states"
  ON public.user_admin_states
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));




-- ============================================================
-- Script 4/40: supabase_listings.sql
-- ============================================================

-- Pocket App - Listings (publicaciones) para marketplace
-- Ejecuta este SQL en el SQL Editor de Supabase.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    CREATE TYPE public.listing_status AS ENUM ('draft', 'active', 'sold', 'paused', 'blocked');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',

  -- MVP: imágenes en array (min 2, max 56 en UI; la DB no impone el max)
  images TEXT[] NOT NULL DEFAULT '{}'::text[],

  status public.listing_status NOT NULL DEFAULT 'draft',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS listings_seller_id_idx ON public.listings (seller_id);
CREATE INDEX IF NOT EXISTS listings_status_idx ON public.listings (status);
CREATE INDEX IF NOT EXISTS listings_created_at_idx ON public.listings (created_at DESC);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Lectura pública: solo publicaciones activas
DROP POLICY IF EXISTS "Public can read active listings" ON public.listings;
CREATE POLICY "Public can read active listings"
  ON public.listings
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR seller_id = auth.uid());

-- Insert: el vendedor crea sus propias publicaciones
DROP POLICY IF EXISTS "Sellers can create their listings" ON public.listings;
CREATE POLICY "Sellers can create their listings"
  ON public.listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

-- Update/Delete: solo el vendedor
DROP POLICY IF EXISTS "Sellers can update their listings" ON public.listings;
CREATE POLICY "Sellers can update their listings"
  ON public.listings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can delete their listings" ON public.listings;
CREATE POLICY "Sellers can delete their listings"
  ON public.listings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_listings_updated_at ON public.listings;
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();




-- ============================================================
-- Script 5/40: supabase_cart_and_orders.sql
-- ============================================================

-- Pocket App - Carrito + Órdenes (compras con carrito)
-- Ejecuta este SQL en el SQL Editor de Supabase.

-- Carrito: items por usuario (simple y eficiente)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL, -- referencia a tu tabla public.listings (PK UUID)
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (user_id, listing_id)
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own cart items" ON public.cart_items;
CREATE POLICY "Users can read their own cart items"
  ON public.cart_items
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own cart items" ON public.cart_items;
CREATE POLICY "Users can insert their own cart items"
  ON public.cart_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cart items" ON public.cart_items;
CREATE POLICY "Users can update their own cart items"
  ON public.cart_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own cart items" ON public.cart_items;
CREATE POLICY "Users can delete their own cart items"
  ON public.cart_items
  FOR DELETE
  USING (auth.uid() = user_id);


-- Órdenes: para soportar multi-vendedor, creamos una orden por vendedor al hacer checkout.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('pending_payment', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded', 'disputed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('mercadopago', 'bank_transfer', 'bank_deposit', 'oxxo');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'pending_payment',
  payment_method public.payment_method NOT NULL DEFAULT 'mercadopago',

  subtotal NUMERIC NOT NULL DEFAULT 0,
  shipping_fee NUMERIC NOT NULL DEFAULT 0,
  commission_fee NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,

  -- Snapshot de dirección para envío (se toma de profiles al momento de comprar)
  shipping_full_name TEXT NOT NULL DEFAULT '',
  shipping_phone TEXT NOT NULL DEFAULT '',
  shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Órdenes: comprador o vendedor pueden leer
DROP POLICY IF EXISTS "Buyer or seller can read their orders" ON public.orders;
CREATE POLICY "Buyer or seller can read their orders"
  ON public.orders
  FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Órdenes: comprador crea (checkout) con seller_id válido
DROP POLICY IF EXISTS "Buyer can insert their orders" ON public.orders;
CREATE POLICY "Buyer can insert their orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Órdenes: comprador y vendedor pueden actualizar ciertos estados (a futuro se recomienda RPC)
DROP POLICY IF EXISTS "Buyer or seller can update their orders" ON public.orders;
CREATE POLICY "Buyer or seller can update their orders"
  ON public.orders
  FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Items: se leen si pertenecen a una orden del usuario (buyer o seller)
DROP POLICY IF EXISTS "Buyer or seller can read their order items" ON public.order_items;
CREATE POLICY "Buyer or seller can read their order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Items: solo el comprador inserta items para sus órdenes
DROP POLICY IF EXISTS "Buyer can insert order items for their orders" ON public.order_items;
CREATE POLICY "Buyer can insert order items for their orders"
  ON public.order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.buyer_id = auth.uid()
    )
  );




-- ============================================================
-- Script 6/40: supabase_payments.sql
-- ============================================================

-- Pocket App - Pagos (MercadoPago / offline) y sesiones de checkout
-- Ejecuta este SQL en Supabase SQL Editor.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkout_status') THEN
    CREATE TYPE public.checkout_status AS ENUM ('created', 'pending', 'paid', 'failed', 'cancelled');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  payment_method TEXT NOT NULL DEFAULT 'mercadopago',
  status public.checkout_status NOT NULL DEFAULT 'created',

  amount NUMERIC NOT NULL DEFAULT 0,

  -- MercadoPago
  mp_preference_id TEXT NULL,
  mp_payment_id TEXT NULL,
  mp_status TEXT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable: borrar políticas si ya existen
DROP POLICY IF EXISTS "Buyer can read own checkout sessions" ON public.checkout_sessions;
DROP POLICY IF EXISTS "Buyer can insert own checkout sessions" ON public.checkout_sessions;
DROP POLICY IF EXISTS "Buyer can update own checkout sessions" ON public.checkout_sessions;

CREATE POLICY "Buyer can read own checkout sessions"
  ON public.checkout_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

CREATE POLICY "Buyer can insert own checkout sessions"
  ON public.checkout_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- Updates normalmente se hacen desde webhook (service role), pero permitimos al buyer actualizar campos no críticos si lo necesitas luego.
CREATE POLICY "Buyer can update own checkout sessions"
  ON public.checkout_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = buyer_id)
  WITH CHECK (auth.uid() = buyer_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_checkout_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_checkout_sessions_updated_at ON public.checkout_sessions;
CREATE TRIGGER update_checkout_sessions_updated_at
  BEFORE UPDATE ON public.checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_checkout_updated_at();




-- ============================================================
-- Script 7/40: supabase_profiles_ine_migration.sql
-- ============================================================

-- Pocket - Migración: columnas INE en profiles (idempotente)
-- Ejecuta esto en el SQL Editor de Supabase.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ine_front_url TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ine_back_url TEXT;

-- (Opcional) si quieres timestamps al actualizar
-- ALTER TABLE public.profiles
--   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;




-- ============================================================
-- Script 8/40: supabase_profiles_address_migration.sql
-- ============================================================

-- Pocket - Migración: columnas de dirección/verificación en profiles (idempotente)
-- Ejecuta esto en el SQL Editor de Supabase.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ext_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS int_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "references" TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cross_streets TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;




-- ============================================================
-- Script 9/40: supabase_profiles_reputation.sql
-- ============================================================

-- Pocket - Reputación de vendedores (idempotente)
-- Ejecuta esto en Supabase → SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 100;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating_good_count INTEGER DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating_total_count INTEGER DEFAULT 0;

-- Nota:
-- - rating_good_count / rating_total_count sirven para calcular porcentaje.
-- - reputation_score sirve como fallback (0..100) si aún no tienes calificaciones registradas.




-- ============================================================
-- Script 10/40: supabase_listings_public_id.sql
-- ============================================================

-- Pocket - ID público para publicaciones (legible para buscar/soporte)
-- Ejecuta en Supabase → SQL Editor. (idempotente)

-- ID público derivado del UUID para que sea estable y sin lógica extra en el server.
-- Ejemplo: PCK-1A2B3C4D5E
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS public_id TEXT
  GENERATED ALWAYS AS ('PCK-' || upper(substr(replace(id::text, '-', ''), 1, 10))) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS listings_public_id_ux ON public.listings (public_id);




-- ============================================================
-- Script 11/40: supabase_listings_soft_delete.sql
-- ============================================================

-- Pocket - Borrado lógico (archivo) de publicaciones (idempotente)
-- Ejecuta en Supabase → SQL Editor.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS listings_is_deleted_idx ON public.listings (is_deleted, created_at DESC);




-- ============================================================
-- Script 12/40: supabase_listings_lifecycle.sql
-- ============================================================

-- Pocket - Lifecycle de publicaciones (vistas + vigencia 30 días) (idempotente)
-- Ejecuta en Supabase → SQL Editor.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

-- Backfill para registros existentes
UPDATE public.listings
SET expires_at = created_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- Si quieres que nuevas publicaciones tengan vigencia automática:
ALTER TABLE public.listings
  ALTER COLUMN expires_at SET DEFAULT (TIMEZONE('utc'::text, NOW()) + INTERVAL '30 days');

CREATE OR REPLACE FUNCTION public.refresh_listing_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    IF OLD.status IS DISTINCT FROM 'active' OR NEW.expires_at IS NULL OR NEW.expires_at <= NOW() THEN
      NEW.expires_at = TIMEZONE('utc'::text, NOW()) + INTERVAL '30 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_listing_expires_at ON public.listings;
CREATE TRIGGER refresh_listing_expires_at
  BEFORE UPDATE OF status, expires_at ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_listing_expires_at();




-- ============================================================
-- Script 13/40: supabase_listings_rls_fix.sql
-- ============================================================

-- Pocket - Fix RLS de listings (re-ejecutable)
-- Ejecuta esto en Supabase → SQL Editor.

-- Asegurar RLS activo
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Borrar TODAS las policies actuales en listings (para evitar mezclas viejas)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'listings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.listings', pol.policyname);
  END LOOP;
END$$;

-- Recrear policies estándar (seller_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='listings' AND column_name='seller_id'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Public can read active listings"
        ON public.listings
        FOR SELECT
        TO anon, authenticated
        USING (status = 'active' OR seller_id = auth.uid());

      CREATE POLICY "Sellers can create their listings"
        ON public.listings
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = seller_id);

      CREATE POLICY "Sellers can update their listings"
        ON public.listings
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = seller_id)
        WITH CHECK (auth.uid() = seller_id);

      CREATE POLICY "Sellers can delete their listings"
        ON public.listings
        FOR DELETE
        TO authenticated
        USING (auth.uid() = seller_id);
    $pol$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='listings' AND column_name='user_id'
  ) THEN
    -- Compatibilidad si tu tabla usa user_id en vez de seller_id
    EXECUTE $pol$
      CREATE POLICY "Public can read active listings"
        ON public.listings
        FOR SELECT
        TO anon, authenticated
        USING (status = 'active' OR user_id = auth.uid());

      CREATE POLICY "Sellers can create their listings"
        ON public.listings
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);

      CREATE POLICY "Sellers can update their listings"
        ON public.listings
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

      CREATE POLICY "Sellers can delete their listings"
        ON public.listings
        FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id);
    $pol$;
  ELSE
    RAISE EXCEPTION 'No se encontró seller_id ni user_id en public.listings. Revisa el esquema.';
  END IF;
END$$;




-- ============================================================
-- Script 14/40: supabase_orders_logistics.sql
-- ============================================================

-- Pocket App - Logística de órdenes (idempotente)
-- Agrega columnas para guía PDF, rastreo y eventos de envío.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_label_url TEXT;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_label_uploaded_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_label_uploaded_by UUID;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS label_downloaded_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS tracking_number TEXT;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_carrier TEXT;

    CREATE INDEX IF NOT EXISTS orders_seller_status_created_idx
      ON public.orders (seller_id, status, created_at DESC);
  END IF;
END$$;




-- ============================================================
-- Script 15/40: supabase_orders_paid_to_seller.sql
-- ============================================================

-- Pocket - Agregar columna para marcar cuando se pagó al vendedor (idempotente)
-- Ejecuta esto en Supabase → SQL Editor.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_to_seller_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_to_seller_by UUID;

-- Índice para filtrar rápido "qué ya se pagó"
CREATE INDEX IF NOT EXISTS orders_paid_to_seller_at_idx
  ON public.orders (paid_to_seller_at DESC)
  WHERE paid_to_seller_at IS NOT NULL;



-- ============================================================
-- Script 16/40: supabase_shipping_features.sql
-- ============================================================

-- Pocket App - Envío gratis + conteo de compartidos + subsidio de envío en órdenes
-- Ejecuta este SQL en Supabase (SQL Editor). Es idempotente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'listings'
  ) THEN
    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS free_shipping boolean NOT NULL DEFAULT false;

    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS listings_free_shipping_true_idx
      ON public.listings (free_shipping)
      WHERE free_shipping = true;

    CREATE INDEX IF NOT EXISTS listings_share_count_idx
      ON public.listings (share_count DESC);
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS shipping_subsidy numeric NOT NULL DEFAULT 0;
  END IF;
END$$;




-- ============================================================
-- Script 17/40: supabase_order_chat.sql
-- ============================================================

-- Pocket App - Chat comprador ↔ vendedor por operación (order)
-- Ejecuta este SQL en Supabase (SQL Editor). Es idempotente.

CREATE TABLE IF NOT EXISTS public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS order_messages_order_created_idx
  ON public.order_messages (order_id, created_at DESC);

ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable
DROP POLICY IF EXISTS "Participants can read order messages" ON public.order_messages;
DROP POLICY IF EXISTS "Participants can send order messages" ON public.order_messages;

-- Leer: solo buyer/seller de esa orden
CREATE POLICY "Participants can read order messages"
  ON public.order_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Insert: solo buyer/seller y el sender_id debe ser el mismo usuario
CREATE POLICY "Participants can send order messages"
  ON public.order_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );




-- ============================================================
-- Script 18/40: supabase_order_chat_reads.sql
-- ============================================================

-- Pocket App - Lecturas de chat por orden (para "pendiente de contestar") (idempotente)
-- Ejecuta este SQL en Supabase (SQL Editor).

CREATE TABLE IF NOT EXISTS public.order_chat_reads (
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (order_id, user_id)
);

CREATE INDEX IF NOT EXISTS order_chat_reads_user_idx
  ON public.order_chat_reads (user_id, last_read_at DESC);

ALTER TABLE public.order_chat_reads ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable
DROP POLICY IF EXISTS "Users can read own order chat reads" ON public.order_chat_reads;
DROP POLICY IF EXISTS "Users can upsert own order chat reads" ON public.order_chat_reads;
DROP POLICY IF EXISTS "Admins can read all order chat reads" ON public.order_chat_reads;

-- Leer: solo buyer/seller de esa orden (y el registro del propio usuario)
CREATE POLICY "Users can read own order chat reads"
  ON public.order_chat_reads
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Insert/Update: solo su propio registro y debe ser participante
CREATE POLICY "Users can upsert own order chat reads"
  ON public.order_chat_reads
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Admin: ver todo (para auditoría)
CREATE POLICY "Admins can read all order chat reads"
  ON public.order_chat_reads
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));




-- ============================================================
-- Script 19/40: supabase_order_chat_upgrade.sql
-- ============================================================

-- Pocket App - Upgrade chat de órdenes: adjuntos + roles + acceso admin (idempotente)
-- Ejecuta este SQL en Supabase (SQL Editor).

-- 1) Columnas nuevas (compatibles)
ALTER TABLE public.order_messages
  ADD COLUMN IF NOT EXISTS sender_role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.order_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) RLS (extender para admins)
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable
DROP POLICY IF EXISTS "Participants can read order messages" ON public.order_messages;
DROP POLICY IF EXISTS "Participants can send order messages" ON public.order_messages;
DROP POLICY IF EXISTS "Participants can read order messages (v2)" ON public.order_messages;
DROP POLICY IF EXISTS "Buyer/Seller can send order messages (v2)" ON public.order_messages;
DROP POLICY IF EXISTS "Admins can read all order messages (v2)" ON public.order_messages;
DROP POLICY IF EXISTS "Admins can send order messages (v2)" ON public.order_messages;

-- Lectura: buyer o seller de la orden
CREATE POLICY "Participants can read order messages (v2)"
  ON public.order_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Lectura: admins pueden leer todo
CREATE POLICY "Admins can read all order messages (v2)"
  ON public.order_messages
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Insert: buyer/seller (rol buyer/seller) y sender_id debe ser el mismo usuario
CREATE POLICY "Buyer/Seller can send order messages (v2)"
  ON public.order_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role IN ('buyer','seller')
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- Insert: admin (rol admin)
CREATE POLICY "Admins can send order messages (v2)"
  ON public.order_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'admin'
    AND EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );




-- ============================================================
-- Script 20/40: supabase_notifications.sql
-- ============================================================

-- Pocket App - Notifications (idempotente)
-- Crea la tabla `notifications` con columnas estándar y políticas RLS para lectura por usuario.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Si la tabla ya existía con otro esquema, asegurar columnas:
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data JSONB;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW());

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

-- Lectura: cada usuario ve solo sus notificaciones
CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Update: permitir marcar leídas (is_read) por el mismo usuario
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());




-- ============================================================
-- Script 21/40: supabase_notifications_enum_extend.sql
-- ============================================================

-- Pocket App - Extender ENUM notification_type (idempotente)
-- Úsalo SOLO si tu columna `public.notifications.type` es ENUM (error 22P02 invalid input value for enum notification_type).
-- Ejecuta este SQL en Supabase (SQL Editor).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type t WHERE t.typname = 'notification_type') THEN
    -- Tipos usados por Pocket App (puedes agregar más si quieres)
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'listing_question'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'listing_answer'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'new_sale'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'sale_paid'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_approved'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_rejected'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'order_completed'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_announcement'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'support_message'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'support_reply'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'bid_received'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'auction_ended'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'cart_reminder'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'shipped'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'rating_received'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dispute_opened'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'dispute_message'; EXCEPTION WHEN others THEN END;
    BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'test'; EXCEPTION WHEN others THEN END;
  END IF;
END $$;




-- ============================================================
-- Script 22/40: supabase_notifications_triggers.sql
-- ============================================================

-- Pocket App - Triggers para notificaciones (idempotente)
-- Ejecuta este SQL en Supabase (SQL Editor) DESPUÉS de:
-- - supabase_notifications.sql
-- - supabase_listing_questions.sql
--
-- Objetivo:
-- - Crear notificación automática cuando entra una pregunta (listing_questions INSERT)
-- - Crear notificación automática cuando entra una orden (orders INSERT)
-- - Crear notificación automática cuando una orden cambia a 'paid' (orders UPDATE status)

-- 1) Preguntas -> notificar vendedor
CREATE OR REPLACE FUNCTION public.notify_seller_on_new_question()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
BEGIN
  -- Evitar notificar si está marcada como borrada (por si insertan con is_deleted=true)
  IF NEW.is_deleted = true THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(l.title, 'Tu publicación') INTO listing_title
  FROM public.listings l
  WHERE l.id = NEW.listing_id;

  INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
  VALUES (
    NEW.seller_id,
    'listing_question',
    'Nueva pregunta en tu publicación',
    'Te preguntaron: ' || listing_title || '.',
    jsonb_build_object('kind','listing_question','listingId', NEW.listing_id, 'questionId', NEW.id),
    false
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca romper el flujo principal por notificaciones
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_seller_on_new_question ON public.listing_questions;
CREATE TRIGGER trg_notify_seller_on_new_question
AFTER INSERT ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_new_question();

-- 1b) Respuesta -> notificar comprador/interesado (asker)
CREATE OR REPLACE FUNCTION public.notify_asker_on_question_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title text;
BEGIN
  -- Solo cuando pasa de NULL -> NOT NULL
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.answer_text IS NULL) AND (NEW.answer_text IS NOT NULL) AND (NEW.is_deleted = false) THEN
      IF NEW.asker_id IS NULL THEN
        RETURN NEW;
      END IF;

      SELECT COALESCE(l.title, 'una publicación') INTO listing_title
      FROM public.listings l
      WHERE l.id = NEW.listing_id;

      -- Intento 1: tipo correcto
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
        VALUES (
          NEW.asker_id,
          'listing_answer',
          'El vendedor respondió tu pregunta',
          'Respondieron tu pregunta en: ' || listing_title || '.',
          jsonb_build_object('kind','listing_answer','listingId', NEW.listing_id, 'questionId', NEW.id),
          false
        );
      EXCEPTION WHEN others THEN
        -- Fallback (por ENUMs/variantes): usar un type existente, pero conservar el kind real
        BEGIN
          INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
          VALUES (
            NEW.asker_id,
            'listing_question',
            'El vendedor respondió tu pregunta',
            'Respondieron tu pregunta en: ' || listing_title || '.',
            jsonb_build_object('kind','listing_answer','listingId', NEW.listing_id, 'questionId', NEW.id),
            false
          );
        EXCEPTION WHEN others THEN
          -- Nunca romper flujo principal
          NULL;
        END;
      END;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_asker_on_question_answer ON public.listing_questions;
CREATE TRIGGER trg_notify_asker_on_question_answer
AFTER UPDATE OF answer_text ON public.listing_questions
FOR EACH ROW
EXECUTE FUNCTION public.notify_asker_on_question_answer();

-- 2) Órdenes -> notificar vendedor al crear (venta nueva)
CREATE OR REPLACE FUNCTION public.notify_seller_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
  VALUES (
    NEW.seller_id,
    'new_sale',
    'Tienes una venta',
    'Recibiste una compra. Orden: ' || left(NEW.id::text, 8) || '…',
    jsonb_build_object('kind','new_sale','orderId', NEW.id, 'status', COALESCE(NEW.status, 'pending')),
    false
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_seller_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_seller_on_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_new_order();

-- 3) Órdenes -> notificar vendedor cuando se paga (status -> paid)
CREATE OR REPLACE FUNCTION public.notify_seller_on_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) AND NEW.status = 'paid' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    VALUES (
      NEW.seller_id,
      'sale_paid',
      'Pago acreditado',
      'Se acreditó el pago de una compra. Orden: ' || left(NEW.id::text, 8) || '…',
      jsonb_build_object('kind','sale_paid','orderId', NEW.id, 'status', NEW.status),
      false
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_seller_on_order_paid ON public.orders;
CREATE TRIGGER trg_notify_seller_on_order_paid
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_on_order_paid();




-- ============================================================
-- Script 23/40: supabase_notifications_backfill.sql
-- ============================================================

-- Pocket App - Backfill de notificaciones (idempotente)
-- Útil cuando ya había preguntas/ventas antes de activar triggers.
--
-- Ejecuta en Supabase → SQL Editor.
-- Requisitos:
-- - Tabla public.notifications existe (supabase_notifications.sql)
-- - Tabla public.listing_questions existe (supabase_listing_questions.sql)
-- - Si `notifications.type` es ENUM, primero corre supabase_notifications_enum_extend.sql

-- 1) Backfill: preguntas sin responder → notificar al vendedor
INSERT INTO public.notifications (user_id, type, title, body, data, is_read, created_at)
SELECT
  q.seller_id AS user_id,
  'listing_question' AS type,
  'Nueva pregunta en tu publicación' AS title,
  'Tienes una pregunta sin responder.' AS body,
  jsonb_build_object(
    'kind', 'listing_question',
    'listingId', q.listing_id,
    'questionId', q.id
  ) AS data,
  false AS is_read,
  COALESCE(q.created_at, TIMEZONE('utc'::text, NOW())) AS created_at
FROM public.listing_questions q
WHERE
  q.is_deleted = false
  AND q.answer_text IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE
      n.user_id = q.seller_id
      AND COALESCE(n.data->>'questionId','') = q.id::text
  );

-- 2) Backfill: preguntas respondidas → notificar al comprador/interesado (asker)
-- Nota: si `notifications.type` es ENUM, asegúrate de incluir 'listing_answer' en el enum:
-- corre `supabase_notifications_enum_extend.sql` antes.
INSERT INTO public.notifications (user_id, type, title, body, data, is_read, created_at)
SELECT
  q.asker_id AS user_id,
  'listing_answer' AS type,
  'El vendedor respondió tu pregunta' AS title,
  'Respondieron tu pregunta en una publicación.' AS body,
  jsonb_build_object(
    'kind', 'listing_answer',
    'listingId', q.listing_id,
    'questionId', q.id
  ) AS data,
  false AS is_read,
  -- Algunas instalaciones no tienen `updated_at` en listing_questions
  COALESCE(q.answered_at, q.created_at, TIMEZONE('utc'::text, NOW())) AS created_at
FROM public.listing_questions q
WHERE
  q.is_deleted = false
  AND q.answer_text IS NOT NULL
  AND COALESCE(q.asker_id::text, '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE
      n.user_id = q.asker_id
      AND COALESCE(n.data->>'questionId','') = q.id::text
  );




-- ============================================================
-- Script 24/40: supabase_user_ratings.sql
-- ============================================================

-- Pocket - Calificaciones (1-10) por orden + reputación agregada (idempotente)
-- Ejecuta este SQL en Supabase → SQL Editor.

-- Tabla: public.user_ratings
CREATE TABLE IF NOT EXISTS public.user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- 'buyer_to_seller' | 'seller_to_buyer'
  stars INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints (idempotentes)
ALTER TABLE public.user_ratings
  DROP CONSTRAINT IF EXISTS user_ratings_direction_chk;
ALTER TABLE public.user_ratings
  ADD CONSTRAINT user_ratings_direction_chk
  CHECK (direction IN ('buyer_to_seller', 'seller_to_buyer'));

ALTER TABLE public.user_ratings
  DROP CONSTRAINT IF EXISTS user_ratings_stars_chk;
ALTER TABLE public.user_ratings
  ADD CONSTRAINT user_ratings_stars_chk
  CHECK (stars >= 1 AND stars <= 10);

ALTER TABLE public.user_ratings
  DROP CONSTRAINT IF EXISTS user_ratings_one_per_direction;
ALTER TABLE public.user_ratings
  ADD CONSTRAINT user_ratings_one_per_direction
  UNIQUE (order_id, direction);

CREATE INDEX IF NOT EXISTS user_ratings_ratee_direction_idx ON public.user_ratings (ratee_id, direction);
CREATE INDEX IF NOT EXISTS user_ratings_order_idx ON public.user_ratings (order_id);

-- RLS
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

-- Policies (re-crear v2)
DROP POLICY IF EXISTS "Participants can read own ratings (v1)" ON public.user_ratings;
DROP POLICY IF EXISTS "Participants can read own ratings (v2)" ON public.user_ratings;
DROP POLICY IF EXISTS "Admins can read all ratings (v2)" ON public.user_ratings;
DROP POLICY IF EXISTS "Buyer/Seller can create ratings (v2)" ON public.user_ratings;

CREATE POLICY "Participants can read own ratings (v2)"
  ON public.user_ratings
  FOR SELECT
  TO authenticated
  USING (
    rater_id = auth.uid()
    OR ratee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

CREATE POLICY "Buyer/Seller can create ratings (v2)"
  ON public.user_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = user_ratings.order_id
          AND user_ratings.direction = 'buyer_to_seller'
          AND o.buyer_id = auth.uid()
          AND user_ratings.ratee_id = o.seller_id
      )
      OR
      EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = user_ratings.order_id
          AND user_ratings.direction = 'seller_to_buyer'
          AND o.seller_id = auth.uid()
          AND user_ratings.ratee_id = o.buyer_id
      )
    )
  );

-- Función pública (solo agregados) para termómetro / badges sin exponer comentarios
CREATE OR REPLACE FUNCTION public.get_user_reputation(p_user UUID)
RETURNS TABLE (
  user_id UUID,
  seller_avg_stars NUMERIC,
  seller_count BIGINT,
  seller_percent INTEGER,
  seller_badge TEXT,
  buyer_avg_stars NUMERIC,
  buyer_count BIGINT,
  buyer_percent INTEGER,
  buyer_badge TEXT,
  overall_avg_stars NUMERIC,
  overall_count BIGINT,
  overall_percent INTEGER,
  overall_badge TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT direction, stars
  FROM public.user_ratings
  WHERE ratee_id = p_user
),
seller AS (
  SELECT
    AVG(stars)::NUMERIC AS avg_stars,
    COUNT(*)::BIGINT AS cnt
  FROM base
  WHERE direction = 'buyer_to_seller'
),
buyer AS (
  SELECT
    AVG(stars)::NUMERIC AS avg_stars,
    COUNT(*)::BIGINT AS cnt
  FROM base
  WHERE direction = 'seller_to_buyer'
),
overall AS (
  SELECT
    AVG(stars)::NUMERIC AS avg_stars,
    COUNT(*)::BIGINT AS cnt
  FROM base
),
norm AS (
  SELECT
    COALESCE((SELECT avg_stars FROM seller), NULL) AS seller_avg,
    COALESCE((SELECT cnt FROM seller), 0) AS seller_cnt,
    COALESCE((SELECT avg_stars FROM buyer), NULL) AS buyer_avg,
    COALESCE((SELECT cnt FROM buyer), 0) AS buyer_cnt,
    COALESCE((SELECT avg_stars FROM overall), NULL) AS overall_avg,
    COALESCE((SELECT cnt FROM overall), 0) AS overall_cnt
)
SELECT
  p_user AS user_id,
  norm.seller_avg AS seller_avg_stars,
  norm.seller_cnt AS seller_count,
  CASE WHEN norm.seller_cnt > 0 THEN GREATEST(0, LEAST(100, ROUND(norm.seller_avg * 10)::INT)) ELSE 100 END AS seller_percent,
  CASE
    WHEN (CASE WHEN norm.seller_cnt > 0 THEN ROUND(norm.seller_avg * 10)::INT ELSE 100 END) >= 91 THEN 'platinum'
    WHEN (CASE WHEN norm.seller_cnt > 0 THEN ROUND(norm.seller_avg * 10)::INT ELSE 100 END) >= 71 THEN 'gold'
    WHEN (CASE WHEN norm.seller_cnt > 0 THEN ROUND(norm.seller_avg * 10)::INT ELSE 100 END) >= 51 THEN 'plata'
    ELSE NULL
  END AS seller_badge,
  norm.buyer_avg AS buyer_avg_stars,
  norm.buyer_cnt AS buyer_count,
  CASE WHEN norm.buyer_cnt > 0 THEN GREATEST(0, LEAST(100, ROUND(norm.buyer_avg * 10)::INT)) ELSE 100 END AS buyer_percent,
  CASE
    WHEN (CASE WHEN norm.buyer_cnt > 0 THEN ROUND(norm.buyer_avg * 10)::INT ELSE 100 END) >= 91 THEN 'platinum'
    WHEN (CASE WHEN norm.buyer_cnt > 0 THEN ROUND(norm.buyer_avg * 10)::INT ELSE 100 END) >= 71 THEN 'gold'
    WHEN (CASE WHEN norm.buyer_cnt > 0 THEN ROUND(norm.buyer_avg * 10)::INT ELSE 100 END) >= 51 THEN 'plata'
    ELSE NULL
  END AS buyer_badge,
  norm.overall_avg AS overall_avg_stars,
  norm.overall_cnt AS overall_count,
  CASE WHEN norm.overall_cnt > 0 THEN GREATEST(0, LEAST(100, ROUND(norm.overall_avg * 10)::INT)) ELSE 100 END AS overall_percent,
  CASE
    WHEN (CASE WHEN norm.overall_cnt > 0 THEN ROUND(norm.overall_avg * 10)::INT ELSE 100 END) >= 91 THEN 'platinum'
    WHEN (CASE WHEN norm.overall_cnt > 0 THEN ROUND(norm.overall_avg * 10)::INT ELSE 100 END) >= 71 THEN 'gold'
    WHEN (CASE WHEN norm.overall_cnt > 0 THEN ROUND(norm.overall_avg * 10)::INT ELSE 100 END) >= 51 THEN 'plata'
    ELSE NULL
  END AS overall_badge
FROM norm;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_reputation(UUID) TO anon, authenticated;




-- ============================================================
-- Script 25/40: supabase_user_reviews_public.sql
-- ============================================================

-- Pocket App - Reviews públicos (comentarios) para reputación (idempotente)
-- Permite mostrar comentarios en perfiles públicos SIN abrir RLS de `user_ratings`.
-- Ejecuta en Supabase → SQL Editor.

DROP FUNCTION IF EXISTS public.get_user_reviews_public(UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_user_reviews_public(
  p_user UUID,
  p_direction TEXT DEFAULT NULL, -- 'buyer_to_seller' | 'seller_to_buyer' | NULL
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  direction TEXT,
  stars INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ,
  rater_name TEXT,
  rater_id UUID
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ur.direction,
    ur.stars,
    ur.comment,
    ur.created_at,
    COALESCE(NULLIF(split_part(p.full_name, ' ', 1), ''), 'Usuario') AS rater_name,
    ur.rater_id
  FROM public.user_ratings ur
  LEFT JOIN public.profiles p ON p.id = ur.rater_id
  WHERE
    ur.ratee_id = p_user
    AND (p_direction IS NULL OR p_direction = '' OR ur.direction = p_direction)
    AND COALESCE(ur.comment, '') <> ''
  ORDER BY ur.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
$$;

GRANT EXECUTE ON FUNCTION public.get_user_reviews_public(UUID, TEXT, INTEGER) TO anon, authenticated;




-- ============================================================
-- Script 26/40: supabase_favorites.sql
-- ============================================================

-- Pocket - Favoritos (idempotente)
-- Ejecuta en Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_listing_uidx ON public.favorites (user_id, listing_id);
CREATE INDEX IF NOT EXISTS favorites_user_created_idx ON public.favorites (user_id, created_at DESC);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their favorites" ON public.favorites;
CREATE POLICY "Users can read their favorites"
  ON public.favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their favorites" ON public.favorites;
CREATE POLICY "Users can insert their favorites"
  ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their favorites" ON public.favorites;
CREATE POLICY "Users can delete their favorites"
  ON public.favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);




-- ============================================================
-- Script 27/40: supabase_listing_questions.sql
-- ============================================================

-- Pocket App - Preguntas al vendedor (idempotente)
-- Ejecuta este SQL en Supabase (SQL Editor).

CREATE TABLE IF NOT EXISTS public.listing_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  asker_id UUID NOT NULL,
  question_text TEXT NOT NULL DEFAULT '',
  answer_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  answered_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS listing_questions_listing_id_created_at_idx
  ON public.listing_questions (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS listing_questions_seller_id_created_at_idx
  ON public.listing_questions (seller_id, created_at DESC);

ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable: borrar policies si ya existen
DROP POLICY IF EXISTS "Public can read listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Authenticated can ask listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Seller can answer listing questions" ON public.listing_questions;

-- Visible para todos (anon + authenticated), excepto eliminados
CREATE POLICY "Public can read listing questions"
  ON public.listing_questions
  FOR SELECT
  TO anon, authenticated
  USING (is_deleted = false);

-- Preguntar: solo usuarios logueados, no el vendedor, y seller_id debe coincidir con el listing
CREATE POLICY "Authenticated can ask listing questions"
  ON public.listing_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    asker_id = auth.uid()
    AND seller_id <> auth.uid()
    AND seller_id = (
      SELECT l.seller_id FROM public.listings l WHERE l.id = listing_id
    )
  );

-- Responder: solo el vendedor puede actualizar (answer_text/answered_at)
CREATE POLICY "Seller can answer listing questions"
  ON public.listing_questions
  FOR UPDATE
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());




-- ============================================================
-- Script 28/40: supabase_listing_templates.sql
-- ============================================================

-- Pocket App - Plantillas seguras por bloques (Admin + Usuario) (idempotente)
-- Objetivo:
-- - Permitir plantillas "globales" creadas por admin
-- - Permitir plantillas "del usuario" (solo las ve/edita su dueño)
-- - Guardar un snapshot de bloques en `listings.description_blocks` (sin HTML peligroso)
--
-- Ejecuta este SQL en Supabase → SQL Editor.

-- Helper: ¿es admin? (si ya existe, se reemplaza con la misma lógica)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

-- 1) Tabla de plantillas
CREATE TABLE IF NOT EXISTS public.listing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  preview_image_url TEXT NULL,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS listing_templates_owner_id_idx ON public.listing_templates (owner_id);
CREATE INDEX IF NOT EXISTS listing_templates_is_global_idx ON public.listing_templates (is_global);
CREATE INDEX IF NOT EXISTS listing_templates_is_active_idx ON public.listing_templates (is_active);

ALTER TABLE public.listing_templates ENABLE ROW LEVEL SECURITY;

-- SELECT:
-- - Cualquier usuario autenticado puede ver plantillas activas globales
-- - Un usuario puede ver sus propias plantillas (aunque estén inactivas)
DROP POLICY IF EXISTS "Users can read available templates" ON public.listing_templates;
CREATE POLICY "Users can read available templates"
  ON public.listing_templates
  FOR SELECT
  TO authenticated
  USING (
    (is_global = true AND is_active = true)
    OR (owner_id = auth.uid())
    OR public.is_admin()
  );

-- INSERT:
-- - Usuario: puede crear solo plantillas propias (no globales)
-- - Admin: puede crear globales o de usuario (para soporte/curación)
DROP POLICY IF EXISTS "Users can create own templates" ON public.listing_templates;
CREATE POLICY "Users can create own templates"
  ON public.listing_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      owner_id = auth.uid()
      AND is_global = false
    )
  );

-- UPDATE:
-- - Usuario: solo sus propias plantillas
-- - Admin: cualquiera
DROP POLICY IF EXISTS "Users can update own templates" ON public.listing_templates;
CREATE POLICY "Users can update own templates"
  ON public.listing_templates
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR owner_id = auth.uid())
  WITH CHECK (
    public.is_admin()
    OR (
      owner_id = auth.uid()
      AND is_global = false
    )
  );

-- DELETE:
-- - Usuario: solo sus propias plantillas
-- - Admin: cualquiera
DROP POLICY IF EXISTS "Users can delete own templates" ON public.listing_templates;
CREATE POLICY "Users can delete own templates"
  ON public.listing_templates
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR owner_id = auth.uid());

-- Trigger updated_at (reusa public.update_updated_at_column si ya existe; si no, lo crea)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = TIMEZONE('utc'::text, NOW());
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_listing_templates_updated_at ON public.listing_templates;
CREATE TRIGGER update_listing_templates_updated_at
  BEFORE UPDATE ON public.listing_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Snapshot en listings (plantillas aplicadas)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS description_blocks JSONB NULL,
  ADD COLUMN IF NOT EXISTS description_blocks_meta JSONB NULL;

COMMENT ON COLUMN public.listings.description_blocks IS 'Bloques seguros (JSON) para renderizado tipo plantilla; evita HTML libre.';
COMMENT ON COLUMN public.listings.description_blocks_meta IS 'Metadatos: template_id, template_title, applied_at, etc.';




-- ============================================================
-- Script 29/40: supabase_auctions_and_coupons.sql
-- ============================================================

-- Pocket App - Subastas + Notificaciones + Cupones (por vendedor)
-- Ejecuta este SQL en el SQL Editor de Supabase.
-- Es re-ejecutable (incluye DROP POLICY IF EXISTS donde aplica).

-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_gender') THEN
    CREATE TYPE public.listing_gender AS ENUM ('Mujer', 'Hombre', 'Unisex');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_sale_type') THEN
    CREATE TYPE public.listing_sale_type AS ENUM ('direct', 'auction');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_discount_type') THEN
    CREATE TYPE public.coupon_discount_type AS ENUM ('percent', 'fixed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE public.notification_type AS ENUM ('outbid', 'system');
  END IF;
END$$;

-- 2) Listings: columnas nuevas
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS gender public.listing_gender NULL,
  ADD COLUMN IF NOT EXISTS size TEXT NULL,
  ADD COLUMN IF NOT EXISTS color TEXT NULL,
  ADD COLUMN IF NOT EXISTS category TEXT NULL,
  ADD COLUMN IF NOT EXISTS sale_type public.listing_sale_type NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_fee NUMERIC NOT NULL DEFAULT 0,

  -- Subasta
  ADD COLUMN IF NOT EXISTS auction_start_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS auction_end_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS auction_starting_bid NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auction_bid_increment NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auction_highest_bid NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auction_highest_bidder_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índices útiles
CREATE INDEX IF NOT EXISTS listings_sale_type_idx ON public.listings (sale_type);
CREATE INDEX IF NOT EXISTS listings_featured_idx ON public.listings (is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS listings_auction_end_idx ON public.listings (auction_end_at) WHERE sale_type = 'auction';

-- 3) Pujas
CREATE TABLE IF NOT EXISTS public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS bids_listing_created_idx ON public.bids (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bids_bidder_created_idx ON public.bids (bidder_id, created_at DESC);

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read bids for active auction listings" ON public.bids;
CREATE POLICY "Anyone can read bids for active auction listings"
  ON public.bids
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.status = 'active' AND l.sale_type = 'auction'
    )
  );

-- Insert solo por el propio usuario (la API también validará reglas)
DROP POLICY IF EXISTS "Users can insert their own bids" ON public.bids;
CREATE POLICY "Users can insert their own bids"
  ON public.bids
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = bidder_id);

-- No permitimos UPDATE/DELETE (solo admin/service role si hace falta)

-- 4) Notificaciones (para avisar "te ganaron la puja")
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their notifications" ON public.notifications;
CREATE POLICY "Users can read their notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
CREATE POLICY "Users can update their notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inserts recomendados solo vía service role (webhooks/API). Si quieres permitir insert propio, agrega policy.

-- 5) Cupones por vendedor
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type public.coupon_discount_type NOT NULL DEFAULT 'percent',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE NULL,
  ends_at TIMESTAMP WITH TIME ZONE NULL,
  max_redemptions INTEGER NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Código único por vendedor
CREATE UNIQUE INDEX IF NOT EXISTS coupons_seller_code_uniq ON public.coupons (seller_id, code);
CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons (code);

CREATE TABLE IF NOT EXISTS public.coupon_listings (
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  PRIMARY KEY (coupon_id, listing_id)
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx ON public.coupon_redemptions (coupon_id, created_at DESC);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Cupones: vendedor administra los suyos
DROP POLICY IF EXISTS "Sellers can read their coupons" ON public.coupons;
CREATE POLICY "Sellers can read their coupons"
  ON public.coupons
  FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can insert their coupons" ON public.coupons;
CREATE POLICY "Sellers can insert their coupons"
  ON public.coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can update their coupons" ON public.coupons;
CREATE POLICY "Sellers can update their coupons"
  ON public.coupons
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can delete their coupons" ON public.coupons;
CREATE POLICY "Sellers can delete their coupons"
  ON public.coupons
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

-- coupon_listings: solo el vendedor (dueño del cupón) puede gestionar relaciones
DROP POLICY IF EXISTS "Sellers can manage coupon listings" ON public.coupon_listings;
CREATE POLICY "Sellers can manage coupon listings"
  ON public.coupon_listings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.coupons c WHERE c.id = coupon_id AND c.seller_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.coupons c WHERE c.id = coupon_id AND c.seller_id = auth.uid())
  );

-- Redemptions: el comprador puede leer las suyas; inserts preferentemente vía API/service role
DROP POLICY IF EXISTS "Buyers can read their coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Buyers can read their coupon redemptions"
  ON public.coupon_redemptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

-- 6) (Opcional) Orders: campos para cupones (no rompe si ya existen)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC NOT NULL DEFAULT 0;




-- ============================================================
-- Script 30/40: supabase_home_banners.sql
-- ============================================================

-- Pocket App - Banners configurables para Home
-- Ejecuta este SQL en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.home_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  cta_text TEXT NOT NULL DEFAULT '',
  cta_href TEXT NOT NULL DEFAULT '/listings',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS home_banners_active_order_idx ON public.home_banners (is_active, sort_order, created_at DESC);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable: borrar policies si ya existen
DROP POLICY IF EXISTS "Public can read active home banners" ON public.home_banners;
DROP POLICY IF EXISTS "Admins can manage home banners" ON public.home_banners;

-- Lectura pública (solo activos)
CREATE POLICY "Public can read active home banners"
  ON public.home_banners
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Admin: full access
CREATE POLICY "Admins can manage home banners"
  ON public.home_banners
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Trigger updated_at (usa la función existente si ya la tienes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = TIMEZONE('utc'::text, NOW());
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_home_banners_updated_at ON public.home_banners;
CREATE TRIGGER update_home_banners_updated_at
  BEFORE UPDATE ON public.home_banners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();




-- ============================================================
-- Script 31/40: supabase_home_banners_placements.sql
-- ============================================================

-- Pocket - Home banners: placement + fit/position (idempotente)
-- Ejecuta en Supabase → SQL Editor.

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS placement TEXT NOT NULL DEFAULT 'hero';

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS image_fit TEXT NOT NULL DEFAULT 'cover';

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS image_position TEXT NOT NULL DEFAULT 'center';

-- PRO (floating): frecuencia, posición y delay (idempotente)
ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS floating_frequency TEXT NOT NULL DEFAULT '7d';

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS floating_position TEXT NOT NULL DEFAULT 'bottom_right';

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS floating_delay_ms INTEGER NOT NULL DEFAULT 0;

-- Valores recomendados:
-- placement: 'hero' | 'top' | 'mid' | 'mid2' | 'mid3' | 'bottom' | 'floating'
-- image_fit: 'cover' | 'contain'
-- image_position: 'center' | 'top' | 'bottom' | 'left' | 'right'
-- floating_frequency: 'session' | '24h' | '7d'
-- floating_position: 'bottom_right' | 'bottom_left' | 'top_right' | 'top_left'
-- floating_delay_ms: 0..600000 (ej: 1500)




-- ============================================================
-- Script 32/40: supabase_home_banners_admin_delete.sql
-- ============================================================

-- Pocket App - Permitir DELETE de home_banners a admins (idempotente)
-- Ejecuta en Supabase → SQL Editor.

-- Asegurar helper is_admin (si ya existe, no pasa nada)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

-- Policy explícita de DELETE (por si tu policy "FOR ALL" no existe o fue modificada)
DROP POLICY IF EXISTS "Admins can delete home banners" ON public.home_banners;
CREATE POLICY "Admins can delete home banners"
  ON public.home_banners
  FOR DELETE
  TO authenticated
  USING (public.is_admin());




-- ============================================================
-- Script 33/40: supabase_disputes.sql
-- ============================================================

-- Pocket App - Disputas (idempotente)
-- Crea: disputes, dispute_messages, dispute_reads + RLS policies

-- Requiere extensión para UUIDs (en Supabase suele estar habilitada):
-- create extension if not exists "pgcrypto";

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  buyer_id uuid not null,
  seller_id uuid not null,
  opened_by uuid not null,
  reason_code text not null default 'not_received',
  reason_text text not null default '',
  status text not null default 'open', -- open | resolved | closed
  admin_decision text null,            -- release | refund | partial | close
  admin_note text null,
  last_message_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Un order sólo debería tener 1 disputa activa (best-effort)
create unique index if not exists disputes_order_unique on public.disputes (order_id);
create index if not exists disputes_status_last_idx on public.disputes (status, last_message_at desc);
create index if not exists disputes_buyer_last_idx on public.disputes (buyer_id, last_message_at desc);
create index if not exists disputes_seller_last_idx on public.disputes (seller_id, last_message_at desc);

create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid not null,
  sender_role text not null default 'user', -- buyer | seller | admin | user
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists dispute_messages_dispute_created_idx on public.dispute_messages (dispute_id, created_at asc);
create index if not exists dispute_messages_sender_idx on public.dispute_messages (sender_id, created_at desc);

create table if not exists public.dispute_reads (
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  user_id uuid not null,
  last_read_at timestamptz not null default timezone('utc'::text, now()),
  primary key (dispute_id, user_id)
);

create index if not exists dispute_reads_user_idx on public.dispute_reads (user_id, last_read_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_disputes_updated_at on public.disputes;
create trigger set_disputes_updated_at
before update on public.disputes
for each row execute function public.set_updated_at();

alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
alter table public.dispute_reads enable row level security;

-- Helpers: admin check via tabla admin_users (ya existe en tu proyecto)
-- Lectura de disputas: buyer/seller o admin
drop policy if exists "Disputes read by participants or admin" on public.disputes;
create policy "Disputes read by participants or admin"
  on public.disputes
  for select
  to authenticated
  using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
    or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

-- Insert de disputa: sólo buyer abre (opened_by = buyer_id = auth.uid())
drop policy if exists "Disputes insert by buyer" on public.disputes;
create policy "Disputes insert by buyer"
  on public.disputes
  for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and opened_by = auth.uid()
  );

-- Update de disputa: sólo admin (resolver/cerrar)
drop policy if exists "Disputes update by admin" on public.disputes;
create policy "Disputes update by admin"
  on public.disputes
  for update
  to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- Mensajes: lectura por participantes o admin
drop policy if exists "Dispute messages read by participants or admin" on public.dispute_messages;
create policy "Dispute messages read by participants or admin"
  on public.dispute_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  );

-- Mensajes: insert por participantes o admin (sender_id debe ser auth.uid())
drop policy if exists "Dispute messages insert by participants or admin" on public.dispute_messages;
create policy "Dispute messages insert by participants or admin"
  on public.dispute_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  );

-- Reads: lectura/insert/update por participantes o admin
drop policy if exists "Dispute reads by participants or admin" on public.dispute_reads;
create policy "Dispute reads by participants or admin"
  on public.dispute_reads
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  );

drop policy if exists "Dispute reads upsert by participants or admin" on public.dispute_reads;
create policy "Dispute reads upsert by participants or admin"
  on public.dispute_reads
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  );

drop policy if exists "Dispute reads update by participants or admin" on public.dispute_reads;
create policy "Dispute reads update by participants or admin"
  on public.dispute_reads
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  )
  with check (user_id = auth.uid());




-- ============================================================
-- Script 34/40: supabase_support_chat.sql
-- ============================================================

-- Pocket App - Soporte (conversaciones + mensajes) para Admin → Soporte
-- Ejecuta este SQL en Supabase (SQL Editor). Es idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_conversation_status') THEN
    CREATE TYPE public.support_conversation_status AS ENUM ('open', 'closed');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  status public.support_conversation_status NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  -- WhatsApp-like PRO:
  -- Asignación (para que un agente "tome" el chat)
  assigned_admin_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NULL,
  -- No leídos
  last_read_by_admin_at TIMESTAMP WITH TIME ZONE NULL,
  last_read_by_user_at TIMESTAMP WITH TIME ZONE NULL,
  -- Entrega (✓ cuando el usuario recibe el mensaje)
  last_delivered_to_user_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Idempotente: si la tabla ya existía, asegurar columnas PRO
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS last_read_by_admin_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS last_read_by_user_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS last_delivered_to_user_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS support_conversations_status_last_idx
  ON public.support_conversations (status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS support_conversations_created_by_idx
  ON public.support_conversations (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS support_conversations_assigned_status_last_idx
  ON public.support_conversations (assigned_admin_id, status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin' (texto simple para compatibilidad)
  body TEXT NOT NULL DEFAULT '',
  -- Adjuntos (PRO): fotos/archivos
  attachment_url TEXT NULL,
  attachment_name TEXT NULL,
  attachment_mime TEXT NULL,
  attachment_size INTEGER NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Idempotente: asegurar columnas de adjuntos en mensajes
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT NULL;
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_name TEXT NULL;
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT NULL;
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER NULL;

CREATE INDEX IF NOT EXISTS support_messages_conversation_created_idx
  ON public.support_messages (conversation_id, created_at ASC);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Re-ejecutable
DROP POLICY IF EXISTS "Users can read own support conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Users can insert own support conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Admins can read all support conversations" ON public.support_conversations;
DROP POLICY IF EXISTS "Admins can update all support conversations" ON public.support_conversations;

DROP POLICY IF EXISTS "Users can read own support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Users can insert own support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Admins can read all support messages" ON public.support_messages;
DROP POLICY IF EXISTS "Admins can insert support messages" ON public.support_messages;

-- Conversaciones: el usuario ve las suyas
CREATE POLICY "Users can read own support conversations"
  ON public.support_conversations
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Conversaciones: el usuario crea las suyas
CREATE POLICY "Users can insert own support conversations"
  ON public.support_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Admins: ver todo (si está en admin_users)
CREATE POLICY "Admins can read all support conversations"
  ON public.support_conversations
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Admins: actualizar (cerrar/abrir)
CREATE POLICY "Admins can update all support conversations"
  ON public.support_conversations
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Mensajes: el usuario ve mensajes de sus conversaciones
CREATE POLICY "Users can read own support messages"
  ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
  );

-- Mensajes: el usuario puede enviar en sus conversaciones
CREATE POLICY "Users can insert own support messages"
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    sender_role = 'user' AND
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
  );

-- Admins: leer todos los mensajes
CREATE POLICY "Admins can read all support messages"
  ON public.support_messages
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

-- Admins: enviar mensajes (sender_role='admin')
CREATE POLICY "Admins can insert support messages"
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    sender_role = 'admin' AND
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- Trigger para updated_at y last_message_at (best-effort)
CREATE OR REPLACE FUNCTION public.support_touch_conversation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_conversations
  SET updated_at = TIMEZONE('utc'::text, NOW()),
      last_message_at = TIMEZONE('utc'::text, NOW())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS support_touch_conversation_trigger ON public.support_messages;
CREATE TRIGGER support_touch_conversation_trigger
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.support_touch_conversation();




-- ============================================================
-- Script 35/40: supabase_contacts_table.sql
-- ============================================================

-- Crear tabla contacts en Supabase
-- Ejecuta este SQL en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NULL,
  company TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Política: cada usuario solo ve sus contactos
DROP POLICY IF EXISTS "Users can read their own contacts" ON public.contacts;
CREATE POLICY "Users can read their own contacts"
  ON public.contacts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: cada usuario solo inserta sus contactos
DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
CREATE POLICY "Users can insert their own contacts"
  ON public.contacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: cada usuario solo actualiza sus contactos
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
CREATE POLICY "Users can update their own contacts"
  ON public.contacts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: cada usuario solo elimina sus contactos
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;
CREATE POLICY "Users can delete their own contacts"
  ON public.contacts
  FOR DELETE
  USING (auth.uid() = user_id);




-- ============================================================
-- Script 36/40: supabase_checkout_sessions_offline.sql
-- ============================================================

-- Pocket App - Checkout sessions (offline refs) (idempotente)
-- Agrega referencia alfanumérica para pagos offline y campos extra.

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS reference_code TEXT;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS offline_instructions JSONB;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS paid_confirmed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS paid_confirmed_by UUID;

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_reference_code_uniq
  ON public.checkout_sessions (reference_code)
  WHERE reference_code IS NOT NULL AND reference_code <> '';




-- ============================================================
-- Script 37/40: supabase_checkout_sessions_offline_proof.sql
-- ============================================================

-- Agrega campos para guardar comprobante (ticket/baúcher) de pagos offline.
-- Ejecuta en Supabase SQL Editor. Es idempotente.

do $$
begin
  -- URL pública del comprobante (imagen/PDF) subida por el comprador
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'checkout_sessions'
      and column_name = 'payment_proof_url'
  ) then
    alter table public.checkout_sessions add column payment_proof_url text;
  end if;

  -- Timestamp de subida
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'checkout_sessions'
      and column_name = 'payment_proof_uploaded_at'
  ) then
    alter table public.checkout_sessions add column payment_proof_uploaded_at timestamptz;
  end if;
end $$;




-- ============================================================
-- Script 38/40: supabase_profiles_payout_migration.sql
-- ============================================================

-- Pocket - Migración: datos de cobro (payout) en profiles (idempotente)
-- Ejecuta esto en Supabase → SQL Editor.
--
-- Campos sugeridos (MX):
-- - payout_bank_name: Banco (Ej: BBVA)
-- - payout_account_holder: Titular
-- - payout_clabe: CLABE (18 dígitos)
-- - payout_account_number: (opcional) número de cuenta (si lo usan)
-- - payout_notes: notas (opcional)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_bank_name TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_account_holder TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_clabe TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_notes TEXT;




-- ============================================================
-- Script 39/40: supabase_storage_policies_pocket.sql
-- ============================================================

-- Pocket - Storage policies (idempotente)
-- Buckets esperados:
-- - identificaciones (INE / verificación)
-- - upload (productos)
--
-- Nota: ajusta los nombres si cambian.

-- Permitir subir archivos (INSERT) a usuarios autenticados
DROP POLICY IF EXISTS "authenticated can upload identificaciones" ON storage.objects;
CREATE POLICY "authenticated can upload identificaciones"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'identificaciones');

DROP POLICY IF EXISTS "authenticated can upload upload" ON storage.objects;
CREATE POLICY "authenticated can upload upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'upload');

-- Permitir leer (SELECT) públicamente si los buckets son Public
-- Si prefieres que SOLO el usuario autenticado lea, cambia TO anon por TO authenticated.
DROP POLICY IF EXISTS "public read identificaciones" ON storage.objects;
CREATE POLICY "public read identificaciones"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'identificaciones');

DROP POLICY IF EXISTS "public read upload" ON storage.objects;
CREATE POLICY "public read upload"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'upload');




-- ============================================================
-- Script 40/40: supabase_listing_questions_rls_fix.sql
-- ============================================================

-- Pocket App - Fix RLS para que vendedores puedan ver sus preguntas
-- Ejecuta este SQL en Supabase (SQL Editor).

-- Agregar política para que vendedores puedan ver sus propias preguntas
DROP POLICY IF EXISTS "Sellers can read their own questions" ON public.listing_questions;

CREATE POLICY "Sellers can read their own questions"
  ON public.listing_questions
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- La política "Public can read listing questions" ya permite leer todas las preguntas no eliminadas
-- pero esta nueva política asegura que el vendedor siempre pueda ver las suyas



-- ============================================================
-- FIN DE LA CONSOLIDACIÓN
-- Scripts procesados: 40
-- ============================================================
