import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), client: vi.fn(), read: vi.fn(), apply: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/server/fsrsLearning', async importOriginal => ({ ...(await importOriginal()),
  fsrsServiceClient: mocks.client, readFsrsStatus: mocks.read, applyFsrsRequest: mocks.apply }));
import { GET, POST } from '../../app/api/learning/fsrs/route.js';
const owner = '10000000-0000-0000-0000-000000000001';
const authClient = { rpc: vi.fn() }, serviceClient = { rpc: vi.fn() };
const post = (body, headers = {}) => POST(new Request('https://manabi.test/api/learning/fsrs', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ user: { id: owner }, supabase: authClient });
  mocks.client.mockReturnValue(serviceClient);
  mocks.read.mockResolvedValue({ version: 1, enabled: false, registryAvailable: true, cards: [] });
  mocks.apply.mockResolvedValue({ ok: true, operationId: 'grade-1', card: { revision: 1 } });
});

describe('인증된 새 FSRS API', () => {
  it('익명 요청에서는 service role 클라이언트조차 생성하지 않는다', async () => {
    mocks.requireUser.mockResolvedValue({ error: 'private detail', status: 401 });
    const response = await post({ action: 'question' });
    expect(response.status).toBe(401); expect(await response.json()).toEqual({ ok: false, code: 'fsrs_auth_required' });
    expect((await GET()).status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
  });

  it('쿠키 세션의 실제 사용자와 인증 클라이언트를 그대로 전달하고 모든 응답 캐시를 막는다', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.read).toHaveBeenCalledWith({ authClient, serviceClient, userId: owner });
    const body = { action: 'grade', accountId: owner, operationId: 'grade-1' };
    expect((await post(body)).status).toBe(200);
    expect(mocks.apply).toHaveBeenCalledWith({ authClient, serviceClient, userId: owner, body });
  });

  it('다른 사이트의 요청·폼·큰 payload·손상된 JSON은 쓰기 전에 거절한다', async () => {
    expect((await post({}, { Origin: 'https://other.test' })).status).toBe(403);
    expect((await post('{}', { 'Content-Type': 'text/plain' })).status).toBe(400);
    expect((await post(' '.repeat(4097))).status).toBe(400);
    expect((await post('{')).status).toBe(400);
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it('인증·DB 예외 원문을 숨기고 장애를 성공적인 비활성/빈 목록으로 응답하지 않는다', async () => {
    mocks.read.mockRejectedValue(new Error('private SQL and credentials'));
    let response = await GET();
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ ok: false, code: 'fsrs_storage_unavailable' });
    mocks.apply.mockRejectedValue(Object.assign(new Error('private'), { status: 409, code: 'fsrs_revision_conflict' }));
    response = await post({});
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ ok: false, code: 'fsrs_revision_conflict' });
    mocks.requireUser.mockRejectedValue(new Error('cookie token'));
    expect((await GET()).status).toBe(503);
  });
});
