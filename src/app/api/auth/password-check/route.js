/**
 * 유출 비밀번호 확인 중계 (PWNED-PASSWORD-001 — 오너 승인 2026-10-26 KST).
 *
 * 받는 것: SHA-1 앞 5자(hex)뿐 — 비밀번호 · 전체 해시는 우리 서버에도 오지 않는다(src/lib/pwnedPassword.js).
 * 하는 일: HIBP range API에 그 5자를 Add-Padding: true로 물어 접미사 목록을 그대로 돌려준다. 비교는 브라우저가 한다.
 *
 * 브라우저가 HIBP를 바로 부르지 않고 여기를 거치는 이유: 학습자의 IP가 새 제3자(HIBP · Cloudflare)로 가지 않게 —
 * 개인정보 처리방침 §4 「제3자 제공 및 위탁」 목록을 그대로 둔다. 앱에 connect-src CSP는 아직 없지만 생겨도 깨지지 않는다.
 * 기록: 접두사 · IP를 남기지 않는다. 응답은 no-store. 간단한 IP 단위 상한(인스턴스 메모리 — rateLimit.js 주석의 한계 그대로).
 */
import { rateLimit, getClientKey } from '../../../../lib/server/rateLimit';

export const dynamic = 'force-dynamic';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const UPSTREAM_TIMEOUT_MS = 2000;
const MAX_BODY_CHARS = 64;
const PREFIX = /^[0-9A-F]{5}$/;
const NO_STORE = { 'cache-control': 'no-store, max-age=0' };

const fail = (status, error, extra = {}) => Response.json({ error }, { status, headers: { ...NO_STORE, ...extra } });

export async function POST(request) {
  const limit = rateLimit(`pwned:${getClientKey(request)}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return fail(429, 'rate_limited', { 'retry-after': String(Math.ceil(limit.resetIn / 1000)) });

  // 5자 접두사 말고는 받지 않는다 — 큰 본문(비밀번호를 잘못 보낸 경우 포함)은 읽어 해석하지 않고 거절한다.
  let prefix = '';
  try {
    const raw = await request.text();
    if (raw.length <= MAX_BODY_CHARS) prefix = String(JSON.parse(raw)?.prefix ?? '').toUpperCase();
  } catch { prefix = ''; }
  if (!PREFIX.test(prefix)) return fail(400, 'invalid_prefix');

  try {
    const upstream = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'manabi-password-check' },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) return fail(502, 'upstream_unavailable');
    const body = await upstream.text();
    return new Response(body, { status: 200, headers: { ...NO_STORE, 'content-type': 'text/plain; charset=utf-8' } });
  } catch {
    return fail(504, 'upstream_unavailable');
  }
}
