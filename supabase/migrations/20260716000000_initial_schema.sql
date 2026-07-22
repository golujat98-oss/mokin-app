-- Supabase Schema Migration: Mookin Smart Booking & Business Manager
-- Created: 2026-07-16

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE (linked to auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  business_name text,
  business_logo_url text,
  business_address text,
  gst_number text,
  language text default 'en',
  theme text default 'system',
  quick_lock_pin text, -- hashed soft lock PIN
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- 2. CUSTOM PROGRAMS / CATEGORIES TABLE
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade not null,
  name text not null,
  icon text,
  created_at timestamptz default now()
);

alter table public.programs enable row level security;

-- Policies for programs
create policy "Users can perform all actions on own programs" on public.programs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 3. CUSTOMERS TABLE
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade not null,
  name text not null,
  mobile_number text not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.customers enable row level security;

-- Policies for customers
create policy "Users can perform all actions on own customers" on public.customers
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 4. BOOKINGS TABLE
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade not null,
  customer_id uuid references public.customers on delete set null,
  customer_name text not null,
  mobile_number text not null,
  program_id uuid references public.programs on delete set null,
  program_name_snapshot text,
  event_date date not null,
  start_time time,
  end_time time,
  venue_address text,
  maps_link text,
  guest_count int,
  total_amount numeric(12,2) default 0.00,
  advance_amount numeric(12,2) default 0.00,
  remaining_amount numeric(12,2) generated always as (total_amount - advance_amount) stored,
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes text,
  items jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

alter table public.bookings enable row level security;

-- Policies for bookings
create policy "Users can perform all actions on own bookings" on public.bookings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 5. INVENTORY TABLE
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text,
  quantity int default 1,
  status text default 'available' check (status in ('available', 'in_use', 'maintenance', 'retired')),
  notes text,
  created_at timestamptz default now()
);

alter table public.inventory enable row level security;

-- Policies for inventory
create policy "Users can perform all actions on own inventory" on public.inventory
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 6. EXPENSES TABLE
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade not null,
  description text not null,
  category text,
  amount numeric(12,2) not null,
  expense_date date not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

-- Policies for expenses
create policy "Users can perform all actions on own expenses" on public.expenses
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 7. TRIGGER: AUTO-CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, business_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', 'My Business')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
