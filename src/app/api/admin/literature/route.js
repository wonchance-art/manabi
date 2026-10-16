/**
 * 관리자 정본 문학책 게시 API(AOZORA-P0-2 · P0-3 · P0-4 「분석 → 검수·편집 → 공개」).
 * 처리는 큐레이션 책(/api/admin/art-books)과 같이 쓴다 — 동작·요청·응답 모양은 src/lib/server/bookPublishRoute.js.
 * 정본 = 青空文庫 빌드 산출물(index.generated.js) + Standard Ebooks 빌드 산출물(LIT-SRC-EN-1 — 영어 원작).
 * 게시 가능 판정은 출처별 권리 기록(aozoraRightsPublishable · standardEbooksRightsPublishable · wikisourceRightsPublishable — literatureBookPublishable).
 */
import { LITERATURE_BOOKS } from '@/content/literature/aozora/index.generated.js';
import { STANDARD_EBOOKS_BOOKS } from '@/content/literature/standardebooks/index.generated.js';
import { WIKISOURCE_BOOKS } from '@/content/literature/wikisource/index.generated.js';
import { createBookPublishHandlers } from '@/lib/server/bookPublishRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOOKS = Object.freeze([...LITERATURE_BOOKS, ...STANDARD_EBOOKS_BOOKS, ...WIKISOURCE_BOOKS]);
const handlers = createBookPublishHandlers(() => BOOKS);

export const GET = (request) => handlers.GET(request);
export const POST = (request) => handlers.POST(request);
