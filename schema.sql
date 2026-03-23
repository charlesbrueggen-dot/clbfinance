-- =============================================
-- CLB Finance - Supabase Database Schema
-- Run this entire file in your Supabase SQL Editor
-- =============================================

-- INCOME
create table if not exists income (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null,
  amount numeric(12,2) not null,
  date date not null,
  notes text,
  created_at timestamptz default now()
);
alter table income enable row level security;
create policy "Users can manage own income" on income for all using (auth.uid() = user_id);

-- EXPENSES
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null,
  amount numeric(12,2) not null,
  category text not null default 'Needs',
  subcategory text default 'Other',
  date date not null,
  notes text,
  recurring boolean default false,
  created_at timestamptz default now()
);
alter table expenses enable row level security;
create policy "Users can manage own expenses" on expenses for all using (auth.uid() = user_id);

-- ASSETS (for Net Worth)
create table if not exists assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  value numeric(12,2) not null,
  category text default 'Other',
  purchase_date date,
  notes text,
  created_at timestamptz default now()
);
alter table assets enable row level security;
create policy "Users can manage own assets" on assets for all using (auth.uid() = user_id);

-- ACCOUNTS
create table if not exists accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null default 'Checking',
  balance numeric(12,2) default 0,
  institution text,
  notes text,
  created_at timestamptz default now()
);
alter table accounts enable row level security;
create policy "Users can manage own accounts" on accounts for all using (auth.uid() = user_id);

-- INVESTMENTS
create table if not exists investments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  name text,
  type text default 'Stock',
  shares numeric(12,4) not null,
  avg_cost numeric(12,4) not null,
  current_price numeric(12,4),
  portfolio_pct numeric(6,2),
  sector text default 'Other',
  created_at timestamptz default now()
);
alter table investments enable row level security;
create policy "Users can manage own investments" on investments for all using (auth.uid() = user_id);

-- GOALS
create table if not exists goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  target_amount numeric(12,2) not null,
  current_amount numeric(12,2) default 0,
  target_date date,
  category text default 'Other',
  priority text default 'medium',
  created_at timestamptz default now()
);
alter table goals enable row level security;
create policy "Users can manage own goals" on goals for all using (auth.uid() = user_id);

-- LOANS
create table if not exists loans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  person_name text not null,
  type text not null default 'lent',
  amount numeric(12,2) not null,
  interest_rate numeric(6,2) default 0,
  loan_date date not null,
  notes text,
  settled boolean default false,
  created_at timestamptz default now()
);
alter table loans enable row level security;
create policy "Users can manage own loans" on loans for all using (auth.uid() = user_id);
