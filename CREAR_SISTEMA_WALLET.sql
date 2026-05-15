-- 1. Tabla de Wallets (Monederos)
create table if not exists wallets (
  user_id uuid references auth.users(id) on delete cascade primary key,
  balance numeric(12, 2) not null default 0 check (balance >= 0),
  currency text not null default 'MXN',
  is_frozen boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 2. Tabla de Transacciones
create type wallet_transaction_type as enum ('credit', 'debit');
create type wallet_reference_type as enum ('order', 'refund', 'admin_gift', 'cashback', 'withdrawal', 'manual_adjustment');

create table if not exists wallet_transactions (
  id uuid default gen_random_uuid() primary key,
  wallet_id uuid references wallets(user_id) on delete cascade not null,
  type wallet_transaction_type not null,
  amount numeric(12, 2) not null check (amount > 0),
  concept text not null,
  reference_type wallet_reference_type not null,
  reference_id text, -- ID de la orden, admin ID, etc.
  created_at timestamptz not null default now()
);

-- 3. Índices para búsqueda rápida
create index if not exists idx_wallet_transactions_wallet_id on wallet_transactions(wallet_id);
create index if not exists idx_wallet_transactions_created_at on wallet_transactions(created_at desc);

-- 4. Políticas de Seguridad (RLS)
alter table wallets enable row level security;
alter table wallet_transactions enable row level security;

-- Los usuarios pueden ver su propio wallet
create policy "Users can view own wallet" on wallets
  for select using (auth.uid() = user_id);

-- Los usuarios pueden ver sus propias transacciones
create policy "Users can view own wallet transactions" on wallet_transactions
  for select using (wallet_id = auth.uid());

-- Los admins pueden ver y editar todo (asumiendo que admin_users usa auth.uid())
-- Nota: Si usas Service Role para admin, esto no es necesario, pero es buena práctica.
create policy "Admins can do everything on wallets" on wallets
  for all using (exists (select 1 from admin_users where user_id = auth.uid()));

create policy "Admins can do everything on wallet transactions" on wallet_transactions
  for all using (exists (select 1 from admin_users where user_id = auth.uid()));

-- 5. Trigger para crear wallet automáticamente al crear usuario (Opcional, pero recomendado)
create or replace function public.handle_new_user_wallet()
returns trigger as $$
begin
  insert into public.wallets (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger que se activa después de insertar en auth.users
-- Nota: Verifica si ya tienes triggers en auth.users, esto podría duplicar lógica si ya tienes un handle_new_user
-- Si ya tienes un trigger para crear profile, agrégale el insert a wallets ahí mismo.
-- drop trigger if exists on_auth_user_created_wallet on auth.users;
-- create trigger on_auth_user_created_wallet
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user_wallet();

-- 6. Configuración de Cashback en app_settings (Agregar columna JSONB)
alter table app_settings add column if not exists cashback_config jsonb default '{"enabled": false, "percentage": 0, "welcome_bonus": 0}';
