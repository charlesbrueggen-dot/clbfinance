-- =============================================
-- Stride Finance - Supabase Database Schema
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

-- =============================================
-- TELLER BANK SYNC (migration: replace_plaid_with_teller, applied 2026-07-06)
-- Replaces the old Plaid integration. Already applied to the live database;
-- kept here so the schema file stays a complete reference.
-- =============================================

-- One row per Teller Connect enrollment (bank login). access_token is used by
-- the backend (service role) to call the Teller API on the user's behalf.
create table if not exists teller_enrollments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  enrollment_id text not null,              -- Teller enrollment id (enr_...)
  access_token text not null,               -- Teller access token (token_...)
  institution_id text,
  institution_name text,
  status text default 'connected' check (status in ('connected', 'disconnected')),
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, enrollment_id)
);
alter table teller_enrollments enable row level security;
create policy "Users can view own teller enrollments"
  on teller_enrollments for select using (auth.uid() = user_id);

-- Teller link columns on accounts
alter table accounts add column if not exists teller_account_id text;
alter table accounts add column if not exists teller_enrollment_id uuid references teller_enrollments(id) on delete set null;
alter table accounts add constraint accounts_user_teller_account_unique unique (user_id, teller_account_id);

-- Teller columns on account_transactions. running_balance is Teller's balance
-- immediately after the transaction posted — account balances are derived from
-- the newest posted transaction instead of Teller's paid Balance endpoint.
alter table account_transactions add column if not exists teller_txn_id text unique;
alter table account_transactions add column if not exists status text default 'posted' check (status in ('posted', 'pending'));
alter table account_transactions add column if not exists running_balance numeric(12,2);
alter table account_transactions drop constraint if exists account_transactions_source_type_check;
alter table account_transactions add constraint account_transactions_source_type_check
  check (source_type = any (array['manual'::text, 'csv_import'::text, 'teller'::text]));

-- =============================================
-- CSV IMPORT DEDUPE (migrations: account_transactions_csv_import_dedupe_index,
-- account_transactions_csv_import_dedupe_constraint_fix; applied 2026-07-16).
-- Already applied to the live database; kept here so the schema file stays a
-- complete reference.
-- =============================================

-- external_id is set by the CSV importer (account + date + kind + amount +
-- normalized description). This unique constraint makes re-uploading the same
-- statement idempotent via upsert(..., { onConflict: 'user_id,external_id' }).
-- Must be a full (non-partial) constraint — PostgREST's upsert ON CONFLICT
-- inference can't target a partial index. Postgres already treats NULLs as
-- distinct in unique constraints, so rows from teller/manual sources (which
-- never set external_id) can still repeat freely without a partial predicate.
alter table account_transactions add constraint account_transactions_user_external_id_key unique (user_id, external_id);
