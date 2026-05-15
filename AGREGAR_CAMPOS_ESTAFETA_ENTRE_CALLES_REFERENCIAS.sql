-- Agregar campos "Entre calles" y "Referencias" a la tabla estafeta_quotes
-- Ejecuta este SQL en Supabase SQL Editor

-- Agregar columnas para remitente
ALTER TABLE public.estafeta_quotes
ADD COLUMN IF NOT EXISTS sender_between_streets TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS sender_references TEXT NOT NULL DEFAULT '';

-- Agregar columnas para destinatario
ALTER TABLE public.estafeta_quotes
ADD COLUMN IF NOT EXISTS recipient_between_streets TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS recipient_references TEXT NOT NULL DEFAULT '';

-- Hacer que sender_email y recipient_email sean obligatorios
ALTER TABLE public.estafeta_quotes
ALTER COLUMN sender_email SET NOT NULL,
ALTER COLUMN recipient_email SET NOT NULL;

-- Actualizar registros existentes con valores por defecto si es necesario
UPDATE public.estafeta_quotes
SET 
  sender_between_streets = COALESCE(sender_between_streets, ''),
  sender_references = COALESCE(sender_references, ''),
  recipient_between_streets = COALESCE(recipient_between_streets, ''),
  recipient_references = COALESCE(recipient_references, ''),
  sender_email = COALESCE(sender_email, ''),
  recipient_email = COALESCE(recipient_email, '')
WHERE 
  sender_between_streets IS NULL OR 
  sender_references IS NULL OR 
  recipient_between_streets IS NULL OR 
  recipient_references IS NULL OR
  sender_email IS NULL OR
  recipient_email IS NULL;
