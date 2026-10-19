-- Order Management: real profit tracking.
-- Run AFTER schema_order_management.sql and schema_om_restocks.sql (Supabase -> SQL Editor -> New query -> paste -> Run).
-- Purely additive: one new nullable column. Existing orders are untouched (their cost is
-- estimated from your Stock in records until you edit them). Safe to run twice.

alter table om_order_items add column if not exists unit_cost_snapshot numeric;
