import { cache } from 'react';
import { createSupabaseServerClient, requireAdmin } from '@/lib/supabaseServer';
import { candidate, currentCandidate, readEdition, readRelease, verifiedAsset, textbookError } from '@/lib/textbook/server';
import { extractReadingSections, readingSectionLabel } from '@/lib/bookReadingHtml';

export async function publishedReading(editionId, allowPreview = false) {
  const db = await createSupabaseServerClient();
  const release = await readRelease(db);
  const id = editionId || release?.edition_id;
  const published = id ? await readEdition(db, id) : null;
  if (!published) {
    if (!allowPreview) throw textbookError(404, '공개된 교재를 준비하고 있어요.');
    const auth = await requireAdmin();
    if (auth.error) throw textbookError(auth.status, auth.error);
  }
  const book = id ? await candidate(id) : await currentCandidate();
  if (published && (published.content_hash !== book.contentHash || published.artifact_manifest?.bundleHash !== book.artifactManifest.bundleHash)) throw textbookError(503, '교재 판본을 확인하지 못했어요.');
  return { book, preview: !published };
}

export const readingSections = cache(async (edition) => {
  const book = await candidate(edition);
  const { bytes } = await verifiedAsset(book, 'index.html');
  const sections = extractReadingSections(bytes.toString('utf8'));
  if (!sections.length) throw textbookError(503, '교재 본문을 불러오지 못했어요.');
  return sections.map(section => ({ ...section, title: readingSectionLabel(section, book.pages) }));
});

export function readingCatalog(book) {
  return {
    edition: book.editionId,
    title: book.manuscript.title,
    subtitle: book.manuscript.subtitle,
    lessons: book.manuscript.lessons.map(({ id, number, part, title, subtitle, goal, patterns, duration }) => ({ id, number, part, title, subtitle, goal, duration, quote: patterns?.[0]?.examples?.[0] || null })),
    cultures: book.manuscript.cultures.map(({ id, title, lead, after }) => ({ id, title, lead, after })),
  };
}
