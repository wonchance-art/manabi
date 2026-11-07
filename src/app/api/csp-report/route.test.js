import { beforeEach, describe, expect, it, vi } from 'vitest';

// SEC-HEADERS-001 — /api/csp-report: 언제나 204(빈 본문) · 두 보고 모양(report-uri · Reporting API)을 정리된 줄로만 저장 ·
// 저장하는 것은 kind csp.<지시어> · 「지시어 처리: 막힌 것의 출처」 · 경로 틀 · 브라우저 계열(전체 주소 · 쿼리 · sample · IP · 쿠키 없음).
const { recordMock } = vi.hoisted(() => ({ recordMock: vi.fn(async () => 'recorded') }));
vi.mock('@/lib/server/errorEvents', async (importOriginal) => ({ ...(await importOriginal()), recordErrorEvent: recordMock }));

import { CSP_BODY_LIMIT, POST } from './route';
import { CSP_DIRECTIVES, MAX_REPORTS_PER_BODY, blockedOf, directiveOf, parseCspReportBody } from '@/lib/cspReport';

let ip = 0;
function post(body, headers = {}) {
  ip += 1;
  return new Request('https://manabi.test/api/csp-report', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/csp-report', 'x-forwarded-for': `10.2.0.${ip % 250}`, 'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', cookie: 'sb-access-token=secret', ...headers },
  });
}
async function expectNoContent(res) {
  expect(res.status).toBe(204);
  expect(await res.text()).toBe('');
  expect(res.headers.get('cache-control')).toBe('no-store');
}

const legacy = {
  'csp-report': {
    'document-uri': 'https://manabi.co.kr/viewer/12345?token=abc#x',
    'violated-directive': "form-action 'self'",
    'effective-directive': 'form-action',
    'blocked-uri': 'https://evil.example/collect?email=a@b.co',
    'script-sample': 'secret-sample',
    disposition: 'report',
  },
};
const modern = [
  { type: 'csp-violation', url: 'https://manabi.co.kr/notes', body: { documentURL: 'https://manabi.co.kr/notes', effectiveDirective: 'object-src', blockedURL: 'data', sample: 'x', disposition: 'report' } },
  { type: 'deprecation', body: { id: 'x' } },
];

describe('/api/csp-report', () => {
  beforeEach(() => { recordMock.mockReset(); recordMock.mockResolvedValue('recorded'); });

  it('report-uri 모양 → 정리된 한 줄(출처만 · 경로 틀) · 204', async () => {
    await expectNoContent(await POST(post(legacy)));
    expect(recordMock).toHaveBeenCalledTimes(1);
    const [event] = recordMock.mock.calls[0];
    expect(event).toMatchObject({ kind: 'csp.form-action', message: 'form-action report: https://evil.example', route: '/viewer/:id', source: 'client', browser: 'safari' });
    expect(JSON.stringify(event)).not.toMatch(/token|collect|a@b|secret|10\.2\.0/);
  });

  it('Reporting API 모양(배열) → csp-violation만 · 204', async () => {
    await expectNoContent(await POST(post(modern, { 'content-type': 'application/reports+json' })));
    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock.mock.calls[0][0]).toMatchObject({ kind: 'csp.object-src', message: 'object-src report: data', route: '/notes' });
  });

  it.each([
    ['JSON이 아님', 'nope'],
    ['빈 본문', ''],
    ['모르는 모양', { hello: 1 }],
    ['우리 정책 밖 지시어(require-trusted-types-for)', { 'csp-report': { 'effective-directive': 'require-trusted-types-for', 'blocked-uri': 'trusted-types-sink' } }],
    ['csp-violation 아닌 보고만', [{ type: 'deprecation', body: {} }]],
  ])('저장하지 않는다(%s) → 204', async (_, body) => {
    await expectNoContent(await POST(post(body)));
    expect(recordMock).not.toHaveBeenCalled();
  });

  it(`본문 ${CSP_BODY_LIMIT}바이트 초과 → 읽지 않고 204`, async () => {
    await expectNoContent(await POST(post({ 'csp-report': { 'effective-directive': 'base-uri', 'blocked-uri': 'x'.repeat(CSP_BODY_LIMIT) } })));
    await expectNoContent(await POST(post(legacy, { 'content-length': String(CSP_BODY_LIMIT + 1) })));
    expect(recordMock).not.toHaveBeenCalled();
  });

  it('같은 클라이언트 분당 20 — 넘으면 저장 없이 204', async () => {
    for (let i = 0; i < 25; i += 1) await expectNoContent(await POST(post(legacy, { 'x-forwarded-for': '10.3.3.3' })));
    expect(recordMock).toHaveBeenCalledTimes(20);
  });

  it('저장이 throw해도 204', async () => {
    recordMock.mockRejectedValueOnce(new Error('db down'));
    await expectNoContent(await POST(post(legacy)));
  });
});

describe('lib/cspReport', () => {
  it('지시어 — 우리 정책의 지시어 · 세분 이름만, 옛 violated-directive의 값은 뗀다', () => {
    for (const name of ['object-src', 'base-uri', 'frame-ancestors', 'form-action', 'script-src-elem', 'style-src-attr', 'connect-src', 'frame-src']) expect(CSP_DIRECTIVES).toContain(name);
    expect(directiveOf("base-uri 'self'")).toBe('base-uri');
    expect(directiveOf('script-src-elem')).toBe('script-src-elem');
    expect(directiveOf("img-src 'self' data: blob:")).toBe('img-src');
    expect(directiveOf('require-trusted-types-for')).toBeNull(); // 우리 정책 밖 — 버린다
    expect(directiveOf('sandbox')).toBeNull();
  });

  it('막힌 것 — 출처 · 낱말만', () => {
    expect(blockedOf('https://a.example:8443/p?q=1')).toBe('https://a.example:8443');
    expect(blockedOf('inline')).toBe('inline');
    expect(blockedOf('data:')).toBe('data');
    expect(blockedOf('chrome-extension://abcdef/x.js')).toBe('chrome-extension');
    expect(blockedOf('')).toBe('none');
    expect(blockedOf('???')).toBe('other');
  });

  it(`같은 줄은 하나로 · 한 본문 최대 ${MAX_REPORTS_PER_BODY}줄`, () => {
    const same = Array.from({ length: 4 }, () => modern[0]);
    expect(parseCspReportBody(same)).toHaveLength(1);
    const many = Array.from({ length: 20 }, (_, i) => ({ type: 'csp-violation', body: { effectiveDirective: 'form-action', blockedURL: `https://h${i}.example/`, documentURL: 'https://manabi.co.kr/' } }));
    expect(parseCspReportBody(many)).toHaveLength(MAX_REPORTS_PER_BODY);
  });
});
