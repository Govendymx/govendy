-- Create audit_logs table for financial integrity monitoring
create type audit_severity as enum ('info', 'warning', 'critical');
create type audit_entity as enum ('wallet', 'transaction', 'order', 'system', 'payout');
create type audit_status as enum ('open', 'resolved', 'ignored');

create table if not exists audit_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  severity audit_severity default 'info' not null,
  entity_type audit_entity default 'system' not null,
  entity_id text, -- ID of the user, wallet, or transaction involved
  message text not null,
  details jsonb default '{}'::jsonb, -- Snapshot of data at the time of error
  status audit_status default 'open' not null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

-- Index for faster filtering
create index if not exists audit_logs_status_idx on audit_logs(status);
create index if not exists audit_logs_severity_idx on audit_logs(severity);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

-- RLS Policies
alter table audit_logs enable row level security;

-- Only Admins can view audit logs
create policy "Admins can view all audit logs"
  on audit_logs
  for select
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
    )
  );

-- Only Admins and Service Role can insert audit logs
create policy "Admins and Server can insert audit logs"
  on audit_logs
  for insert
  with check (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
    )
  );

-- Only Admins can update status
create policy "Admins can update audit logs"
  on audit_logs
  for update
  using (
    exists (
      select 1 from admin_users
      where admin_users.user_id = auth.uid()
    )
  );

-- Function to check wallet integrity (The Sentinel Logic)
create or replace function check_wallet_integrity()
returns table (
  wallet_id uuid,
  user_id uuid,
  stated_balance numeric,
  calculated_balance numeric,
  discrepancy numeric
) 
language sql
security definer
as $$
  SELECT 
    w.id as wallet_id, 
    w.user_id, 
    w.balance as stated_balance, 
    COALESCE(SUM(t.amount), 0) as calculated_balance,
    (w.balance - COALESCE(SUM(t.amount), 0)) as discrepancy
  FROM wallets w
  LEFT JOIN transactions t ON w.id = t.wallet_id
  GROUP BY w.id, w.user_id
  HAVING ABS(w.balance - COALESCE(SUM(t.amount), 0)) > 0.01;
$$;
