import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate, revalidate, base } = vi.hoisted(() => ({
  authenticate: vi.fn(), revalidate: vi.fn(),
  base: { slug: 'test-chapter', level: 'N5', order: 1, title: '원본', sections: [{ heading: '주문', body: '설명' }] },
}));
vi.mock('@/lib/supabaseServer', () => ({ requireAdmin: authenticate }));
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
vi.mock('@/content/refLangs', () => ({ getRefLang: () => ({ base: '/japanese', getChapter: (slug) => slug === base.slug ? { chapter: base } : null }) }));
vi.mock('@/lib/contentOverrides', async () => vi.importActual('../../../../../lib/contentOverrides.js'));

import { GET, POST, DELETE } from '../route';

function database(initial = null) {
  const state = { row: initial, failure: null, sequence: 0, writes: 0 };
  const supabase = { from: vi.fn(() => {
    let operation = 'read', payload, filters = [];
    const query = {
      select: () => query,
      eq: (key, value) => { filters.push([key, value]); return query; },
      insert: (value) => { operation = 'insert'; payload = value; return query; },
      update: (value) => { operation = 'update'; payload = value; return query; },
      delete: () => { operation = 'delete'; return query; },
      maybeSingle: async () => {
        if (state.failure) return { error: state.failure, data: null };
        if (operation === 'read') return { data: state.row, error: null };
        if (operation === 'insert' && state.row) return { error: { code: '23505' }, data: null };
        if (operation === 'update' && (!state.row || filters.some(([key, value]) => state.row[key] !== value))) return { data: null, error: null };
        state.writes++;
        state.row = { ...payload, updated_at: `2026-09-05T03:00:0${++state.sequence}.123456+00:00` };
        return { data: { updated_at: state.row.updated_at }, error: null };
      },
      then: (resolve) => {
        if (operation === 'delete') { state.row = null; state.writes++; }
        return Promise.resolve({ error: state.failure }).then(resolve);
      },
    };
    return query;
  }) };
  return { state, supabase };
}
const url = 'http://localhost/api/admin/chapter?lang=Japanese&slug=test-chapter';
function post(extra = {}) {
  return POST(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lang: 'Japanese', slug: base.slug, data: { ...base, title: '고친 제목' }, expectedUpdatedAt: null, ...extra }),
  }));
}
let db;
beforeEach(() => {
  db = database(); authenticate.mockReset(); revalidate.mockReset();
  authenticate.mockResolvedValue({ supabase: db.supabase, user: { id: 'admin-id' } });
});

describe('관리자 교재 API', () => {
  it.each([401, 403])('권한 없는 요청 %s은 조회·저장·복원을 모두 거부한다', async (status) => {
    authenticate.mockResolvedValue({ error: '권한 없음', status });
    expect((await GET(new Request(url))).status).toBe(status);
    expect((await post()).status).toBe(status);
    expect((await DELETE(new Request(url, { method: 'DELETE', body: '{}' }))).status).toBe(status);
    expect(db.supabase.from).not.toHaveBeenCalled();
  });
  it('수정본이 없을 때 원본과 null 버전을 no-store로 반환한다', async () => {
    const response = await GET(new Request(url));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({ merged: base, updatedAt: null });
  });
  it('조회 오류를 원본으로 오인하지 않도록 저장 화면에 오류를 돌려준다', async () => {
    db.state.failure = { message: 'database unavailable' };
    expect((await GET(new Request(url))).status).toBe(503);
  });
  it('첫 저장 뒤 서버 버전을 반환하고 원본 식별자를 보존한다', async () => {
    const response = await post({ data: { ...base, level: 'N1', order: 99, slug: 'renamed', title: '수정' } });
    expect(response.status).toBe(200);
    expect((await response.json()).updatedAt).toBe(db.state.row.updated_at);
    expect(db.state.row.data).toMatchObject({ slug: base.slug, level: 'N5', order: 1, title: '수정' });
    expect(revalidate.mock.calls).toEqual([['/japanese/grammar/test-chapter'], ['/lessons'], ['/review/grammar']]);
  });
  it('같은 원본에서 시작한 동시 첫 저장은 하나만 성공한다', async () => {
    const responses = await Promise.all([post(), post()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(db.state.writes).toBe(1);
  });
  it('다른 탭의 최신 수정을 오래된 버전이 덮어쓰지 못한다', async () => {
    await post(); const oldVersion = db.state.row.updated_at;
    expect((await post({ expectedUpdatedAt: oldVersion, data: { ...base, title: '최신 제목' } })).status).toBe(200);
    expect((await post({ expectedUpdatedAt: oldVersion })).status).toBe(409);
    expect(db.state.row.data.title).toBe('최신 제목');
  });
  it('복원 후 오래된 편집 탭에서 수정본을 부활시키지 않는다', async () => {
    await post(); const version = db.state.row.updated_at; db.state.row = null;
    expect((await post({ expectedUpdatedAt: version })).status).toBe(409);
    expect(db.state.row).toBeNull();
  });
  it('버전 없는 구형 저장 요청은 재열기를 요구한다', async () => {
    expect((await post({ expectedUpdatedAt: undefined })).status).toBe(428);
    expect(db.state.writes).toBe(0);
  });
  it('잘못된 구조·버전·존재하지 않는 챕터를 저장하지 않는다', async () => {
    expect((await post({ data: { sections: [] } })).status).toBe(400);
    expect((await post({ data: { title: '  ' } })).status).toBe(400);
    expect((await post({ expectedUpdatedAt: {} })).status).toBe(400);
    expect((await post({ slug: 'not-found' })).status).toBe(404);
    expect(db.state.writes).toBe(0);
  });
  it('쓰기 실패는 성공으로 알리지 않고 경로도 갱신하지 않는다', async () => {
    db.state.failure = { message: 'write failed' };
    expect((await post()).status).toBe(500);
    expect(revalidate).not.toHaveBeenCalled();
  });
});
