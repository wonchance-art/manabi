import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jdtowtxhexcweuxawrds.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qSe245OfO4EyU7SQxgqSSA_qsMPRlLr';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDb() {
  const { data: materials } = await supabase.from('reading_materials').select('title');
  materials.forEach(m => {
    if (m.title && (m.title.toLowerCase().includes('sprint') || m.title.includes('준비중'))) {
      console.log("MATCH IN MATERIALS:", m.title);
    }
  });

  const { data: posts } = await supabase.from('forum_posts').select('content');
  posts.forEach(p => {
    if (p.content && (p.content.toLowerCase().includes('sprint') || p.content.includes('준비중'))) {
      console.log("MATCH IN POSTS:", p.content);
    }
  });
  console.log("DB CHECK COMPLETE");
}

checkDb();
