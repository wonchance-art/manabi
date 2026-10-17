import { cache } from 'react';
import { createSupabaseServerClient, requireAdmin } from '@/lib/supabaseServer';
import { cachedCandidate, currentCandidate, readEditionStamp, readRelease, verifiedReadingHtml, textbookError } from '@/lib/textbook/server';
import { extractReadingSections, readingSectionLabel } from '@/lib/bookReadingHtml';

export async function publishedReading(editionId, allowPreview = false) {
  const db = await createSupabaseServerClient();
  const release = await readRelease(db);
  const id = editionId || release?.edition_id;
  const published = id ? await readEditionStamp(db, id) : null;
  if (!published) {
    if (!allowPreview) throw textbookError(404, '공개된 교재를 준비하고 있어요.');
    const auth = await requireAdmin();
    if (auth.error) throw textbookError(auth.status, auth.error);
  }
  const book = id ? await cachedCandidate(id) : await currentCandidate();
  if (published && (published.content_hash !== book.contentHash || published.artifact_manifest?.bundleHash !== book.artifactManifest.bundleHash)) throw textbookError(503, '교재 판본을 확인하지 못했어요.');
  return { book, preview: !published };
}

// 판본 본문 장 목록 — 판본이 고정이라 인스턴스 안에서 판본당 한 번 만든다(1.4MB HTML 읽기 · 해시 · 추출). 실패는 담지 않는다.
const sectionsByEdition = new Map();
export const readingSections = cache((edition) => {
  if (!sectionsByEdition.has(edition)) {
    const pending = buildReadingSections(edition);
    sectionsByEdition.set(edition, pending);
    pending.catch(() => sectionsByEdition.delete(edition));
  }
  return sectionsByEdition.get(edition);
});

async function buildReadingSections(edition) {
  const book = await cachedCandidate(edition);
  const { bytes } = await verifiedReadingHtml(book);
  const sections = extractReadingSections(bytes.toString('utf8'));
  if (!sections.length) throw textbookError(503, '교재 본문을 불러오지 못했어요.');
  return sections.map(section => ({ ...section, title: readingSectionLabel(section, book.pages) }));
}

export function readingCatalog(book) {
  return {
    edition: book.editionId,
    title: book.manuscript.title,
    subtitle: book.manuscript.subtitle,
    lessons: book.manuscript.lessons.map(({ id, number, part, title, title_ja: titleJa, subtitle, goal, patterns, duration }) => ({ id, number, part, title, titleJa: titleJa || null, subtitle, goal, duration, quote: patterns?.[0]?.examples?.[0] || null })),
    cultures: book.manuscript.cultures.map(({ id, title, lead, after }) => ({ id, title, lead, after })),
  };
}
