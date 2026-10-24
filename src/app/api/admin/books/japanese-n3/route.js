import { GET as bookGet, POST as bookPost } from '@/app/api/admin/books/japanese-n5/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) { return bookGet(request, { bookId: 'japanese-n3' }); }
export async function POST(request) { return bookPost(request, { bookId: 'japanese-n3' }); }
