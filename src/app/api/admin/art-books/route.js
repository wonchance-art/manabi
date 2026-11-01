/**
 * 관리자 「그림 한 장 읽기」 큐레이션 책 게시 API(ART-P0-3) — 정본 문학책과 같은 「준비 → 분석 → 검수 → 공개」.
 * 처리는 /api/admin/literature와 같이 쓴다 — 동작·요청·응답 모양은 src/lib/server/bookPublishRoute.js.
 * 정본 = 카탈로그(src/content/art) → artBooks(). 게시 가능 판정은 카탈로그 대조(artBookPublishable — 원문·해시·라이선스).
 */
import { artBooks } from '@/lib/artBook';
import { createBookPublishHandlers } from '@/lib/server/bookPublishRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 책은 요청마다 카탈로그에서 만든다(작품 여덟 점 — 가볍다). 깨진 카탈로그면 createArtBook이 throw해 게시가 막힌다.
// publishBooksOf('art')와 같은 값이다 — publishBooks.js를 거치지 않는 것은 정본 문학책 장 원문(85권 · 약 34MB)이 이 함수에
// 같이 실리지 않게 하려는 것이다(BUILD-OOM-001 — 파일 추적이 literatureBooks.js의 읽기 경로를 따라간다).
const handlers = createBookPublishHandlers(() => artBooks(), {
  notPublishableError: '출처·라이선스 기록이 공개 기준을 통과하지 못한 책이에요.',
});

export const GET = (request) => handlers.GET(request);
export const POST = (request) => handlers.POST(request);
