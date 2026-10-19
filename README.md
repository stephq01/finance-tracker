# Current — personal finance tracker

Nine stages, one app: income & cash flow, spending, budget, emergency fund,
savings, debt, investments & ROI, net worth, subscriptions. Plus a
Businesses module for side businesses (simple stock/sales, or full
order management for Cozy Culture-style businesses).

## Stack
- React + Vite + Tailwind CSS v4
- Supabase (Postgres + Auth) — free tier
- Vercel — free hosting, auto-deploys from GitHub
- Web Push (VAPID) for real notifications, even when the app is closed

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase project's URL, anon key, and VAPID public key.
3. In the Supabase dashboard → SQL Editor, run these files **in this order**, each once:
   1. `supabase/schema.sql` — the 9 finance stages
   2. `supabase/schema_businesses.sql` — Businesses module (simple stock/sales/deliveries, e.g. Water Business)
   3. `supabase/schema_investments_update.sql`
   4. `supabase/schema_push.sql` — push notification subscriptions
   5. `supabase/schema_order_management.sql` — **new**: the Order Management module (Cozy Culture). Safe to run any time — it only adds new tables plus one new column (`module`) to `businesses`; it does not touch any existing Water Business or Personal Finance data.
   6. `supabase/schema_om_restocks.sql` — **new**: lets Cozy Culture log stock bought from suppliers (quantity, size, cost, what you've paid the supplier). Additive, safe to run twice.
   7. `supabase/schema_om_profit.sql` — **new**: saves what each piece cost at the time of sale so Cozy Culture can show real gross/net profit. One nullable column; safe to run twice. (The app still works if you haven't run it yet, but profit will be estimated.)
4. In Supabase → Authentication → Providers, make sure Email is enabled. For a fast personal setup, you can also turn off "Confirm email" under Authentication → Settings so sign-up doesn't require clicking an email link.
5. `npm run dev` — opens at localhost.

## Deploying (free)
1. Push this repo to your own GitHub.
2. Vercel → New Project → import the repo.
3. Add the same env vars from your `.env` in Vercel's project settings (Environment Variables) — as **Config** type, not Secret.
4. Deploy. Vercel gives you a free `.vercel.app` link that works from any phone or laptop browser.

## Status

**All 9 finance stages are built**: Income & cash flow (with net cash flow view, monthly history, inline editing), Spending (with category breakdown by year/month, autocomplete, inline editing), Budget (category matching is now case/whitespace-insensitive, with autocomplete), Emergency Fund, Savings, Debt, Investments, Net Worth, Subscriptions.

**Businesses module**: every business you add is either —
- **Simple stock & sales** — products/stock with restock alerts, sales log (payment method, paid/owed), deliveries. This is what Water Business uses, untouched.
- **Order management** — built for Cozy Culture. Per-order auto-generated Order IDs (`CC-YYMMDD-###`, unique per day, never reused), a reusable customer database, products with size/color variants and their own stock, configurable order statuses/payment methods/expense categories/delivery methods, partial & overpayment handling, inventory deduction tied to order status, a dashboard, and — the core problem this was built to solve — a **Payments → Unmatched Payments** screen: log money that lands in the business wallet with no useful reference, then search and link it to the right order afterwards, no dependence on the customer typing anything useful into their payment note.

Businesses can also be deleted from the Businesses page now (with a confirmation, since it also removes that business's products/sales/deliveries or orders/customers/payments).

Real push notifications are live: a daily stock/restock alert and a daily spending-log reminder (Supabase Edge Functions + Cron).

### Latest additions
- **Overview page** (the landing page): one screen summarising all nine stages plus businesses, with a "needs attention" list.
- **Editing everywhere**: every entry on every finance tab, plus Water Business products/restocks/sales/deliveries, and Cozy Culture products, customers, stock-in entries and **orders** (items, prices, delivery, discount, customer, notes — stock and the audit timeline stay in step).
- **Cozy Culture profit**: Revenue − cost of goods = gross profit, − expenses = net profit, with warnings wherever a cost is estimated or unknown.

### Still to come
CSV/export and a dedicated Reports screen; the daily spending-reminder push notification needs diagnosing.
