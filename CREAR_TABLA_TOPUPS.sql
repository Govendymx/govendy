-- Tabla para registrar intentos de recarga de saldo
create table if not exists wallet_topups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending', -- pending, approved, rejected
  mercadopago_preference_id text,
  mercadopago_payment_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Políticas RLS
alter table wallet_topups enable row level security;

create policy "Users can view own topups" on wallet_topups
  for select using (auth.uid() = user_id);

create policy "Users can insert own topups" on wallet_topups
  for insert with check (auth.uid() = user_id);

-- Admins pueden ver todo
create policy "Admins can view all topups" on wallet_topups
  for select using (exists (select 1 from admin_users where user_id = auth.uid()));

-- Agregar tipo 'deposit' al enum si es posible (Postgres no permite agregar fácil a enum en transacción simple a veces, pero intentaremos)
-- Si falla, usaremos 'manual_adjustment'
do $$
begin
  alter type wallet_reference_type add value if not exists 'deposit';
exception
  when duplicate_object then null;
end $$;
