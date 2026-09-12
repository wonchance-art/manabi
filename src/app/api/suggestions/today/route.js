import { createClient } from '@supabase/supabase-js';
import { kstDateString } from '@/lib/growthStats';
import { ONDEMAND_SOURCE } from '@/lib/suggestionSources';
import { SUGGESTION_FIELDS, canReadSuggestion, suggestionSource } from '@/lib/suggestionReading';
import { publicSuggestionTargets } from '@/lib/server/suggestionReading';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  // KST 날짜 정본 — 수집 크론과 같은 함수(UTC 날짜를 쓰면 KST 아침부터 빈 카드가 된다)
  const today = kstDateString();

  const { data, error } = await supabase
    .from('daily_suggestions')
    .select(SUGGESTION_FIELDS)
    .eq('date', today)
    // 본문이 있는 글 소스 **또는** 클릭 시점 반입 영상(transcript는 NULL이 정상).
    // 이 줄이 `.not(transcript, is, null)` 하나였을 때 영상 카드가 통째로 안 보였다.
    .or(`transcript.not.is.null,material_id.not.is.null,source.eq.${ONDEMAND_SOURCE}`)
    .order('language')
    .order('created_at');

  if (error) {
    // 추천은 있으면 좋은 부가 기능 — DB 실패를 클라 콘솔 500으로 흘리지 않고 빈 날과 동일하게 응답
    console.error('[suggestions/today]', error.message);
    return Response.json([], { headers: { 'Cache-Control': 'no-store' } });
  }

  const readings = await publicSuggestionTargets(supabase, data || []);
  return Response.json(readings.filter(s => canReadSuggestion(s) || suggestionSource(s).kind === 'video'), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
