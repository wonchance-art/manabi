import { cachedCandidate, currentCandidate, readEditionStamp, readRelease, textbookError } from '@/lib/textbook/server';
import { BOOK_ID, BOOKS } from '@/lib/textbook/contract';

// 발행 판본 확인의 정본(GUEST-STATIC-001 3단계에서 bookReading.js에서 떼어 냄) — 이 모듈은 쿠키를 모른다.
// 조회 클라이언트(db)는 부르는 쪽이 고른다: 교재 화면(bookReading.publishedReading)은 쿠키 세션 클라이언트 + 관리자 미리보기,
// 책장(/lessons, ISR)은 쿠키 없는 공개 클라이언트(발행 · 판본 표는 RLS using (true) — 누구에게나 같은 행)다.
// 미리보기(미발행 판본)는 requireAdmin을 넘긴 쪽만 열 수 있다 — 넘기지 않으면 미발행은 늘 404다.
export async function publishedReadingWith(db, editionId, allowPreview = false, bookId = BOOK_ID, requireAdmin = null) {
  const release = await readRelease(db, bookId);
  const id = editionId || release?.edition_id;
  const published = id ? bookId===BOOK_ID ? await readEditionStamp(db, id) : await readEditionStamp(db, id, bookId) : null;
  if (!published) {
    if (!allowPreview || !requireAdmin) throw textbookError(404, '공개된 교재를 준비하고 있어요.');
    const auth = await requireAdmin();
    if (auth.error) throw textbookError(auth.status, auth.error);
  }
  const book = id ? bookId===BOOK_ID ? await cachedCandidate(id) : await cachedCandidate(id,bookId) : await currentCandidate(bookId);
  if (published && (published.content_hash !== book.contentHash || published.artifact_manifest?.bundleHash !== book.artifactManifest.bundleHash)) throw textbookError(503, '교재 판본을 확인하지 못했어요.');
  return { book, preview: !published };
}

export function readingCatalog(book) {
  return {
    id: book.bookId || BOOK_ID,
    bookId: book.bookId || BOOK_ID,
    level: BOOKS[book.bookId || BOOK_ID]?.level,
    edition: book.editionId,
    title: book.manuscript.title,
    subtitle: book.manuscript.subtitle,
    lessons: book.manuscript.lessons.map(({ id, number, part, title, title_ja: titleJa, subtitle, goal, patterns, duration }) => ({ id, number, part, title, titleJa: titleJa || null, subtitle, goal, duration, quote: patterns?.[0]?.examples?.[0] || null })),
    cultures: (book.manuscript.cultures || []).map(({ id, title, lead, after }) => ({ id, title, lead, after })),
  };
}
