-- Current — schema for all 9 stages.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Every table is scoped to auth.uid() via Row Level Security, so each
-- signed-in user only ever sees their own rows — safe for a single shared
-- deployment.

-- ============ 1. INCOME & CASH FLOW ============
create table if not exists income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  source text not null,
  amount numeric(12,2) not null,
  expected_date date,           -- when it was supposed to land
  received_date date not null,  -- when it actually landed (the "timing" check)
  notes text,
  created_at timestamptz not null default now()
);

-- ============ 2. SPENDING ============
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  amount numeric(12,2) not null,
  category text not null,
  type text not null check (type in ('fixed','variable','discretionary')),
  frequency text not null check (frequency in ('daily','weekly','monthly','quarterly','biannual','annual','one_off')),
  would_spend_again boolean,
  notes text,
  created_at timestamptz not null default now()
);

-- ============ 3. BUDGET ============
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  category text not null,
  month date not null, -- store as first-of-month
  budgeted_amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, category, month)
);

-- ============ 4. EMERGENCY FUND ============
create table if not exists emergency_fund (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid() unique,
  target_amount numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists emergency_fund_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  amount numeric(12,2) not null,
  kind text not null check (kind in ('contribution','withdrawal')),
  notes text,
  created_at timestamptz not null default now()
);

-- ============ 5. SAVINGS ============
create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  kind text not null check (kind in ('goal','sinking_fund')),
  target_amount numeric(12,2),
  current_amount numeric(12,2) not null default 0,
  target_date date,
  created_at timestamptz not null default now()
);

-- ============ 6. DEBT ============
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  balance numeric(12,2) not null,
  interest_rate numeric(5,2), -- percent, e.g. 24.99
  minimum_payment numeric(12,2),
  due_day int, -- day of month, 1-31
  created_at timestamptz not null default now()
);

-- ============ 7. INVESTMENTS & ROI ============
create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  asset_type text not null,
  contributed_amount numeric(12,2) not null,
  contribution_date date not null,
  current_value numeric(12,2),
  created_at timestamptz not null default now()
);

-- ============ 8. NET WORTH ============
create table if not exists net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  total_assets numeric(12,2) not null,
  total_liabilities numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- ============ 9. RECURRING SUBSCRIPTIONS ============
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  amount numeric(12,2) not null,
  billing_cycle text not null check (billing_cycle in ('monthly','quarterly','annual')),
  next_renewal date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ ROW LEVEL SECURITY ============
-- Lock every table to "only my own rows" for both reading and writing.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'income_entries','expenses','budgets','emergency_fund',
    'emergency_fund_transactions','savings_goals','debts',
    'investments','net_worth_snapshots','subscriptions'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "owner_all" on %I;', t);
    execute format(
      'create policy "owner_all" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;
