# Current — personal finance tracker

Nine stages, one app: income & cash flow, spending, budget, emergency fund,
savings, debt, investments & ROI, net worth, subscriptions.

## Stack
- React + Vite + Tailwind CSS v4
- Supabase (Postgres + Auth) — free tier
- Vercel — free hosting, auto-deploys from GitHub

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase project's URL and anon key (Supabase dashboard → Project Settings → API).
3. In the Supabase dashboard → SQL Editor, paste and run `supabase/schema.sql` once, then paste and run `supabase/schema_businesses.sql` once (adds the Businesses module: products, restocks, sales, deliveries).
4. In Supabase → Authentication → Providers, make sure Email is enabled. For a fast personal setup, you can also turn off "Confirm email" under Authentication → Settings so sign-up doesn't require clicking an email link.
5. `npm run dev` — opens at localhost.

## Deploying (free)
1. Push this repo to your own GitHub.
2. Vercel → New Project → import the repo.
3. Add the same two env vars from your `.env` in Vercel's project settings (Environment Variables).
4. Deploy. Vercel gives you a free `.vercel.app` link that works from any phone or laptop browser.

## Status
Built so far: shell, auth, nav for all 9 finance stages, **Income & cash flow** fully working.
Also built: **Businesses module** — add any business, track products/stock with restock alerts,
log sales with payment method and paid/owed status, log deliveries. Use this for the water
resale business (Belaqua, Eden) and any future one (joggers, bread, digital products, etc.).
Remaining 8 finance stages are wired into navigation as placeholders — built one at a time next.
