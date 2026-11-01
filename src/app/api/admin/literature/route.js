/**
 * 관리자 정본 문학책 게시 API(AOZORA-P0-2 · P0-3 · P0-4 「분석 → 검수·편집 → 공개」).
 * 처리는 큐레이션 책(/api/admin/art-books)과 같이 쓴다 — 동작·요청·응답 모양은 src/lib/server/bookPublishRoute.js.
 * 정본 = 青空文庫 · Standard Ebooks(LIT-SRC-EN-1) · 위키문헌 · 전자책 사이트 빌드 산출물(작품 폴더 chapters.json — 서버가 읽는다, src/lib/server/literatureBooks.js).
 * 게시 가능 판정은 출처별 권리 기록(aozoraRightsPublishable · standardEbooksRightsPublishable · wikisourceRightsPublishable — literatureBookPublishable).
 */
import { publishBooksOf } from '@/lib/server/publishBooks';
import { createBookPublishHandlers } from '@/lib/server/bookPublishRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 목록 · 「모두 게시 · 분석」 대기열 차례 = 공개 차례(언어를 번갈아 대표작 먼저) — 목록은 서버 분석 작업과 같이 쓴다(publishBooks.js).
// 책 하나만 쓰는 요청은 keys로 좁혀 그 책 원문만 읽는다(BUILD-OOM-001).
const handlers = createBookPublishHandlers((keys) => publishBooksOf('literature', keys));

export const GET = (request) => handlers.GET(request);
export const POST = (request) => handlers.POST(request);
