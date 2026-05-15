-- Habilitar PocketCash como método de pago en app_settings
-- Ejecutar en Supabase SQL Editor

DO $$
DECLARE
  current_settings jsonb;
BEGIN
  -- Obtener settings actuales
  SELECT payment_methods INTO current_settings FROM public.app_settings WHERE id = 1;
  
  -- Si no existe la clave pocketcash, agregarla
  IF current_settings -> 'pocketcash' IS NULL THEN
    UPDATE public.app_settings
    SET payment_methods = jsonb_set(
      payment_methods,
      '{pocketcash}',
      '{"enabled": true, "instructions": "Paga usando tu saldo disponible en PocketCash."}'::jsonb
    )
    WHERE id = 1;
  END IF;
END $$;
