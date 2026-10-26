// PWNED-PASSWORD-001 (2026-10-26 KST) — 유출 비밀번호 확인 중계 라우트. 실제 HIBP는 부르지 않는다(fetch 가짜).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock('../../../../../lib/server/rateLimit', () => ({ rateLimit: mocks.limit, getClientKey: () => 'ip:fixture' }));
import { POST } from '../route';

const request = body => new Request('http://localhost/api/auth/password-check', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const RANGE = '1E4C9B93F3F0682250B6CF8331B7EE68FD8:10434004\r\n0018A45C4D1DEF81644B54AB7F969B88D65:0';
let fetchMock;

beforeEach(() => {
  mocks.limit.mockReset().mockReturnValue({ ok: true, remaining: 19, resetIn: 60_000 });
  fetchMock = vi.fn(async () => new Response(RANGE, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('/api/auth/password-check', () => {
  it('앞 5자만 HIBP range 주소에 싣고 Add-Padding: true를 보낸다 — 응답은 그대로 · no-store', async () => {
    const res = await POST(request({ prefix: '5baa6' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(await res.text()).toBe(RANGE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.pwnedpasswords.com/range/5BAA6');
    expect(new Headers(init.headers).get('add-padding')).toBe('true');
    expect(init.cache).toBe('no-store');
    expect(init.body).toBeUndefined();
  });

  it('5자 hex가 아니면(전체 해시 · 비밀번호 · 큰 본문 포함) HIBP를 부르지 않고 400', async () => {
    for (const body of [
      { prefix: '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8' },
      { prefix: '5BAA' },
      { prefix: 'ZZZZZ' },
      { password: 'password' },
      {},
      'not json',
      JSON.stringify({ prefix: '5BAA6', pad: 'x'.repeat(200) }),
    ]) expect((await POST(request(body))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('HIBP 오류 · 시간 초과는 5xx(브라우저는 막지 않는다)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    expect((await POST(request({ prefix: '5BAA6' }))).status).toBe(502);
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'));
    const res = await POST(request({ prefix: '5BAA6' }));
    expect(res.status).toBe(504);
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
  });

  it('상한을 넘으면 HIBP를 부르지 않고 429', async () => {
    mocks.limit.mockReturnValue({ ok: false, remaining: 0, resetIn: 30_000 });
    const res = await POST(request({ prefix: '5BAA6' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
