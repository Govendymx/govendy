-- Migration to create category_requests table
-- Run this in Supabase SQL Editor

create table if not exists category_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  category_name text not null,
  gender text not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

alter table category_requests enable row level security;

-- Policy for users to insert their own requests
create policy "Users can insert their own requests"
  on category_requests for insert
  with check (auth.uid() = user_id);

-- Policy for admins to view all requests
create policy "Admins can view all requests"
  on category_requests for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );
