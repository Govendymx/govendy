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

