// CSP 위반 보고 수신(SEC-HEADERS-001) — next.config.mjs의 Content-Security-Policy-Report-Only가 report-uri · report-to(Reporting-Endpoints)로 보낸다.
// 정리(lib/cspReport)한 줄만 운영 오류 기록(observe.error_events — ERROR-OBSERVE-001)에 source='client' · kind='csp.<지시어>'로 남긴다.
// 응답은 언제나 204(빈 본문) — 잘못된 입력 · 한도 초과 · DB 실패도 같다(/api/client-error와 같은 원칙). 쿠키 · 인증은 읽지 않는다.
import { getClientKey, rateLimit } from '@/lib/server/rateLimit';
import { browserFamily } from '@/lib/errorEvent';
import { parseCspReportBody } from '@/lib/cspReport';
import { readLimited, recordErrorEvent } from '@/lib/server/errorEvents';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const CSP_BODY_LIMIT = 16384;
const PER_CLIENT = { limit: 20, windowMs: 60_000 };
const PER_INSTANCE = { limit: 120, windowMs: 60_000 };

const noContent = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

export async function POST(request) {
  try {
    if (Number(request.headers.get('content-length') || 0) > CSP_BODY_LIMIT) return noContent();
    if (!rateLimit(`csp-report:${getClientKey(request)}`, PER_CLIENT).ok) return noContent();
    if (!rateLimit('csp-report:*', PER_INSTANCE).ok) return noContent();
    const text = await readLimited(request, CSP_BODY_LIMIT);
    if (!text) return noContent();
    let body;
    try { body = JSON.parse(text); } catch { return noContent(); }
    const browser = browserFamily(request.headers.get('user-agent'));
    const release = process.env.NEXT_PUBLIC_BUILD_SHA || null;
    for (const event of parseCspReportBody(body)) {
      await recordErrorEvent({ ...event, source: 'client', release, browser });
    }
  } catch {
    // 수신 경로는 실패를 드러내지 않는다.
  }
  return noContent();
}
