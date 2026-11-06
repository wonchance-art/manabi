// 브라우저 오류 수신(ERROR-OBSERVE-001) — reportError(src/lib/reportError.js)가 sendBeacon · keepalive fetch로 보낸다.
// 받는 것: JSON 4KB 이하, 칸은 errorEvent.js FIELDS(종류 · 메시지 · 스택 앞부분 · 오류 ID · 경로 · 배포 판)뿐 — 서버에서 다시 정리한다.
// 서버가 더하는 것: source='client', User-Agent의 브라우저 계열 하나(예: safari-mobile). IP는 저장하지 않는다(요청 수 제한의 메모리 열쇠로만,
// 1분 뒤 사라짐). 쿠키 · 인증은 읽지 않는다 — 계정과 잇지 않는다.
// 응답은 언제나 204(빈 본문) — 잘못된 입력 · 한도 초과 · DB 실패도 같다(보내는 쪽이 오류를 또 내지 않게, 수신 여부를 떠보지 못하게).
import { getClientKey, rateLimit } from '@/lib/server/rateLimit';
import { browserFamily, LIMITS, parseClientErrorBody } from '@/lib/errorEvent';
import { readLimited, recordErrorEvent } from '@/lib/server/errorEvents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PER_CLIENT = { limit: 20, windowMs: 60_000 };
const PER_INSTANCE = { limit: 120, windowMs: 60_000 };

const noContent = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

export async function POST(request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > LIMITS.body) return noContent();
    if (!rateLimit(`client-error:${getClientKey(request)}`, PER_CLIENT).ok) return noContent();
    if (!rateLimit('client-error:*', PER_INSTANCE).ok) return noContent();
    const text = await readLimited(request, LIMITS.body);
    if (!text) return noContent();
    let body;
    try { body = JSON.parse(text); } catch { return noContent(); }
    const event = parseClientErrorBody(body);
    if (!event) return noContent();
    await recordErrorEvent({ ...event, source: 'client', browser: browserFamily(request.headers.get('user-agent')) });
  } catch {
    // 수신 경로는 실패를 드러내지 않는다.
  }
  return noContent();
}
