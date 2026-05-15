-- Pocket App - Disputas (idempotente)
-- Crea: disputes, dispute_messages, dispute_reads + RLS policies

-- Requiere extensión para UUIDs (en Supabase suele estar habilitada):
-- create extension if not exists "pgcrypto";

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  buyer_id uuid not null,
  seller_id uuid not null,
  opened_by uuid not null,
  reason_code text not null default 'not_received',
  reason_text text not null default '',
  status text not null default 'open', -- open | resolved | closed
  admin_decision text null,            -- release | refund | partial | close
  admin_note text null,
  last_message_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Un order sólo debería tener 1 disputa activa (best-effort)
create unique index if not exists disputes_order_unique on public.disputes (order_id);
create index if not exists disputes_status_last_idx on public.disputes (status, last_message_at desc);
create index if not exists disputes_buyer_last_idx on public.disputes (buyer_id, last_message_at desc);
create index if not exists disputes_seller_last_idx on public.disputes (seller_id, last_message_at desc);

create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid not null,
  sender_role text not null default 'user', -- buyer | seller | admin | user
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists dispute_messages_dispute_created_idx on public.dispute_messages (dispute_id, created_at asc);
create index if not exists dispute_messages_sender_idx on public.dispute_messages (sender_id, created_at desc);

create table if not exists public.dispute_reads (
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  user_id uuid not null,
  last_read_at timestamptz not null default timezone('utc'::text, now()),
  primary key (dispute_id, user_id)
);

create index if not exists dispute_reads_user_idx on public.dispute_reads (user_id, last_read_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_disputes_updated_at on public.disputes;
create trigger set_disputes_updated_at
before update on public.disputes
for each row execute function public.set_updated_at();

alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
alter table public.dispute_reads enable row level security;

-- Helpers: admin check via tabla admin_users (ya existe en tu proyecto)
-- Lectura de disputas: buyer/seller o admin
drop policy if exists "Disputes read by participants or admin" on public.disputes;
create policy "Disputes read by participants or admin"
  on public.disputes
  for select
  to authenticated
  using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
    or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );

-- Insert de disputa: sólo buyer abre (opened_by = buyer_id = auth.uid())
drop policy if exists "Disputes insert by buyer" on public.disputes;
create policy "Disputes insert by buyer"
  on public.disputes
  for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and opened_by = auth.uid()
  );

-- Update de disputa: sólo admin (resolver/cerrar)
drop policy if exists "Disputes update by admin" on public.disputes;
create policy "Disputes update by admin"
  on public.disputes
  for update
  to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- Mensajes: lectura por participantes o admin
drop policy if exists "Dispute messages read by participants or admin" on public.dispute_messages;
create policy "Dispute messages read by participants or admin"
  on public.dispute_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  );

-- Mensajes: insert por participantes o admin (sender_id debe ser auth.uid())
drop policy if exists "Dispute messages insert by participants or admin" on public.dispute_messages;
create policy "Dispute messages insert by participants or admin"
  on public.dispute_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  );

-- Reads: lectura/insert/update por participantes o admin
drop policy if exists "Dispute reads by participants or admin" on public.dispute_reads;
create policy "Dispute reads by participants or admin"
  on public.dispute_reads
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  );

drop policy if exists "Dispute reads upsert by participants or admin" on public.dispute_reads;
create policy "Dispute reads upsert by participants or admin"
  on public.dispute_reads
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  );

drop policy if exists "Dispute reads update by participants or admin" on public.dispute_reads;
create policy "Dispute reads update by participants or admin"
  on public.dispute_reads
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.disputes d
      where d.id = dispute_id
        and (
          d.buyer_id = auth.uid()
          or d.seller_id = auth.uid()
          or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
        )
    )
  )
  with check (user_id = auth.uid());

