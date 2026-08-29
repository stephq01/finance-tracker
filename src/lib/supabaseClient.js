import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Loud on purpose: this is the #1 setup mistake (forgetting .env or the
  // Vercel env vars), and a silent failure here just looks like a blank app.
  console.error(
    'Missing Supabase env vars. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'to a .env file locally, and to your Vercel project settings when you deploy.'
  )
}

export const supabase = createClient(url, anonKey)
