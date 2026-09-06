import { notFound } from 'next/navigation';
import { publishedReading, readingCatalog } from '@/lib/server/bookReading';
import BookMaterials from '@/components/books/BookMaterials';
export const dynamic = 'force-dynamic';
export const metadata = { title: '일본어 N5 · 함께 읽기' };
export default async function Page({ searchParams }) {
  const params = await searchParams;
  let book;
  try { book = readingCatalog((await publishedReading(params?.edition)).book); } catch { notFound(); }
  return <BookMaterials book={book} />;
}
