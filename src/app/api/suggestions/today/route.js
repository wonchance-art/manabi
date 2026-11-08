import { createClient } from '@supabase/supabase-js';
import { todaySuggestions } from '@/lib/server/suggestionReading';

// 조회 · 날짜(kstDateString) · on-demand 포함 규칙은 todaySuggestions가 정본이다 — 발견 서가와 같은 함수.
// API-ABUSE-001(2026-11-08 KST): 손님이 홈 · 서가에서 부르는 경로라 요청마다 함수 + DB 조회였다(Hobby 함수 호출 한도).
// 쿠키 · 사용자 정보가 없는 같은 바이트이므로 찾은 날(비어 있지 않음)만 CDN에 짧게 둔다. 빈 날(자정 수집 전 · 조회 실패는
// todaySuggestions가 빈 배열로 돌려준다)은 no-store — 막 들어온 추천이 「없음」으로 굳지 않게.
const TODAY_SUGGESTIONS_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const rows = await todaySuggestions(supabase);
  return Response.json(rows, { headers: { 'Cache-Control': rows.length ? TODAY_SUGGESTIONS_CACHE : 'no-store' } });
}
