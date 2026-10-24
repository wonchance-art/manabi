import { GET as bookGet } from '@/app/api/books/japanese-n5/[edition]/reading/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  return bookGet(request, { params, bookId: 'japanese-n3' });
}
