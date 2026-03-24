// Supabase client singleton
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jdtowtxhexcweuxawrds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qSe245OfO4EyU7SQxgqSSA_qsMPRlLr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
