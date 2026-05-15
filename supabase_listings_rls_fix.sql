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

