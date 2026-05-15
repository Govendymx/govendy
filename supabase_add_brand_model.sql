-- Agregar columnas brand y model a la tabla listings
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS model text;

-- Si quieres eliminar la columna size (opcional, mejor dejarla por si acaso)
-- ALTER TABLE listings DROP COLUMN size;
