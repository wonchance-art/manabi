/**
 * 관리자 정본 문학책 게시 API(AOZORA-P0-2 · P0-3 · P0-4 「분석 → 검수·편집 → 공개」).
 * 처리는 큐레이션 책(/api/admin/art-books)과 같이 쓴다 — 동작·요청·응답 모양은 src/lib/server/bookPublishRoute.js.
 * 정본 = 青空文庫 빌드 산출물(index.generated.js). 게시 가능 판정은 권리 기록(aozoraRightsPublishable).
 */
import { LITERATURE_BOOKS } from '@/content/literature/aozora/index.generated.js';
import { createBookPublishHandlers } from '@/lib/server/bookPublishRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = createBookPublishHandlers(() => LITERATURE_BOOKS);

export const GET = (request) => handlers.GET(request);
export const POST = (request) => handlers.POST(request);
