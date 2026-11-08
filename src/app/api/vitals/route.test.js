import { beforeEach, describe, expect, it, vi } from 'vitest';

// RUM-CLS-001 — /api/vitals: 언제나 204(빈 본문) · 0.1 초과 · 맞는 모양만 저장 · 상한은 CSP 보고와 같다(클라이언트 20/분 · 인스턴스 120/분).
const { recordMock } = vi.hoisted(() => ({ recordMock: vi.fn(async () => 'recorded') }));
vi.mock('@/lib/server/errorEvents', async (importOriginal) => ({ ...(await importOriginal()), recordErrorEvent: recordMock }));

import { PER_CLIENT, PER_INSTANCE, POST, VITALS_BODY_LIMIT } from './route';
import * as csp from '../csp-report/route';
import fs from 'node:fs';
import path from 'node:path';

let ip = 0;
const post = (body, { sameIp = null, headers = {} } = {}) => {
  ip += 1;
  return new Request('https://manabi.test/api/vitals', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': sameIp || `10.3.${Math.floor(ip / 250)}.${ip % 250}`, 'user-agent': 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', cookie: 'sb-access-token=secret', ...headers } });
};
const ok = { kind: 'vitals.cls', message: 'cls needs-improvement phone 4g footer.site-footer', stack: 'value=0.2017 t=5899ms', route: '/home', release: 'abc1234' };

beforeEach(() => recordMock.mockClear());

describe('/api/vitals', () => {
  it('맞는 보고는 한 줄 — source client · 브라우저 계열만 더한다(쿠키 · IP 없음)', async () => {
    const res = await POST(post(ok));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(recordMock).toHaveBeenCalledWith({ ...ok, source: 'client', browser: 'safari-mobile' });
    expect(JSON.stringify(recordMock.mock.calls[0][0])).not.toMatch(/10\.3\.|secret/);
  });
  it('0.1 이하 · 틀린 모양 · 큰 본문은 저장하지 않고 204', async () => {
    await POST(post({ ...ok, message: 'cls needs-improvement phone 4g x', stack: 'value=0.0900 t=1ms' }));
    await POST(post('not json'));
    await POST(post({ ...ok, pad: 'x'.repeat(VITALS_BODY_LIMIT) }));
    expect(recordMock).not.toHaveBeenCalled();
  });
  it('상한은 CSP 보고와 같다 — 클라이언트 20/분 · 인스턴스 120/분 · 같은 클라이언트 21번째부터 저장 안 함', async () => {
    expect(PER_CLIENT).toEqual({ limit: 20, windowMs: 60_000 });
    expect(PER_INSTANCE).toEqual({ limit: 120, windowMs: 60_000 });
    const cspSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/csp-report/route.js'), 'utf8');
    expect(cspSrc).toContain('const PER_CLIENT = { limit: 20, windowMs: 60_000 };');
    expect(cspSrc).toContain('const PER_INSTANCE = { limit: 120, windowMs: 60_000 };');
    expect(typeof csp.POST).toBe('function');
    for (let i = 0; i < 25; i++) await POST(post(ok, { sameIp: '10.9.9.9' }));
    expect(recordMock).toHaveBeenCalledTimes(20);
  });
});
