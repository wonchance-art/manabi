import { cache } from 'react';
import { createSupabaseServerClient, requireAdmin } from '@/lib/supabaseServer';
import { cachedCandidate, verifiedReadingHtml, textbookError } from '@/lib/textbook/server';
import { BOOK_ID } from '@/lib/textbook/contract';
import { extractReadingSections, readingSectionLabel } from '@/lib/bookReadingHtml';
import { publishedReadingWith, readingCatalog } from '@/lib/server/publishedBook';

// 판본 확인은 publishedBook.js가 정본이다(쿠키를 모르는 모듈 — 책장 ISR이 같은 함수를 공개 클라이언트로 쓴다, GUEST-STATIC-001 3단계).
// 교재 화면은 쿠키 세션 클라이언트 + 관리자 미리보기(?edition=<미발행>)를 넘긴다 — 미리보기 응답은 계정별이라 이 화면들은 동적이다.
export async function publishedReading(editionId, allowPreview = false, bookId = BOOK_ID) {
  return publishedReadingWith(await createSupabaseServerClient(), editionId, allowPreview, bookId, requireAdmin);
}
export { readingCatalog };

// 판본 본문은 인스턴스 안에서 책+판본당 한 번 만든다. 실패는 담지 않는다.
const sectionsByEdition = new Map();
export const readingSections = cache((edition,bookId=BOOK_ID) => {
  const key=`${bookId}:${edition}`;
  if(!sectionsByEdition.has(key)){
    const pending=bookId===BOOK_ID?buildReadingSections(edition):buildBookReadingSections(edition,bookId);
    sectionsByEdition.set(key,pending);
    pending.catch(()=>sectionsByEdition.delete(key));
  }
  return sectionsByEdition.get(key);
});

async function buildReadingSections(edition) {
  return buildBookReadingSections(edition,BOOK_ID);
}

async function buildBookReadingSections(edition,bookId) {
  const book = await cachedCandidate(edition,bookId);
  const { bytes } = await verifiedReadingHtml(book);
  const sections = extractReadingSections(bytes.toString('utf8'));
  if (!sections.length) throw textbookError(503, '교재 본문을 불러오지 못했어요.');
  return sections.map(section => ({ ...section, title: readingSectionLabel(section, book.pages) }));
}
