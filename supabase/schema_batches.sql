-- Lets a Water-style (simple) business record WHICH restock a sale came out of.
-- Optional: if a sale has no restock chosen, the app assigns it to the oldest
-- restock that still has stock left (first in, first out).
-- Additive and safe to run twice. Does not touch any existing data.

alter table business_sales
  add column if not exists restock_id uuid references business_restocks(id) on delete set null;
