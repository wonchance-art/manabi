import { cache } from 'react';
import { createSupabaseServerClient, requireAdmin } from '@/lib/supabaseServer';
import { cachedCandidate, currentCandidate, readEditionStamp, readRelease, verifiedReadingHtml, textbookError } from '@/lib/textbook/server';
import { BOOK_ID, BOOKS } from '@/lib/textbook/contract';
import { extractReadingSections, readingSectionLabel } from '@/lib/bookReadingHtml';

export async function publishedReading(editionId, allowPreview = false, bookId = BOOK_ID) {
  const db = await createSupabaseServerClient();
  const release = await readRelease(db, bookId);
  const id = editionId || release?.edition_id;
  const published = id ? bookId===BOOK_ID ? await readEditionStamp(db, id) : await readEditionStamp(db, id, bookId) : null;
  if (!published) {
    if (!allowPreview) throw textbookError(404, '공개된 교재를 준비하고 있어요.');
    const auth = await requireAdmin();
    if (auth.error) throw textbookError(auth.status, auth.error);
  }
  const book = id ? await cachedCandidate(id,bookId) : await currentCandidate(bookId);
  if (published && (published.content_hash !== book.contentHash || published.artifact_manifest?.bundleHash !== book.artifactManifest.bundleHash)) throw textbookError(503, '교재 판본을 확인하지 못했어요.');
  return { book, preview: !published };
}

const sectionsByEdition = new Map();
export const readingSections = cache((edition,bookId=BOOK_ID) => {
  const key=`${bookId}:${edition}`;
  if(!sectionsByEdition.has(key)){
    const pending=buildReadingSections(edition,bookId);
    sectionsByEdition.set(key,pending);
    pending.catch(()=>sectionsByEdition.delete(key));
  }
  return sectionsByEdition.get(key);
});

async function buildReadingSections(edition,bookId) {
  const book = await cachedCandidate(edition,bookId);
  const { bytes } = await verifiedReadingHtml(book);
  const sections = extractReadingSections(bytes.toString('utf8'));
  if (!sections.length) throw textbookError(503, '교재 본문을 불러오지 못했어요.');
  return sections.map(section => ({ ...section, title: readingSectionLabel(section, book.pages) }));
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
