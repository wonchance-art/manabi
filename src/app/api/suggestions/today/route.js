import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_suggestions')
    .select('id, language, source, video_id, title, channel_name, thumbnail_url, level, transcript')
    .eq('date', today)
    .not('transcript', 'is', null)
    .order('language')
    .order('created_at');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data || [], {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' },
  });
}
