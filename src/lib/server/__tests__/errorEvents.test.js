import { afterEach, describe, expect, it, vi } from 'vitest';

// ERROR-OBSERVE-001 — 서버 쓰기(recordErrorEvent)와 instrumentation onRequestError: 키 없음 · DB 실패 · 시간 초과 · 동기 throw 모두
// 결과 문자열로 끝나고 throw하지 않는다(요청을 깨뜨리지 않는다). 서버 기록은 라우트 틀 · 정리된 칸만, Next 흐름 신호는 기록하지 않는다.
const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

import { readLimited, recordErrorEvent, serverErrorEvent } from '../errorEvents';

const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test' };
const event = { source: 'server', kind: 'server.render', message: 'boom', stack: null, digest: '123', route: '/viewer/[id]', release: 'abc1234', browser: 'chrome' };

describe('recordErrorEvent — 실패를 삼킨다', () => {
  afterEach(() => { createClientMock.mockReset(); vi.unstubAllEnvs(); });

  it('RPC 하나에 정리된 칸만 싣는다', async () => {
    const rpc = vi.fn(async () => ({ data: 'recorded', error: null }));
    expect(await recordErrorEvent(event, { client: { rpc } })).toBe('recorded');
    expect(rpc).toHaveBeenCalledWith('observe_record_error', { p_source: 'server', p_kind: 'server.render', p_message: 'boom', p_stack: null,
      p_digest: '123', p_route: '/viewer/[id]', p_release: 'abc1234', p_browser: 'chrome' });
  });

  it('키가 없으면 skipped(클라이언트를 만들지 않는다)', async () => {
    expect(await recordErrorEvent(event, { env: {} })).toBe('skipped');
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('service-role 클라이언트는 세션을 저장하지 않는다', async () => {
    createClientMock.mockReturnValue({ rpc: async () => ({ data: 'counted', error: null }) });
    expect(await recordErrorEvent(event, { env })).toBe('counted');
    expect(createClientMock).toHaveBeenCalledWith(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) }));
  });

  it.each([
    ['DB 오류 응답', () => ({ rpc: async () => ({ data: null, error: { message: 'function does not exist' } }) }), 'failed'],
    ['RPC 거부(네트워크)', () => ({ rpc: async () => { throw new Error('fetch failed'); } }), 'failed'],
    ['동기 throw', () => ({ rpc: () => { throw new Error('sync'); } }), 'failed'],
    ['클라이언트 생성 실패', () => { throw new Error('bad url'); }, 'failed'],
  ])('%s → %s', async (_, make, expected) => {
    createClientMock.mockImplementation(make);
    await expect(recordErrorEvent(event, { env })).resolves.toBe(expected);
  });

  it('DB가 답하지 않으면 시간 초과 뒤 timeout', async () => {
    const started = Date.now();
    await expect(recordErrorEvent(event, { client: { rpc: () => new Promise(() => {}) }, timeoutMs: 30 })).resolves.toBe('timeout');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('모양이 틀린 기록은 보내지 않는다', async () => {
    const rpc = vi.fn();
    expect(await recordErrorEvent({ ...event, source: 'admin' }, { client: { rpc } })).toBe('invalid');
    expect(await recordErrorEvent(null, { client: { rpc } })).toBe('invalid');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('serverErrorEvent — onRequestError 입력 정리', () => {
  it('라우트 틀을 먼저 · 없으면 쿼리 뗀 경로 · 메시지 정리 · 브라우저 계열', () => {
    const error = Object.assign(new Error('select failed for me@example.com'), { digest: '2483459876' });
    const request = { path: '/viewer/0b9f3c4e-1a2b-4c3d-8e9f-001122334455?token=abc', method: 'GET', headers: { 'user-agent': 'Mozilla/5.0 Chrome/130 Safari/537.36', cookie: 'sb=secret' } };
    const out = serverErrorEvent(error, request, { routerKind: 'App Router', routePath: '/viewer/[id]', routeType: 'render' }, { NEXT_PUBLIC_BUILD_SHA: 'abc1234' });
    expect(out).toMatchObject({ source: 'server', kind: 'server.render', message: 'select failed for [email]', digest: '2483459876', route: '/viewer/[id]', release: 'abc1234', browser: 'chrome' });
    expect(JSON.stringify(out)).not.toMatch(/secret|token=|0b9f3c4e/);
    expect(serverErrorEvent(error, request, { routeType: 'route' }, {}).route).toBe('/viewer/:id');
  });

  it.each(['NEXT_REDIRECT;replace;/home;307;', 'NEXT_HTTP_ERROR_FALLBACK;404', 'NEXT_NOT_FOUND', 'DYNAMIC_SERVER_USAGE'])('Next 흐름 신호(%s)는 기록하지 않는다', (digest) => {
    expect(serverErrorEvent(Object.assign(new Error('x'), { digest }), { path: '/' }, { routeType: 'render' })).toBeNull();
  });
});

describe('readLimited — 본문 상한', () => {
  it('상한 이하는 그대로, 넘으면 null', async () => {
    expect(await readLimited(new Request('https://x.test', { method: 'POST', body: 'abc' }), 10)).toBe('abc');
    expect(await readLimited(new Request('https://x.test', { method: 'POST', body: 'x'.repeat(11) }), 10)).toBeNull();
    expect(await readLimited(new Request('https://x.test', { method: 'POST', body: '한글' }), 6)).toBe('한글');
  });
});

describe('instrumentation onRequestError — 요청을 깨뜨리지 않는다', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.doUnmock('@/lib/server/errorEvents'); vi.resetModules(); });
  const load = async () => (await import('../../../instrumentation.js')).onRequestError;

  it('Node 런타임에서 기록 모듈이 throw해도 undefined로 끝난다', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.doMock('../errorEvents', () => ({ serverErrorEvent: () => { throw new Error('boom'); }, recordErrorEvent: async () => { throw new Error('db'); } }));
    const onRequestError = await load();
    await expect(onRequestError(new Error('render'), { path: '/' }, { routeType: 'render' })).resolves.toBeUndefined();
  });

  it('DB 실패 · 키 없음에도 undefined(실제 모듈)', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    createClientMock.mockImplementation(() => ({ rpc: async () => { throw new Error('ECONNREFUSED'); } }));
    const onRequestError = await load();
    await expect(onRequestError(new Error('render'), { path: '/home', headers: {} }, { routeType: 'render', routePath: '/home' })).resolves.toBeUndefined();
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(onRequestError(new Error('render'), { path: '/home' }, { routeType: 'render' })).resolves.toBeUndefined();
  });

  it('Edge 런타임 · 빌드 중에는 기록 모듈을 불러오지도 않는다', async () => {
    vi.resetModules();
    const spy = vi.fn();
    vi.doMock('../errorEvents', () => ({ serverErrorEvent: spy, recordErrorEvent: spy }));
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    let onRequestError = await load();
    await onRequestError(new Error('mw'), { path: '/' }, { routeType: 'middleware' });
    vi.resetModules();
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    onRequestError = await load();
    await onRequestError(new Error('prerender'), { path: '/' }, { routeType: 'render' });
    expect(spy).not.toHaveBeenCalled();
  });
});
