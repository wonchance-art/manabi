// Supabase browser client (cookie-based — SSR compatible)
import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = 'https://jdtowtxhexcweuxawrds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qSe245OfO4EyU7SQxgqSSA_qsMPRlLr';

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
