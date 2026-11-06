import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserFamily, buildErrorEvent, FIELDS, LIMITS, parseClientErrorBody, sanitizeRoute, scrubStack, scrubText } from '../errorEvent';
import { CLIENT_ERROR_ENDPOINT, installGlobalErrorHooks, isNoiseError, reportError, sendErrorEvent } from '../reportError';

// ERROR-OBSERVE-001 — 운영 오류 기록(브라우저 · 서버 → observe.error_events, 30일). Vercel Hobby 런타임 로그는 1시간뿐이라
// 오류 화면의 「오류 ID」(digest)를 다음 날 찾을 수 없었다. 계약: ⑴ 오류 화면 여섯 곳 · 루트 Providers가 reportError를 거친다(화면 무변화)
// ⑵ 정리기 — 쿼리 제거 · 길이 상한 · 토큰 · 이메일 · ID · 사용자 글 모양 지우기 · FIELDS 밖 칸은 어떤 입력이든 버린다
// ⑶ 보내기 — sendBeacon 먼저 · keepalive fetch 대체 · 한 화면 중복 · 상한 · 절대 throw 없음 ⑷ 마이그레이션 접근 행렬(정적 — 동적은 PGlite CI).
const ROOT = path.resolve(__dirname, '../../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const BOUNDARIES = {
  'src/app/error.jsx': 'boundary.root',
  'src/app/global-error.jsx': 'boundary.global',
  'src/app/(app)/home/error.jsx': 'boundary.home',
  'src/app/(app)/pdf/[id]/error.jsx': 'boundary.pdf',
  'src/app/(app)/viewer/error.jsx': 'boundary.viewer',
  'src/app/(app)/vocab/error.jsx': 'boundary.vocab',
};

const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
  const rel = `${dir}/${entry.name}`;
  return entry.isDirectory() ? walk(rel) : [rel];
});

describe('⑴ 오류 화면 · 루트가 reportError를 거친다', () => {
  it('src/app의 error · global-error 파일은 모두 위 표에 있다(새 오류 화면도 기록을 잇는다)', () => {
    const found = walk('src/app').filter((f) => /\/(?:global-)?error\.jsx?$/.test(f)).sort();
    expect(found).toEqual(Object.keys(BOUNDARIES).sort());
  });

  it.each(Object.entries(BOUNDARIES))('%s → reportError(error, { kind: %s }) · 콘솔 직접 기록 없음', (file, kind) => {
    const src = read(file);
    expect(src).toContain("import { reportError } from '@/lib/reportError';");
    expect(src).toContain(`reportError(error, { kind: '${kind}' })`);
    expect(src).not.toMatch(/console\.error\(/);
  });

  it('화면 무변화: 오류 화면의 「오류 ID」 표시 · 안내 문구는 그대로다(기록은 효과 안에서만)', () => {
    expect(read('src/app/error.jsx')).toContain('오류 ID: {error.digest}');
    expect(read('src/app/global-error.jsx')).toContain('오류 ID: {error.digest}');
    expect(read('src/app/(app)/pdf/[id]/error.jsx')).toContain('오류 ID: {error.digest}');
    for (const file of Object.keys(BOUNDARIES)) {
      const effect = read(file).match(/useEffect\(\(\) => \{[\s\S]*?\}, \[error\]\);/)?.[0] || '';
      expect(effect, file).toContain('reportError(error');
    }
  });

  it('루트 Providers가 전역 오류 고리를 효과 안에서 건다(서버 렌더 · 정적 판에서는 돌지 않는다)', () => {
    const src = read('src/app/providers.jsx');
    expect(src).toContain("import { installGlobalErrorHooks } from '@/lib/reportError';");
    expect(src).toContain('useEffect(() => { installGlobalErrorHooks(); }, []);');
    expect(read('src/app/layout.jsx')).toContain("import Providers from './providers';");
  });
});

describe('⑵ 정리기(errorEvent.js)', () => {
  it('경로: 쿼리 · 조각 · 출처를 떼고, ID · 비ASCII · 인코딩 칸은 자리표로', () => {
    expect(sanitizeRoute('/viewer/0b9f3c4e-1a2b-4c3d-8e9f-001122334455?token=abc#x')).toBe('/viewer/:id');
    expect(sanitizeRoute('https://manabi.app/dict/%E9%A3%9F%E3%81%B9%E3%82%8B?q=1')).toBe('/dict/:x');
    expect(sanitizeRoute('/vocab/食べる')).toBe('/vocab/:x');
    expect(sanitizeRoute('/materials/12345')).toBe('/materials/:id');
    expect(sanitizeRoute('/viewer/[id]')).toBe('/viewer/[id]');
    expect(sanitizeRoute('/(app)/home')).toBe('/(app)/home');
    expect(sanitizeRoute('relative/path')).toBeNull();
    expect(sanitizeRoute('/' + 'a/'.repeat(300)).length).toBeLessThanOrEqual(LIMITS.route);
  });

  it('메시지: 주소 쿼리 · 토큰 · 이메일 · UUID · 긴 숫자 · 사용자 글 모양 따옴표를 지우고 500자로 자른다', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const text = scrubText(`fetch https://x.supabase.co/rest/v1/user_vocabulary?select=*&user_id=eq.abc failed for me@example.com `
      + `token ${jwt} Bearer sb_secret_abcdef id 0b9f3c4e-1a2b-4c3d-8e9f-001122334455 phone 01012345678 `
      + `Unexpected token 'h', "hello 私の日記" is not valid JSON at /api/x?secret=1 (reading 'id')`, LIMITS.message);
    expect(text).toContain('https://x.supabase.co/rest/v1/user_vocabulary failed');
    expect(text).not.toMatch(/select=|user_id=eq|secret=1|me@example\.com|eyJ|sb_secret|0b9f3c4e|01012345678|hello|私/);
    expect(text).toContain('[email]');
    expect(text).toContain('"…"');
    expect(text).toContain("(reading 'id')");
    expect(text).toContain('/api/x');
    expect(scrubText('ab '.repeat(1000), LIMITS.message)).toHaveLength(500);
  });

  it('스택: 프레임 6줄 · 출처 제거 · 쿼리 제거 · 줄:열 번호는 남김 · 1000자', () => {
    const stack = ['TypeError: boom secret-in-message',
      ...Array.from({ length: 12 }, (_, i) => `    at fn${i} (https://manabi.app/_next/static/chunks/app/page-abc.js?dpl=dpl_123:1:1234567)`)].join('\n');
    const out = scrubStack(stack);
    expect(out.split('\n')).toHaveLength(LIMITS.stackLines);
    expect(out).not.toContain('secret-in-message');
    expect(out).not.toContain('manabi.app');
    expect(out).not.toContain('dpl=');
    expect(out).toContain('/_next/static/chunks/app/page-abc.js');
    expect(out).toContain(':1:1234567');
    expect(scrubStack(`E\n${'at x (/a.js:1:1)'.padEnd(900, 'y')}\n${'at x (/a.js:1:1)'.padEnd(900, 'y')}`).length).toBeLessThanOrEqual(LIMITS.stack);
  });

  it('칸은 FIELDS뿐 — 본문 · 입력 · 토큰 · 계정 칸은 어떤 입력이든 버린다', () => {
    const event = parseClientErrorBody({ kind: 'boundary.root', message: 'boom', route: '/home?x=1', release: 'abc1234', digest: '2483459876',
      body: 'request body', input: '사용자 입력', password: 'p', token: 't', userId: 'u', email: 'a@b.c', ip: '1.2.3.4', cookies: 'sb=…', extra: { a: 1 } });
    expect(Object.keys(event).sort()).toEqual([...FIELDS].sort());
    expect(event).toEqual({ kind: 'boundary.root', message: 'boom', stack: null, digest: '2483459876', route: '/home', release: 'abc1234' });
  });

  it('모양 검사: 종류 · 메시지 없으면 null, 서버 종류는 브라우저가 못 쓴다, 틀린 digest · 판은 비운다', () => {
    expect(parseClientErrorBody(null)).toBeNull();
    expect(parseClientErrorBody([])).toBeNull();
    expect(parseClientErrorBody({ kind: 'boundary.root' })).toBeNull();
    expect(parseClientErrorBody({ kind: 'server.render', message: 'spoof' })).toBeNull();
    expect(parseClientErrorBody({ kind: 'Boundary Root', message: 'x' })).toBeNull();
    expect(parseClientErrorBody({ kind: 'window.error', message: 1 })).toBeNull();
    const e = parseClientErrorBody({ kind: 'window.error', message: 'x', digest: 'not a digest!', release: 'NOT-SHA' });
    expect([e.digest, e.release]).toEqual([null, null]);
    expect(buildErrorEvent({ kind: 'window.error', error: Object.assign(new TypeError('bad'), { digest: 'abc' }) }))
      .toMatchObject({ message: 'TypeError: bad', digest: 'abc' });
  });

  it('브라우저 계열: 판 · 기기 · 운영체제 없이 이름 하나(+ -mobile), 로봇은 bot', () => {
    expect(browserFamily('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('safari-mobile');
    expect(browserFamily('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')).toBe('chrome');
    expect(browserFamily('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130 Safari/537.36 Edg/130.0')).toBe('edge');
    expect(browserFamily('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe('bot');
    expect(browserFamily('')).toBeNull();
    expect(browserFamily(undefined)).toBeNull();
  });

  it('옛 Safari가 구문 오류로 조각째 못 읽는 뒤돌아보기 정규식을 쓰지 않는다', () => {
    expect(read('src/lib/errorEvent.js')).not.toMatch(/\(\?<[=!]/);
    expect(read('src/lib/reportError.js')).not.toMatch(/\(\?<[=!]/);
  });
});

describe('⑶ 보내기(reportError → /api/client-error)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  const stubPage = (pathname = '/viewer/0b9f3c4e-1a2b-4c3d-8e9f-001122334455') => {
    const listeners = {};
    vi.stubGlobal('window', { location: { pathname, href: `https://manabi.app${pathname}?q=secret`, origin: 'https://manabi.app' },
      addEventListener: (type, fn) => { listeners[type] = fn; } });
    return listeners;
  };

  it('sendBeacon 먼저 — 정리된 JSON(쿼리 없는 경로 · 4KB 이하)', async () => {
    stubPage();
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    expect(sendErrorEvent(new Error('beacon case'), { kind: 'boundary.viewer' }, { force: true })).toBe(true);
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe(CLIENT_ERROR_ENDPOINT);
    const body = JSON.parse(await blob.text());
    expect(Object.keys(body).sort()).toEqual([...FIELDS].sort());
    expect(body).toMatchObject({ kind: 'boundary.viewer', message: 'beacon case', route: '/viewer/:id' });
    expect((await blob.text()).length).toBeLessThanOrEqual(LIMITS.body);
  });

  it('sendBeacon이 없거나 거절하면 keepalive fetch(쿠키 없이) — 실패해도 throw 없음', async () => {
    stubPage();
    vi.stubGlobal('navigator', { sendBeacon: () => false });
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);
    expect(sendErrorEvent(new Error('fetch case'), { kind: 'window.error' }, { force: true })).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(CLIENT_ERROR_ENDPOINT, expect.objectContaining({ method: 'POST', keepalive: true, credentials: 'omit' }));
    await Promise.resolve();
  });

  it('한 화면 안 같은 오류는 한 번 · 보내기 상한 · 무엇이 깨져도 false', () => {
    stubPage();
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    expect(sendErrorEvent(new Error('dup case'), { kind: 'window.error' }, { force: true })).toBe(true);
    expect(sendErrorEvent(new Error('dup case'), { kind: 'window.error' }, { force: true })).toBe(false);
    for (let i = 0; i < 20; i++) sendErrorEvent(new Error(`cap case ${i}`), { kind: 'window.error' }, { force: true });
    expect(beacon.mock.calls.length).toBeLessThanOrEqual(8);
    vi.stubGlobal('navigator', { get sendBeacon() { throw new Error('broken'); } });
    expect(sendErrorEvent(new Error('broken case'), { kind: 'window.error' }, { force: true })).toBe(false);
  });

  it('개발 · 테스트(운영 빌드가 아님)에서는 보내지 않는다', () => {
    stubPage();
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError(new Error('dev only'), { kind: 'boundary.root' });
    expect(beacon).not.toHaveBeenCalled();
  });

  it('전역 고리: 한 번만 걸고, 잡음(Script error · ResizeObserver · 다른 출처)은 보내지 않는다', async () => {
    vi.resetModules();
    const listeners = stubPage('/home');
    vi.stubEnv('NODE_ENV', 'production');
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fresh = await import('../reportError');
    expect(fresh.installGlobalErrorHooks()).toBe(false); // 모듈을 불러올 때 이미 걸렸다
    listeners.error({ message: 'Script error.', filename: '' });
    listeners.error({ message: 'ResizeObserver loop completed with undelivered notifications.' });
    listeners.error({ message: 'x', filename: 'chrome-extension://abc/content.js', error: new Error('ext') });
    expect(beacon).not.toHaveBeenCalled();
    listeners.error({ message: 'Uncaught TypeError: real', filename: 'https://manabi.app/_next/a.js', error: new TypeError('real') });
    listeners.unhandledrejection({ reason: { message: 'supabase failed', details: 'Key (word_text)=(食べる)' } });
    listeners.unhandledrejection({ reason: Object.assign(new Error('aborted'), { name: 'AbortError' }) });
    expect(beacon).toHaveBeenCalledTimes(2);
    const kinds = await Promise.all(beacon.mock.calls.map(async ([, blob]) => JSON.parse(await blob.text())));
    expect(kinds.map((k) => k.kind)).toEqual(['window.error', 'window.rejection']);
    expect(JSON.stringify(kinds)).not.toContain('食べる');
    expect(isNoiseError('', '')).toBe(true);
    expect(installGlobalErrorHooks).toBeTypeOf('function');
  });
});

describe('⑷ 마이그레이션 · CI(정적 — 동적 접근 행렬은 supabase/tests/error-events.mjs)', () => {
  const sql = read('supabase/migrations/20261106180000_error_events.sql');
  const code = sql.replace(/--[^\n]*/g, '');

  it('표는 Data API 밖 스키마 observe · RLS 켜짐 · 정책 없음 · API 역할 표 권한 회수', () => {
    expect(code).toMatch(/CREATE SCHEMA IF NOT EXISTS observe;/);
    expect(code).toMatch(/REVOKE ALL ON SCHEMA observe FROM PUBLIC, anon, authenticated, service_role;/);
    expect(code).toMatch(/ALTER TABLE observe\.error_events ENABLE ROW LEVEL SECURITY;/);
    expect(code).toMatch(/REVOKE ALL ON TABLE observe\.error_events FROM PUBLIC, anon, authenticated, service_role;/);
    expect(code).not.toMatch(/CREATE POLICY/i);
    expect(code).not.toMatch(/GRANT [^;]* ON (?:TABLE )?observe\./i);
    expect(code).not.toMatch(/REFERENCES/i); // 계정 표 FK 없음(지문 · 최소 수집)
  });

  it('쓰기는 SECURITY DEFINER 함수 하나 · search_path 비움 · service_role만 실행', () => {
    expect(code).toMatch(/VOLATILE SECURITY DEFINER\s+SET search_path TO ''/);
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.observe_record_error\([^)]*\) FROM PUBLIC, anon, authenticated;/);
    expect(code).toMatch(/GRANT EXECUTE ON FUNCTION public\.observe_record_error\([^)]*\) TO service_role;/);
    expect(code).not.toMatch(/TO (?:anon|authenticated)\b/);
  });

  it('칸은 앱 FIELDS + 서버가 더하는 출처 · 브라우저 계열 + 기록 장부(시각 · 칸 · 지문 · 횟수)뿐 — IP · 계정 · 본문 칸 없음', () => {
    const table = code.match(/CREATE TABLE IF NOT EXISTS observe\.error_events \(([\s\S]*?)\n\);/)[1];
    const columns = [...table.matchAll(/^\s{2}([a-z_]+) (?:bigint|timestamptz|text|integer)/gm)].map((m) => m[1]);
    expect(columns.sort()).toEqual(['browser', 'bucket', 'created_at', 'digest', 'fingerprint', 'hits', 'id', 'kind', 'last_seen_at', 'message', 'release', 'route', 'source', 'stack'].sort());
    for (const field of FIELDS) expect(columns).toContain(field);
    expect(code).toMatch(/char_length\(message\) BETWEEN 1 AND 500/);
    expect(code).toMatch(/char_length\(stack\) <= 1000/);
    expect(code).toMatch(/strpos\(route, '\?'\) = 0/);
  });

  it('보존 · 쏟아짐 상한 · 지문 측정(로그인 맥락 없이 — capability를 부르지 않는다) · 복원 SQL', () => {
    expect(code).toMatch(/interval '30 days' ORDER BY created_at LIMIT 200/);
    expect(code).toMatch(/interval '1 minute' LIMIT 30/);
    expect(code).toMatch(/interval '1 day' LIMIT 1000/);
    expect(code).toMatch(/contract_hash_live/);
    expect(code).not.toMatch(/learning_language_capabilities\(\)/);
    expect(sql).toContain('docs/sql/error-events-20261106-rollback.sql');
    expect(read('docs/sql/error-events-20261106-rollback.sql')).toMatch(/DROP FUNCTION IF EXISTS public\.observe_record_error/);
  });

  it('instrumentation: Node 가지 안에서만 기록 모듈을 동적으로 부른다(Edge 번들에 supabase-js · 서비스 키 경로가 실리지 않게)', () => {
    const src = read('src/instrumentation.js');
    expect(src).toMatch(/if \(process\.env\.NEXT_RUNTIME === 'nodejs' && process\.env\.NEXT_PHASE !== 'phase-production-build'\) \{\s*const \{ recordErrorEvent, serverErrorEvent \} = await import\('\.\/lib\/server\/errorEvents'\);/);
    expect(src).not.toMatch(/^import /m);
  });

  it('PGlite 검사 · 관측 사슬이 CI에서 돈다', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('node supabase/tests/error-events.mjs');
    expect(ci).toContain('node supabase/tests/post-observation-migrations.mjs');
  });
});
