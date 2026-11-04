// Supabase browser client implementation.
// Keep this module behind src/lib/supabase.js so the SDK is not part of the
// synchronous app shell. The first auth/data/realtime operation loads it once.
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_PUBLIC_KEY_NAMES, supabasePublicKey } from './supabaseKeys';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = supabasePublicKey();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(`Missing NEXT_PUBLIC_SUPABASE_URL or ${SUPABASE_PUBLIC_KEY_NAMES} environment variables. Copy .env.example to .env.local and fill in the values.`);
}

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
