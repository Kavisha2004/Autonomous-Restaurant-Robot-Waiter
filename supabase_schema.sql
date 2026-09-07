-- ==============================================================================
-- Autonomes WaiterBot - Supabase Cloud Database Schema & Realtime Setup
-- Execute this script in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. Create Tables
create table if not exists public.orders (
  id text primary key,
  order_number text,
  table_number int not null,
  customer_name text,
  special_note text,
  items jsonb default '[]'::jsonb,
  subtotal numeric default 0,
  tax numeric default 0,
  total numeric default 0,
  status text not null default 'new',
  timeline jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tables_status (
  id int primary key,
  name text not null,
  status text not null default 'empty',
  active_order_id text,
  customer_name text,
  last_updated timestamptz default now()
);

create table if not exists public.robot_state (
  id int primary key default 1,
  status text not null default 'idle',
  target_table int,
  active_order_id text,
  battery int default 98,
  is_charging boolean default false,
  barrier_detected boolean default false,
  speed numeric default 0.8,
  current_pos jsonb default '{"x": 12, "y": 50}'::jsonb,
  logs jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.feedbacks (
  id text primary key,
  table_number int not null,
  customer_name text,
  food_rating int not null default 5,
  robot_rating int not null default 5,
  tags jsonb default '[]'::jsonb,
  comment text,
  created_at timestamptz default now()
);

-- 2. Seed Initial Restaurant & Robot Data (if empty)
insert into public.tables_status (id, name, status, customer_name, active_order_id)
values 
  (1, 'Table 1', 'empty', '', null),
  (2, 'Table 2', 'empty', '', null),
  (3, 'Table 3', 'empty', '', null),
  (4, 'Table 4', 'empty', '', null)
on conflict (id) do nothing;

insert into public.robot_state (id, status, target_table, battery, barrier_detected, current_pos, logs)
values (
  1, 
  'idle', 
  null, 
  98, 
  false, 
  '{"x": 12, "y": 50}'::jsonb, 
  '[{"time": "12:00:00 PM", "msg": "Autonomous WaiterBot online and docked at Kitchen Base station.", "type": "success"}]'::jsonb
)
on conflict (id) do nothing;

insert into public.feedbacks (id, table_number, customer_name, food_rating, robot_rating, tags, comment, created_at)
values 
  (
    'fb_demo_1', 
    2, 
    'Kasun & Sanduni', 
    5, 
    5, 
    '["🚀 Fast Robot Delivery", "🍱 Hot & Fresh Food", "🤖 Loved the Robot"]'::jsonb, 
    'Amazing automated service! The robot arrived smoothly right by our table without spilling a drop.',
    now() - interval '1 hour'
  ),
  (
    'fb_demo_2', 
    3, 
    'Dr. Perera', 
    5, 
    4, 
    '["✨ Great Atmosphere", "👌 Friendly Service"]'::jsonb, 
    'Very impressive robotics project demonstration. The ramen was delicious and piping hot.',
    now() - interval '2 hours'
  )
on conflict (id) do nothing;

-- 3. Enable Row Level Security (RLS) & Public Policies for Demo Web Application
alter table public.orders enable row level security;
alter table public.tables_status enable row level security;
alter table public.robot_state enable row level security;
alter table public.feedbacks enable row level security;

-- Drop previous policies if re-running
drop policy if exists "Allow public read/write on orders" on public.orders;
drop policy if exists "Allow public read/write on tables_status" on public.tables_status;
drop policy if exists "Allow public read/write on robot_state" on public.robot_state;
drop policy if exists "Allow public read/write on feedbacks" on public.feedbacks;

create policy "Allow public read/write on orders" on public.orders for all using (true) with check (true);
create policy "Allow public read/write on tables_status" on public.tables_status for all using (true) with check (true);
create policy "Allow public read/write on robot_state" on public.robot_state for all using (true) with check (true);
create policy "Allow public read/write on feedbacks" on public.feedbacks for all using (true) with check (true);

-- 4. Enable Realtime Publications for all 4 tables
-- In Supabase, postgres_changes listeners require the tables to be part of the supabase_realtime publication.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tables_status') then
    alter publication supabase_realtime add table public.tables_status;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'robot_state') then
    alter publication supabase_realtime add table public.robot_state;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feedbacks') then
    alter publication supabase_realtime add table public.feedbacks;
  end if;
end $$;
