import { notFound } from 'next/navigation';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
import BookReview from '@/components/books/BookReview';
export const dynamic = 'force-dynamic';
export const metadata = { title: '일본어 N5 · 담은 표현', robots: { index: false, follow: false } };
export default async function Page({ searchParams }) {
  const params = await searchParams;
  let book, preview;
  try { const reading = await publishedReading(params?.edition, true); book = readingCatalog(reading.book); preview = reading.preview; } catch { notFound(); }
  return <BookReview book={book} preview={preview} />;
}
