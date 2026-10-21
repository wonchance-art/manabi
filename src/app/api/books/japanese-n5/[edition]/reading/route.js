import { BOOK_ID, isBookId, isBookPage } from '@/lib/textbook/contract';
import { publishedReading, readingSections } from '@/lib/server/bookReading';
import { respond, respondError, textbookError } from '@/lib/textbook/server';

export const dynamic = 'force-dynamic';
// 공개 판본의 본문은 판본 id + unit이 주소에 든 고정 출력물이고, 응답에 사용자별 값(진도 · 저장 단어 · 계정 · 권한)이 없다.
// 그래서 no-store 대신 「보관은 이 브라우저만, 쓸 때마다 다시 확인」(private, no-cache)으로 둔다 — no-store 응답을 받은 화면은
// 즉시 뒤로가기(bfcache)에 들어가지 못했다(교재 본문, 2026-10-17 KST 실측). 뒷날 사용자 값을 섞게 되면 이 응답이 아니라
// 따로 받는다(bookReadingCache.test.js). 다시 확인은 ETag(원고 해시 · 출력본 해시 + unit) — 같으면 304로 본문을 다시 보내지 않는다.
// 관리자 미리보기(미공개 판본)와 오류는 respond()의 no-store 그대로.
const PUBLISHED_READING_CACHE = 'private, no-cache';
export async function GET(request, { params, bookId = BOOK_ID }) {
  try {
    if (!isBookId(bookId)) throw textbookError(404, '교재를 찾을 수 없어요.');
    const { edition } = await params;
    const { book, preview } = await publishedReading(edition, true, bookId);
    const unit = new URL(request.url).searchParams.get('unit');
    if (!['guide', 'materials', 'reference'].includes(unit) && !(/^u\d{2}$/.test(unit || '') && isBookPage(bookId, unit, { cover: false }))) throw textbookError(400, '읽을 부분을 선택해 주세요.');
    const sections = (await readingSections(book.editionId, bookId)).filter(section => section.unit === unit);
    if (!sections.length) throw textbookError(404, '본문을 찾지 못했어요.');
    const body = { edition: book.editionId, unit, sections };
    if (preview) return respond(body);
    const etag = `"${book.contentHash}.${book.artifactManifest?.bundleHash}.${unit}"`;
    const headers = { 'Cache-Control': PUBLISHED_READING_CACHE, ETag: etag };
    const match = (request.headers.get('if-none-match') || '').split(',').map(tag => tag.trim().replace(/^W\//, ''));
    if (match.includes(etag)) return new Response(null, { status: 304, headers });
    return Response.json(body, { headers });
  } catch (error) { return respondError(error); }
}
