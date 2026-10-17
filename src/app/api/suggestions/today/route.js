import { createClient } from '@supabase/supabase-js';
import { todaySuggestions } from '@/lib/server/suggestionReading';

// 조회 · 날짜(kstDateString) · on-demand 포함 규칙은 todaySuggestions가 정본이다 — 발견 서가와 같은 함수.
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return Response.json(await todaySuggestions(supabase), { headers: { 'Cache-Control': 'no-store' } });
}
