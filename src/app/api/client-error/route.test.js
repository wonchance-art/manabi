import { beforeEach, describe, expect, it, vi } from 'vitest';

// ERROR-OBSERVE-001 — /api/client-error: 언제나 204(빈 본문) · 잘못된 입력 · 4KB 초과 · 한도 초과는 저장하지 않는다 ·
// 저장하는 것은 정리된 FIELDS + 출처 · 브라우저 계열뿐(IP · 쿠키 · 본문의 다른 칸 없음) · 저장이 throw해도 204.
const { recordMock } = vi.hoisted(() => ({ recordMock: vi.fn(async () => 'recorded') }));
vi.mock('@/lib/server/errorEvents', async (importOriginal) => ({ ...(await importOriginal()), recordErrorEvent: recordMock }));

import { POST } from './route';

let ip = 0;
function post(body, headers = {}) {
  ip += 1;
  return new Request('https://manabi.test/api/client-error', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${ip % 250}`, 'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', cookie: 'sb-access-token=secret', ...headers },
  });
}
async function expectNoContent(res) {
  expect(res.status).toBe(204);
  expect(await res.text()).toBe('');
  expect(res.headers.get('cache-control')).toBe('no-store');
}

describe('/api/client-error', () => {
  beforeEach(() => { recordMock.mockReset(); recordMock.mockResolvedValue('recorded'); });

  it('정상 입력 → 정리된 칸만 저장(쿼리 없는 경로 · 출처 client · 브라우저 계열) · 204', async () => {
    await expectNoContent(await POST(post({ kind: 'boundary.root', message: 'boom for a@b.co', route: '/viewer/0b9f3c4e-1a2b-4c3d-8e9f-001122334455?x=1',
      release: 'abc1234', digest: '2483459876', body: 'payload', password: 'p', userId: 'u' })));
    expect(recordMock).toHaveBeenCalledTimes(1);
    const [event] = recordMock.mock.calls[0];
    expect(event).toEqual({ kind: 'boundary.root', message: 'boom for [email]', stack: null, digest: '2483459876', route: '/viewer/:id',
      release: 'abc1234', source: 'client', browser: 'safari' });
    expect(JSON.stringify(event)).not.toMatch(/10\.0\.0|secret|payload|password/);
  });

  it.each([
    ['JSON이 아님', 'not json'],
    ['빈 본문', ''],
    ['배열', []],
    ['종류 없음', { message: 'x' }],
    ['메시지 없음', { kind: 'boundary.root' }],
    ['서버 종류 사칭', { kind: 'server.render', message: 'x' }],
    ['틀린 종류 모양', { kind: 'DROP TABLE', message: 'x' }],
  ])('잘못된 입력(%s) → 저장 없이 204', async (_, body) => {
    await expectNoContent(await POST(post(body)));
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('4KB 초과(선언 길이 · 실제 본문 모두) → 읽지 않고 204', async () => {
    await expectNoContent(await POST(post({ kind: 'window.error', message: 'x'.repeat(5000) })));
    await expectNoContent(await POST(post({ kind: 'window.error', message: 'x' }, { 'content-length': '999999' })));
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`{"kind":"window.error","message":"${'y'.repeat(6000)}"}`)); c.close(); } });
    await expectNoContent(await POST(new Request('https://manabi.test/api/client-error', { method: 'POST', body: stream, duplex: 'half', headers: { 'x-forwarded-for': '10.9.9.9' } })));
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('같은 클라이언트 분당 20 — 넘으면 저장 없이 204', async () => {
    const send = () => POST(post({ kind: 'window.error', message: 'flood' }, { 'x-forwarded-for': '10.1.1.1' }));
    for (let i = 0; i < 20; i++) await expectNoContent(await send());
    await expectNoContent(await send());
    expect(recordMock).toHaveBeenCalledTimes(20);
  });

  it('저장이 throw해도 204', async () => {
    recordMock.mockRejectedValueOnce(new Error('db down'));
    await expectNoContent(await POST(post({ kind: 'window.error', message: 'x' })));
  });
});
