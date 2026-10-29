import { cache } from 'react';
import { cachedCandidate, currentCandidate, readEditionStamp, readRelease, textbookError, verifiedReadingHtml } from '@/lib/textbook/server';
import { BOOK_ID, BOOKS } from '@/lib/textbook/contract';
import { extractReadingSections, readingSectionLabel } from '@/lib/bookReadingHtml';
import { createSupabasePublicClient } from '@/lib/supabaseServer';

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

/**
 * 발행 판본만(미리보기 없음) — 쿠키 없는 공개 클라이언트로 읽는다. 공유 캐시에 맡기는 판(배움 · 교재 표지, GUEST-STATIC-001 4단계)이 쓴다.
 * 판을 다시 만들 때(revalidate) 발행이 아닌 이유(503 · 연결)로 실패하면 던져 직전 판을 둔다(Next는 실패한 재생성 대신 앞 판을 계속 준다).
 * 「아직 발행 안 함」(404)은 실패가 아니라 그 상태다 — null. 빌드 때는 던지지 않는다(빌드가 DB에 묶이지 않게, 첫 판은 다음 재생성 · 발행 무효화가 고친다).
 */
export async function publishedOrNull(load) {
  try { return await load(createSupabasePublicClient()); } catch (error) {
    if (error?.status !== 404 && process.env.NEXT_PHASE !== 'phase-production-build') throw error;
    return null;
  }
}

// 판본 본문은 인스턴스 안에서 책+판본당 한 번 만든다. 실패는 담지 않는다(bookReading.js에서 옮김 — 쿠키를 모르는 모듈이라 ISR 판도 쓴다).
const sectionsByEdition = new Map();
export const readingSections = cache((edition, bookId = BOOK_ID) => {
  const key = `${bookId}:${edition}`;
  if (!sectionsByEdition.has(key)) {
    const pending = buildReadingSections(edition, bookId);
    sectionsByEdition.set(key, pending);
    pending.catch(() => sectionsByEdition.delete(key));
  }
  return sectionsByEdition.get(key);
});

async function buildReadingSections(edition, bookId) {
  const book = await cachedCandidate(edition, bookId);
  const { bytes } = await verifiedReadingHtml(book);
  const sections = extractReadingSections(bytes.toString('utf8'));
  if (!sections.length) throw textbookError(503, '교재 본문을 불러오지 못했어요.');
  return sections.map(section => ({ ...section, title: readingSectionLabel(section, book.pages) }));
}
