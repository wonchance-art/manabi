import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getReadingTrack, getBunkei } from '@/content/japanese';
import { READING_LANG, readingIdsFromRows } from '@/lib/readingProgress';
import { buildTrackPayload } from '@/lib/readingPayload';
import ReadingTrackPage from '@/views/ReadingTrackPage';

export const metadata = { title: '도쿄 도착 · 독해 트랙 | Anatomy Studio' };
// 통과 집합이 사용자·시점마다 달라 정적 캐시 불가(review/grammar/page.jsx 관행)
export const dynamic = 'force-dynamic';

/**
 * 독해 트랙 "도쿄 도착"(JA N5 파일럿) 진입 라우트.
 * 콘텐츠(트랙·문형 사전)는 서버에서만 열어 클라이언트 번들에 싣지 않는다
 * — 문형 칩→사전 카드에 필요한 explain·contrast·ex 만 글/드릴에 붙여 내려보낸다.
 *
 * 정답표 노출 최소화(P2-7 최소분): 순차 잠금은 클라이언트 UX 경계일 뿐이라
 * 트랙 전체를 내리면 잠긴 글의 answer·why 까지 응답에 실린다. 서버 세션으로
 * user_ref_progress 의 rt: 통과 행을 읽어, 열린 노드까지만 문항을 포함한다
 * (스트립 규칙·근거는 src/lib/readingPayload.js — 순수 함수로 테스트 대상).
 *
 * admin 게이트 없음 — 일반 사용자 공개 라우트(파일럿 라벨만).
 */
async function fetchPassedIds() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return new Set(); // 게스트 — order 1(+그 위치 드릴)만 열린다
    const { data } = await supabase
      .from('user_ref_progress')
      .select('slug, read')
      .eq('user_id', user.id)
      .eq('lang', READING_LANG)
      .like('slug', 'rt:%'); // 독해 행만 — 챕터 slug 는 애초에 가져오지 않는다(RT-12)
    return readingIdsFromRows(data);
  } catch {
    // 조회 실패는 게스트 취급 — 정답표 과다 노출보다 과소 노출(잠금)이 안전하고,
    // 클라이언트의 스트립 회복 UI(재조회)가 일시 장애를 흡수한다.
    return new Set();
  }
}

export default async function Page() {
  const track = getReadingTrack('n5-tokyo');
  if (!track) return <ReadingTrackPage track={null} />;

  // 문형 pattern → 사전 카드(bunkei explain 이관분). 신규 문형 칩 팝오버용.
  const bunkei = getBunkei('N5');
  const cardByPattern = new Map();
  for (const th of bunkei?.themes || []) {
    for (const it of th.items) {
      cardByPattern.set(it.pattern, {
        pattern: it.pattern,
        ko: it.ko || '',
        explain: it.explain || '',
        contrast: it.contrast || '',
        ex: it.ex || null,
      });
    }
  }
  const cardsFor = (patterns) => (patterns || []).map((p) => cardByPattern.get(p)).filter(Boolean);

  // 직렬화 가능한 경량 페이로드 — 통과 집합 기준으로 잠긴 노드의 문항을 스트립
  const passedIds = await fetchPassedIds();
  return <ReadingTrackPage track={buildTrackPayload(track, passedIds, cardsFor)} />;
}
