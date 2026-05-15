-- Create featured_listings table for tracking promoted items
create table if not exists featured_listings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  listing_id uuid references listings(id) not null,
  plan_type text check (plan_type in ('7_days', '15_days', '30_days')) not null,
  start_at timestamptz default now() not null,
  end_at timestamptz not null,
  status text check (status in ('active', 'expired', 'cancelled')) default 'active' not null,
  payment_id uuid references wallet_transactions(id),
  created_at timestamptz default now() not null
);

-- Index for efficient rotation queries (find active promotions)
create index if not exists idx_featured_listings_active 
  on featured_listings(status, end_at) 
  where status = 'active';

-- Index for looking up a specific listing's status
create index if not exists idx_featured_listings_listing_id 
  on featured_listings(listing_id);

-- RLS Policies
alter table featured_listings enable row level security;

-- Policy: Users can see their own
create policy "Users can view their own featured listings"
  on featured_listings for select
  using (auth.uid() = user_id);

-- Policy: Public/Server can see active ones (for rotation logic)
-- Note: Usually public access is via API using service role, but for client-side queries:
create policy "Public can view active featured listings"
  on featured_listings for select
  using (status = 'active' and end_at > now());

-- Policy: Users can insert their own (via API usually, but good to have)
create policy "Users can insert their own featured listings"
  on featured_listings for insert
  with check (auth.uid() = user_id);
