import { publishedReading, readingSections } from '@/lib/server/bookReading';
import { respond, respondError, textbookError } from '@/lib/textbook/server';

export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  try {
    const { edition } = await params;
    const { book } = await publishedReading(edition, true);
    const unit = new URL(request.url).searchParams.get('unit');
    if (!/^(u(0[1-9]|[1-3][0-9]|4[0-2])|guide|materials|reference)$/.test(unit || '')) throw textbookError(400, '읽을 부분을 선택해 주세요.');
    const sections = (await readingSections(book.editionId)).filter(section => section.unit === unit);
    if (!sections.length) throw textbookError(404, '본문을 찾지 못했어요.');
    return respond({ edition: book.editionId, unit, sections });
  } catch (error) { return respondError(error); }
}
