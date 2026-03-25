import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '/Users/chaeyeon/Desktop/web/.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: materials } = await supabase.from('reading_materials').select('*');
  console.log("MATERIALS:", JSON.stringify(materials, null, 2));

  const { data: posts } = await supabase.from('forum_posts').select('*');
  console.log("POSTS:", JSON.stringify(posts, null, 2));
}

run();
