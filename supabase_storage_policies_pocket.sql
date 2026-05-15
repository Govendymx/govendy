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

