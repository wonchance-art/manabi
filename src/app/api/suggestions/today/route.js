import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_suggestions')
    .select('id, language, source, video_id, title, channel_name, thumbnail_url, level, transcript, material_id')
    .eq('date', today)
    .not('transcript', 'is', null)
    .order('language')
    .order('created_at');

  if (error) {
    // 추천은 있으면 좋은 부가 기능 — DB 실패를 클라 콘솔 500으로 흘리지 않고 빈 날과 동일하게 응답
    console.error('[suggestions/today]', error.message);
    return Response.json([], { headers: { 'Cache-Control': 'no-store' } });
  }

  return Response.json(data || [], {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' },
  });
}
