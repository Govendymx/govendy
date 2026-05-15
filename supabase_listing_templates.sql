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

