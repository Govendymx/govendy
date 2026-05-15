CREATE OR REPLACE FUNCTION public.check_stock_and_pause()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  effective_stock integer;
  current_status text;
BEGIN
  IF NEW.stock IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.stock < 0 THEN
    NEW.stock := 0;
  END IF;

  current_status := COALESCE(NEW.status::text, COALESCE(OLD.status::text, 'active'));

  IF TG_OP = 'UPDATE' THEN
    IF NEW.stock = 0 AND current_status = 'active' THEN
      NEW.status := 'paused'::public.listing_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_size_stock_and_pause()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total_stock integer;
  k text;
  v jsonb;
  n integer;
  current_status text;
BEGIN
  IF NEW.size_stock IS NULL OR jsonb_typeof(NEW.size_stock) <> 'object' THEN
    RETURN NEW;
  END IF;

  total_stock := 0;

  FOR k, v IN SELECT key, value FROM jsonb_each(NEW.size_stock)
  LOOP
    BEGIN
      n := trim(both '"' FROM v::text)::integer;
      IF n > 0 THEN
        total_stock := total_stock + n;
      END IF;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
  END LOOP;

  current_status := COALESCE(NEW.status::text, COALESCE(OLD.status::text, 'active'));

  IF TG_OP = 'UPDATE' THEN
    IF total_stock = 0 AND current_status = 'active' THEN
      NEW.status := 'paused'::public.listing_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

