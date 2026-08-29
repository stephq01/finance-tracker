-- Push notification subscriptions — run this once, same way as the others.
-- Each row is one device's subscription; a user can have several (phone +
-- laptop both subscribed).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
drop policy if exists "owner_all" on push_subscriptions;
create policy "owner_all" on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
