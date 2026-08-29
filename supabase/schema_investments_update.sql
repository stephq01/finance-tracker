-- Small addition to the investments table — run this once, same way as the
-- others: Supabase → SQL Editor → New query → paste → Run.
-- Adds a way to mark a position as closed/sold, so gains can be split into
-- realized (closed positions) vs. unrealized (still open).
alter table investments add column if not exists is_closed boolean not null default false;
