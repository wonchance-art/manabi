import { beforeEach, describe, expect, it, vi } from 'vitest';

// AD-R3 PR④ 계약 — /api/admin/segment-rules(③ 공유 단어 경계 규칙): 비로그인 401 · 비관리자 403(쓰기 0) · 관리자만 검증한 꼴로
// shared_segment_rules에 upsert/delete · 표가 없으면 503. 하네스는 admin/llm-stats/route.test.js와 같다.

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

import { DELETE, POST } from './route';

const writes = [];
function request(method, token, body) {
  return new Request('https://example.test/api/admin/segment-rules', {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function supabaseFor({ user, role, writeError = null }) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: user ? null : new Error('invalid') })) },
    from: vi.fn((table) => {
      if (table === 'profiles') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: role ? { role } : null })) })) })) };
      }
      const q = { table, filters: [] };
      const chain = {
        upsert(row, opts) { q.op = 'upsert'; q.row = row; q.opts = opts; return chain; },
        delete() { q.op = 'delete'; return chain; },
        eq(k, v) { q.filters.push([k, v]); return chain; },
        then(resolve, reject) { writes.push(q); return Promise.resolve({ error: writeError }).then(resolve, reject); },
      };
      return chain;
    }),
  };
}

beforeEach(() => {
  createClientMock.mockReset();
  writes.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
});

describe('/api/admin/segment-rules — 권한', () => {
  it.each([['POST', POST], ['DELETE', DELETE]])('%s 비로그인 401 — 저장소를 건드리기 전에 닫힌다', async (method, handler) => {
    const res = await handler(request(method, null, { language: 'Chinese', surface: '身体素质' }));
    expect(res.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it.each([['POST', POST], ['DELETE', DELETE]])('%s 비관리자 403 · 규칙 쓰기 0', async (method, handler) => {
    createClientMock.mockReturnValue(supabaseFor({ user: { id: 'u1' }, role: 'student' }));
    const res = await handler(request(method, 'tok', { language: 'Chinese', surface: '身体素质' }));
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });
});

describe('/api/admin/segment-rules — 관리자', () => {
  it('POST: 검증 · 정규화한 꼴로 upsert(같은 꼴 = 칼선 · 메모만 바꿈), 작성자 기록', async () => {
    createClientMock.mockReturnValue(supabaseFor({ user: { id: 'admin-1' }, role: 'admin' }));
    const res = await POST(request('POST', 'tok', { language: 'English', surface: ' Pick  Up ', cuts: [], note: '  구동사  ' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rule: { language: 'English', surface: 'pick up', cuts: [] } });
    expect(writes).toEqual([{ table: 'shared_segment_rules', filters: [], op: 'upsert',
      row: { language: 'English', surface: 'pick up', cuts: [], created_by: 'admin-1', note: '구동사' }, opts: { onConflict: 'language,surface' } }]);
  });

  it.each([
    [{ language: 'Korean', surface: '도서관에서' }, 'language'],
    [{ language: 'Chinese', surface: '王先生', cuts: [3] }, 'cuts'],
    [{ language: 'Chinese', surface: '身' }, 'too_short'],
  ])('POST: 잘못된 규칙 %j는 400(%s) · 쓰기 0', async (body, reason) => {
    createClientMock.mockReturnValue(supabaseFor({ user: { id: 'admin-1' }, role: 'admin' }));
    const res = await POST(request('POST', 'tok', body));
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe(reason);
    expect(writes).toEqual([]);
  });

  it('DELETE: 언어 · 정규화한 꼴 하나만', async () => {
    createClientMock.mockReturnValue(supabaseFor({ user: { id: 'admin-1' }, role: 'admin' }));
    const res = await DELETE(request('DELETE', 'tok', { language: 'Chinese', surface: '身体 素质' }));
    expect(res.status).toBe(200);
    expect(writes).toEqual([{ table: 'shared_segment_rules', op: 'delete', filters: [['language', 'Chinese'], ['surface', '身体素质']] }]);
  });

  it('표가 없으면(PGRST205) 503 segment_rules_unavailable — 화면은 ③을 숨긴다', async () => {
    createClientMock.mockReturnValue(supabaseFor({ user: { id: 'admin-1' }, role: 'admin', writeError: { code: 'PGRST205', message: 'missing' } }));
    const res = await POST(request('POST', 'tok', { language: 'Chinese', surface: '身体素质' }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'segment_rules_unavailable' });
  });

  it('잘못된 JSON은 400', async () => {
    createClientMock.mockReturnValue(supabaseFor({ user: { id: 'admin-1' }, role: 'admin' }));
    expect((await POST(request('POST', 'tok', '{bad'))).status).toBe(400);
    expect((await DELETE(request('DELETE', 'tok', '[]'))).status).toBe(400);
  });
});
