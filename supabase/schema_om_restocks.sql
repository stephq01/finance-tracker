-- Order Management: "Stock in" — clothes you buy from suppliers.
-- Run AFTER schema_order_management.sql, same way (Supabase -> SQL Editor -> New query -> paste -> Run).
-- Purely additive: one new table. Nothing existing is touched. Safe to run twice.

create table if not exists om_restocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) default auth.uid(),
  restock_date date not null default current_date,
  variant_id uuid references om_product_variants(id) on delete set null,
  -- snapshots so the record still reads correctly if the product is renamed or deleted later
  product_name_snapshot text not null,
  size_snapshot text,
  color_snapshot text,
  quantity numeric not null,
  unit_cost numeric not null default 0,
  total_cost numeric generated always as (quantity * unit_cost) stored,
  supplier text,
  amount_paid numeric not null default 0,   -- how much of total_cost you've paid the supplier so far
  notes text,
  created_at timestamptz not null default now()
);

alter table om_restocks enable row level security;
drop policy if exists "owner_all" on om_restocks;
create policy "owner_all" on om_restocks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
