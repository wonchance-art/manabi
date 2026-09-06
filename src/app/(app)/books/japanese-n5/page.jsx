import Link from 'next/link';
import { createSupabaseServerClient, requireAdmin } from '@/lib/supabaseServer';
import { candidate, currentCandidate, readEdition, readRelease } from '@/lib/textbook/server';
import BookReader from '@/components/books/BookReader';

export const dynamic = 'force-dynamic';
export const metadata = { title: '일본어 N5 · 한 권 | manabi' };

export default async function Page({ searchParams }) {
  try {
    const params = await searchParams;
    const db = await createSupabaseServerClient();
    let release = null;
    try { release = await readRelease(db); } catch { /* A private admin preview can precede migration. */ }
    let edition = params?.edition || release?.edition_id;
    let published = null;
    if (edition) {
      try { published = await readEdition(db, edition); } catch { /* Checked below. */ }
    }
    if (!published) {
      const auth = await requireAdmin();
      if (auth.error) return <div className="page-container"><h1>일본어 N5 · 한 권</h1><p>검수를 마친 교재를 곧 만날 수 있어요.</p><Link href="/lessons">교재 목록</Link></div>;
      edition ||= (await currentCandidate()).editionId;
    }
    const book = await candidate(edition);
    if (published && (published.content_hash !== book.contentHash || published.artifact_manifest?.bundleHash !== book.artifactManifest.bundleHash)) throw new Error('Edition mismatch');
    return <BookReader edition={edition} title={book.manuscript.title} preview={!published} pdfEnabled={book.artifactManifest.media?.pdf!==false} lessons={book.manuscript.lessons.map(l => ({id:l.id,number:l.number,title:l.title}))} />;
  } catch {
    return <div className="page-container"><h1>교재를 불러오지 못했어요</h1><p>잠시 후 다시 열어 주세요.</p><Link href="/lessons">교재 목록</Link></div>;
  }
}
