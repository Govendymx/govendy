-- Crear tabla follows si no existe
CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, seller_id)
);

-- Habilitar RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Borrar politicas existentes para evitar duplicados
DROP POLICY IF EXISTS "Anyone can read follows" ON follows;
DROP POLICY IF EXISTS "Users manage own follows" ON follows;

-- Politica lectura publica
CREATE POLICY "Anyone can read follows"
  ON follows FOR SELECT USING (true);

-- Politica escritura propia
CREATE POLICY "Users manage own follows"
  ON follows FOR ALL USING (auth.uid() = follower_id);
