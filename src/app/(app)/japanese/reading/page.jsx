import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { getReadingTrack, getBunkei } from '@/content/japanese';
import { READING_LANG, readingIdsFromRows } from '@/lib/readingProgress';
import { buildTrackPayload, createPatternCardResolver } from '@/lib/readingPayload';
import ReadingTrackPage from '@/views/ReadingTrackPage';

export const metadata = { title: '도쿄 도착 · 독해 트랙 | Anatomy Studio' };
// 통과 집합이 사용자·시점마다 달라 정적 캐시 불가(review/grammar/page.jsx 관행)
export const dynamic = 'force-dynamic';

/**
 * 독해 트랙 "도쿄 도착"(JA N5 파일럿) 진입 라우트.
 * 콘텐츠(트랙·문형 사전)는 서버에서만 열어 클라이언트 번들에 싣지 않는다
 * — 문형 칩→사전 카드에 필요한 explain·contrast·ex 만 글/드릴에 붙여 내려보낸다.
 *
 * 목록에는 잠금·진도용 메타데이터만 내리고, `?node=`로 선택한 노드 상세 하나만
 * 직렬화한다. 서버 세션의 user_ref_progress rt: 통과 행으로 요청 id 를 검증하므로
 * 잠긴 본문·정답표를 query 조작으로 가져올 수 없다(readingPayload.js 테스트 대상).
 *
 * 관리자 전용 — 비로그인·비관리자는 서버에서 /home으로 리다이렉트한다.
 */
async function fetchReadingScope() {
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
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') return null;

  try {
    const { data } = await supabase
      .from('user_ref_progress')
      .select('slug, read')
      .eq('user_id', user.id)
      .eq('lang', READING_LANG)
      .like('slug', 'rt:%'); // 독해 행만 — 챕터 slug 는 애초에 가져오지 않는다(RT-12)
    return { passedIds: readingIdsFromRows(data), viewerScope: user.id };
  } catch {
    // 관리자 인증 뒤 진행 조회만 실패하면 빈 통과 집합으로 잠금을 유지한다.
    return { passedIds: new Set(), viewerScope: user.id };
  }
}

export default async function Page({ searchParams }) {
  const scope = await fetchReadingScope();
  if (!scope) redirect('/home');
  const { passedIds, viewerScope } = scope;

  const params = await searchParams;
  const selectedId = typeof params?.node === 'string' ? params.node : null;
  const track = getReadingTrack('n5-tokyo');
  if (!track) return <ReadingTrackPage track={null} />;

  // 문형 pattern → 사전 카드(bunkei explain 이관분). 신규 문형 칩 팝오버용.
  const bunkei = getBunkei('N5');
  const cardsFor = createPatternCardResolver(bunkei);

  // 목록 manifest + 서버가 허용한 선택 노드 상세 하나만 직렬화한다.
  return (
    <ReadingTrackPage
      track={buildTrackPayload(track, passedIds, cardsFor, selectedId, viewerScope)}
    />
  );
}
