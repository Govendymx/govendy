-- 1. Agregar columna si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'pocket_cash_number') THEN
        ALTER TABLE public.wallets ADD COLUMN pocket_cash_number TEXT UNIQUE;
        CREATE INDEX IF NOT EXISTS idx_wallets_pocket_cash_number ON public.wallets(pocket_cash_number);
    END IF;
END $$;

-- 2. Función para generar número aleatorio de 16 dígitos (sin colisiones)
-- Prefijo '9' para uso interno.
CREATE OR REPLACE FUNCTION generate_pocket_cash_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_number TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generar 15 dígitos aleatorios y concatenar con '9'
    -- floor(random() * 10^15) genera hasta 15 dígitos.
    v_number := '9' || lpad(floor(random() * 1000000000000000)::text, 15, '0');
    -- Cortar a 16 por seguridad si se pasa
    v_number := left(v_number, 16);
    
    -- Verificar unicidad
    SELECT EXISTS(SELECT 1 FROM wallets WHERE pocket_cash_number = v_number) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_number;
END;
$$;

-- 3. Trigger para asignar número al crear wallet
CREATE OR REPLACE FUNCTION set_pocket_cash_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pocket_cash_number IS NULL THEN
    NEW.pocket_cash_number := generate_pocket_cash_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_pocket_cash_number ON public.wallets;
CREATE TRIGGER trigger_set_pocket_cash_number
BEFORE INSERT ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION set_pocket_cash_number();

-- 4. Backfill para wallets existentes
UPDATE public.wallets
SET pocket_cash_number = generate_pocket_cash_number()
WHERE pocket_cash_number IS NULL;

-- 5. Helper para buscar usuario por ID PocketCash
CREATE OR REPLACE FUNCTION get_user_by_pocket_cash_number(p_number TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT user_id FROM public.wallets WHERE pocket_cash_number = p_number;
$$;
