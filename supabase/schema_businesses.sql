-- "Businesses" module — run this AFTER schema.sql, same way: Supabase
-- dashboard → SQL Editor → New query → paste → Run.
-- Generalized so any business (water resale, joggers, bread, digital
-- products, whatever comes next) uses the same four tables.

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  category text,
  color text not null default 'income',  -- one of the accent tokens in index.css
  icon text not null default 'Store',    -- a lucide-react icon name
  created_at timestamptz not null default now()
);

create table if not exists business_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  restock_cycle_days int,       -- roughly how often this needs restocking
  low_stock_threshold numeric not null default 3,
  created_at timestamptz not null default now()
);

create table if not exists business_restocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  product_id uuid references business_products(id) on delete set null,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  quantity numeric not null,
  cost_amount numeric,
  supplier_paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists business_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  product_id uuid references business_products(id) on delete set null,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  customer_name text not null,
  customer_location text,       -- room number, address, whatever fits the business
  quantity numeric,
  payment_method text check (payment_method in ('momo','telecash','cash','other')),
  amount_charged numeric not null default 0,
  amount_paid numeric not null default 0,
  comments text,
  created_at timestamptz not null default now()
);

create table if not exists business_deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  period text not null check (period in ('daily','weekly')),
  status text not null check (status in ('pending','completed')) default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'businesses','business_products','business_restocks',
    'business_sales','business_deliveries'
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
