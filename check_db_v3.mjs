import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jdtowtxhexcweuxawrds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qSe245OfO4EyU7SQxgqSSA_qsMPRlLr';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDb() {
  const { data: materials } = await supabase.from('reading_materials').select('*');
  console.log("MATERIALS:", JSON.stringify(materials, null, 2));

  const { data: posts } = await supabase.from('forum_posts').select('*');
  console.log("POSTS:", JSON.stringify(posts, null, 2));
}

checkDb();
