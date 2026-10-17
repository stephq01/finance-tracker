-- Order Management module — a generalized Order/Customer/Payment system
-- that any business can opt into (built for Cozy Culture, but not hard-coded
-- to it — a future business can use it too without rebuilding anything).
--
-- Run this AFTER schema.sql and schema_businesses.sql, the same way:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- SAFE TO RUN on a database with live data: this only ADDS new tables and
-- one new column (with a default) to the existing `businesses` table. It
-- does not touch, rename, or delete anything in businesses, business_products,
-- business_restocks, business_sales, business_deliveries, or any of the
-- personal-finance tables. Every existing Water Business row keeps working
-- exactly as before — it will simply have module = 'simple'.

-- Which "module" a business uses. Existing businesses default to 'simple'
-- (the original Stock/Sales/Deliveries tabs, untouched). A business can opt
-- into 'order_management' for the full Order ID / Customer / Payment system.
alter table businesses add column if not exists module text not null default 'simple'
  check (module in ('simple', 'order_management'));

-- ---------- configuration tables (editable from Settings — nothing below is hard-coded) ----------

create table if not exists om_order_statuses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  sort_order int not null default 0,
  is_default boolean not null default false,
  deducts_stock boolean not null default false,   -- entering this status deducts inventory
  restores_stock boolean not null default false,  -- entering this status restores inventory
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists om_payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists om_expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists om_delivery_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  fee numeric not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists om_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  order_id_prefix text not null default 'OM',
  currency text not null default 'GHS',
  low_stock_default_threshold numeric not null default 3,
  business_phone text,
  whatsapp text,
  instagram text,
  location text,
  updated_at timestamptz not null default now()
);

-- ---------- core entities ----------

create table if not exists om_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  phone text,
  secondary_phone text,
  social_handle text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists om_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  category text,
  description text,
  cost_price numeric,
  is_active boolean not null default true,
  image_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists om_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references om_products(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  size text,
  color text,
  price numeric not null default 0,
  stock_quantity numeric not null default 0,
  low_stock_threshold numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Atomic per-business-per-day counter behind the human-readable order number.
create table if not exists om_order_sequences (
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  seq_date date not null,
  last_seq int not null default 0,
  primary key (business_id, seq_date)
);

create table if not exists om_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  order_number text not null,
  customer_id uuid references om_customers(id) on delete set null,
  status_id uuid references om_order_statuses(id) on delete set null,
  order_date date not null default current_date,
  subtotal numeric not null default 0,
  delivery_method_id uuid references om_delivery_methods(id) on delete set null,
  delivery_fee numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  stock_deducted boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, order_number)
);

create table if not exists om_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references om_orders(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  product_id uuid references om_products(id) on delete set null,
  variant_id uuid references om_product_variants(id) on delete set null,
  -- snapshots: historical orders must NOT change if the product is edited later
  product_name_snapshot text not null,
  size_snapshot text,
  color_snapshot text,
  unit_price_snapshot numeric not null,
  quantity numeric not null default 1,
  line_total numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists om_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  order_id uuid references om_orders(id) on delete set null, -- null = unmatched payment
  amount numeric not null,
  payment_date date not null default current_date,
  method_id uuid references om_payment_methods(id) on delete set null,
  source_account text,
  reference_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists om_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  expense_date date not null default current_date,
  category_id uuid references om_expense_categories(id) on delete set null,
  amount numeric not null,
  description text,
  payment_account text,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists om_inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  variant_id uuid references om_product_variants(id) on delete cascade,
  order_id uuid references om_orders(id) on delete set null,
  change_qty numeric not null, -- negative = deduction, positive = restock/restore
  reason text not null,        -- 'restock' | 'order_deduct' | 'order_restore' | 'adjustment'
  created_at timestamptz not null default now()
);

create table if not exists om_audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  order_id uuid references om_orders(id) on delete cascade,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- ---------- order number generator ----------
-- Atomic (race-safe) even though this is a single-user app: reserves the
-- next sequence number for this business+date in one upsert, so two orders
-- created back-to-back can never get the same number.
create or replace function om_next_order_number(p_business_id uuid, p_prefix text, p_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
  v_datepart text;
begin
  if not exists (select 1 from businesses where id = p_business_id and user_id = auth.uid()) then
    raise exception 'not authorized for this business';
  end if;

  insert into om_order_sequences (business_id, user_id, seq_date, last_seq)
  values (p_business_id, auth.uid(), p_date, 1)
  on conflict (business_id, seq_date)
  do update set last_seq = om_order_sequences.last_seq + 1
  returning last_seq into v_seq;

  v_datepart := to_char(p_date, 'YYMMDD');
  return p_prefix || '-' || v_datepart || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

grant execute on function om_next_order_number(uuid, text, date) to authenticated;

-- RLS -----------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'om_order_statuses','om_payment_methods','om_expense_categories','om_delivery_methods',
    'om_settings','om_customers','om_products','om_product_variants','om_order_sequences',
    'om_orders','om_order_items','om_payments','om_expenses','om_inventory_transactions','om_audit_log'
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
