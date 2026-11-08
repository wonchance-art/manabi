// 실사용자 화면 밀림 수신(RUM-CLS-001) — src/lib/clsReport.js(installClsReporter)가 0.1을 넘는 방문만 sendBeacon · keepalive fetch로 보낸다.
// 다시 검사(parseClsBody — 0.1 이하 · 모양 틀림은 버림)한 한 줄을 운영 오류 기록(observe.error_events)에 source='client' · kind='vitals.cls'로 남긴다.
// 상한은 CSP 보고(/api/csp-report)와 같다: 클라이언트 20/분 · 인스턴스 120/분 · 본문 1KB, DB 쪽 같은 밀림 한 시간 한 줄 · 새 줄 분당 30 · 하루 1000 · 30일 보관.
// 응답은 언제나 204(빈 본문). 쿠키 · 인증은 읽지 않고 IP는 저장하지 않는다(요청 수 제한의 메모리 열쇠로만).
import { getClientKey, rateLimit } from '@/lib/server/rateLimit';
import { browserFamily } from '@/lib/errorEvent';
import { parseClsBody } from '@/lib/clsReport';
import { readLimited, recordErrorEvent } from '@/lib/server/errorEvents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const VITALS_BODY_LIMIT = 1024;
export const PER_CLIENT = Object.freeze({ limit: 20, windowMs: 60_000 });
export const PER_INSTANCE = Object.freeze({ limit: 120, windowMs: 60_000 });

const noContent = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

export async function POST(request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > VITALS_BODY_LIMIT) return noContent();
    if (!rateLimit(`vitals:${getClientKey(request)}`, PER_CLIENT).ok) return noContent();
    if (!rateLimit('vitals:*', PER_INSTANCE).ok) return noContent();
    const text = await readLimited(request, VITALS_BODY_LIMIT);
    if (!text) return noContent();
    let body;
    try { body = JSON.parse(text); } catch { return noContent(); }
    const event = parseClsBody(body);
    if (!event) return noContent();
    await recordErrorEvent({ ...event, source: 'client', browser: browserFamily(request.headers.get('user-agent')) });
  } catch {
    // 수신 경로는 실패를 드러내지 않는다.
  }
  return noContent();
}
