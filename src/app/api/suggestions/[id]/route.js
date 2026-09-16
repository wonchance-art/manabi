import { readSuggestion, suggestionClient } from '@/lib/server/suggestionReading';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const suggestion = await readSuggestion(suggestionClient(), id);
    return Response.json(suggestion || { error: '추천 자료를 찾을 수 없어요.' },
      { status: suggestion ? 200 : 404, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: '자료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
