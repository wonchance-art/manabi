// Supabase browser client (cookie-based — SSR compatible)
import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables. Copy .env.example to .env.local and fill in the values.');
}

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
