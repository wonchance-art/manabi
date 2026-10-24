import DiscoverTiles from '@/components/web/DiscoverTiles';
import Link from 'next/link';
import { SERIES_TITLE_ILIKE } from '@/lib/constants';
import { kstDateString } from '@/lib/growthStats';
import { releasedArtOf, releasedClassicsOf } from '@/lib/server/classicsReading';
import { suggestionClient, todaySuggestions } from '@/lib/server/suggestionReading';
// 산책(쿼리 없음)은 ISR 5분이다(GUEST-STATIC-001 2단계 — 오너 「권장대로」 2026-10-23 KST, 신선도 최대 5분 수용). 누구에게나 같은 바이트다:
// 조회는 전부 쿠키 없는 anon 클라이언트(suggestionClient)이고 계정 데이터가 없다. 이 파일은 쿠키 · 헤더 · searchParams를 읽지 않는다
// (src/lib/__tests__/staticSegments.test.js · 빌드 대조 scripts/check-static-routes.mjs).
// 갈래는 middleware가 나눈다(src/middleware.js): 「함께 읽는 글」(?view=reading)은 /discover/reading(동적 — 고르기 줄 세션 힌트),
// 간체 힌트 쿠키가 있으면 /discover/sc(이 화면 + 간체 스타일시트 미리 걸기, 역시 ISR). 주소창은 늘 /discover다.
export const revalidate = 300;
export const metadata = { title: '산책', description: '오늘 화제 · 고전 명작 · 여행 매거진 — 누구나 읽는 읽을거리.', alternates: { canonical: '/discover' } };
export default async function Page() {
  // 지역학은 발견에서 내렸다(오너 「지역학 치워버려 지우진 말고」 2026-10-16 KST) — /studies 경로 · 콘텐츠는 그대로다.
  // 큰 칸 셋(DISCOVER-CLASSICS-001, 오너 「권장대로 ㄱㄱ」 2026-10-22 KST): 오늘 화제 · 고전 명작 · 여행 매거진. 「일본어 N5 · 문화 읽기」는
  // 산책에서 내렸다(교재 화면 /books/japanese-n5/materials에 그대로 있다).
  const client = suggestionClient();
  const [suggestions, classicsShelf, artShelf, looseCount, bookChapterCount] = await Promise.all([
    todaySuggestions(client),
    releasedClassicsOf(client),
    releasedArtOf(client),
    client.from('reading_materials').select('id', { count: 'exact', head: true }).eq('visibility', 'public')
      .not('title', 'ilike', SERIES_TITLE_ILIKE) // 목록(/discover?view=reading)과 같은 조건으로 센다
      .then(({ count, error }) => (error ? 0 : count || 0)),
    // 비로그인(anon)은 책 장 행을 못 센다(anon_book_chapters_hidden, #1504) — 목록이 책 카드를 채우는 것과 같은
    // public_book_catalog로 책 장을 따로 더한다. 안 더하면 정본 책 공개 뒤 「함께 읽는 글」 줄이 사라진다(리뷰 2026-10-17 KST).
    // 개수만 받는다(head) — 행을 받으면 장마다 책 · 문학 메타가 붙어 정본 공개 뒤 요청마다 MB 단위가 되고 1000행에서 잘린다(리뷰 2026-10-17 KST).
    client.rpc('public_book_catalog', {}, { count: 'exact', head: true }).not('title', 'ilike', SERIES_TITLE_ILIKE)
      .then(({ count, error }) => (error ? 0 : count || 0)),
  ]);
  // ISR은 그린 판을 5분 동안 모두에게 준다 — 서가 조회가 실패한 판을 굳히지 않는다. 다시 만들 때(revalidate) 실패면 던져서 앞 판을 그대로 둔다
  // (Next는 실패한 재생성 대신 직전 판을 계속 준다). 빌드 때는 던지지 않는다 — 빌드가 DB에 묶이지 않게, 첫 판은 다음 재생성이 고친다.
  if ((classicsShelf.failed || artShelf.failed) && process.env.NEXT_PHASE !== 'phase-production-build') throw new Error('discover_shelf_unavailable');
  const classics = classicsShelf.items, art = artShelf.items;
  const publicCount = looseCount + bookChapterCount;
  return <div className="manabi-page manabi-discover"><header className="manabi-page-heading"><h1>산책</h1></header>
    <DiscoverTiles suggestions={suggestions} classics={classics} art={art} date={kstDateString()} />
    {publicCount > 0 && <p className="discover-more"><Link className="manabi-link" href="/discover?view=reading">함께 읽는 글 {publicCount.toLocaleString()}편 <span aria-hidden="true">→</span></Link></p>}
  </div>;
}
