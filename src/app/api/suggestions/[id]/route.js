import { readSuggestion, suggestionClient } from '@/lib/server/suggestionReading';

// 추천 읽을거리 한 편은 누구에게나 같은 바이트다 — 쿠키 없는 anon 클라이언트(suggestionClient)로 공개 행만 읽는다
// (publicSuggestionTargets가 남의 비공개 자료를 가리키는 링크를 지운다). 그래서 찾은 글(200)만 공유 캐시(CDN)에 5분 맡긴다(GUEST-STATIC-001).
// 행은 수집 크론(KST 자정)만 쓰고, 바뀌는 것은 연결 자료의 처리 완료 여부뿐이라 5분 + 갱신 중 옛 사본 1시간이면 충분하다.
// 없음(404) · 실패(503)는 캐시하지 않는다 — 막 들어온 글이 「없음」으로 굳거나 일시 장애가 5분 남지 않게.
// 쿠키 · 요청 헤더를 읽지 않는다(계약 src/lib/__tests__/guestStaticSuggestion.test.js · PUBLIC-CACHE-COOKIE-001).
const PUBLIC_SUGGESTION_CACHE = 'public, s-maxage=300, stale-while-revalidate=3600';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const suggestion = await readSuggestion(suggestionClient(), id);
    return Response.json(suggestion || { error: '추천 자료를 찾을 수 없어요.' },
      { status: suggestion ? 200 : 404, headers: { 'Cache-Control': suggestion ? PUBLIC_SUGGESTION_CACHE : 'no-store' } });
  } catch {
    return Response.json({ error: '자료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
