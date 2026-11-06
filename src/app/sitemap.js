// 사이트 지도(LAUNCH-META-001) — 손으로 적은 옛 주소 7개(비공개 /materials · anatomy-studio 기본 주소 · 요청 시각 lastmod)를 걷고,
// 실제 원천에서 공개 화면만 만든다: 지역학 등록부(문서 updated) · 레벨 목록(공개 판정 OPEN_LEVEL_LIST) · 교재 등록부(발행된 책만 — 발행 도장 published_at).
// lastmod는 내용의 날짜만 싣는다(문서 updated · 발행 시각 · 출처 갱신일). 날짜가 없는 화면은 lastmod를 뺀다 — 요청 시각을 넣으면
// 날마다 「바뀜」이라 말해 신호가 무의미해진다. 호스트는 lib/seo canonicalFor 한 곳.
// 비공개 · 앱 전용 화면(ROBOTS_DISALLOW)은 싣지 않는다(계약 seoMeta.test.js). 옛 문법 장(/japanese/grammar/… 등)은 관리자 보관함으로 옮겨
// 손님에게 열리지 않으므로 싣지 않는다(middleware legacyTextbookTarget).
import { DATA_CREDITS_UPDATED } from '@/lib/dataCredits';
import { bookEntries, entry, koreanDate, levelListEntries, studiesEntries } from '@/lib/sitemapEntries';

// 발행은 즉시 무효화가 책장 · 표지만 버린다 — 사이트 지도는 1시간 판(책장 ISR과 같은 주기)으로 따라간다.
export const revalidate = 3600;

export default async function sitemap() {
  return [
    entry('/home'),
    entry('/lessons'),
    ...(await bookEntries()),
    entry('/discover'),
    entry('/discover/classics'),
    ...levelListEntries(),
    ...studiesEntries(),
    entry('/guide'),
    entry('/help'),
    entry('/terms'),
    entry('/privacy'),
    entry('/credits', koreanDate(DATA_CREDITS_UPDATED)),
  ];
}
