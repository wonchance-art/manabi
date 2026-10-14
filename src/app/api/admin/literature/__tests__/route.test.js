import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireAdmin: authenticate }));

import { GET, POST } from '../route';
import { LITERATURE_BOOKS } from '../../../../../content/literature/aozora/index.generated.js';

// 관리자 정본 문학책 게시 API(AOZORA-P0-2) — 권한·멱등·충돌 시 무게시·원문은 리포 산출물에서만.

const KEY = 'aozora-000879-000042'; // 鼻(2장)
const book = LITERATURE_BOOKS.find((item) => item.book.key === KEY);

function database() {
  const state = { rows: [], failRead: false, failInsert: false, inserts: [], nextId: 500 };
  const supabase = { from: vi.fn(() => {
    let operation = 'read', payload, columns = '';
    const filters = [];
    const query = {
      select: (value) => { columns = value; return query; },
      eq: (key, value) => { filters.push(['eq', key, value]); return query; },
      in: (key, values) => { filters.push(['in', key, values]); return query; },
      insert: (value) => { operation = 'insert'; payload = value; return query; },
      then: (resolve) => {
        if (operation === 'insert') {
          if (state.failInsert) return Promise.resolve({ data: null, error: { message: 'insert failed' } }).then(resolve);
          state.inserts.push(payload);
          const created = payload.map((item) => ({ ...item, id: state.nextId++ }));
          state.rows.push(...created);
          return Promise.resolve({ data: created.map((item) => ({ id: item.id, order: String(item.processed_json.metadata.book.order) })), error: null }).then(resolve);
        }
        if (state.failRead) return Promise.resolve({ data: null, error: { message: 'read failed' } }).then(resolve);
        const keys = filters.find(([kind]) => kind === 'in')?.[2] || [];
        const owner = filters.find(([kind, key]) => kind === 'eq' && key === 'owner_id')?.[2];
        const data = state.rows
          .filter((item) => item.owner_id === owner && keys.includes(item.processed_json.metadata.book.key))
          .map((item) => ({ id: item.id, raw_text: item.raw_text, visibility: item.visibility, status: item.processed_json.status,
            key: item.processed_json.metadata.book.key, order: String(item.processed_json.metadata.book.order),
            ...(columns.includes('processed_json,') || columns.endsWith('processed_json') ? { processed_json: item.processed_json } : {}) }));
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return query;
  }) };
  return { state, supabase };
}

const post = (body) => POST(new Request('http://localhost/api/admin/literature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
let db;
beforeEach(() => {
  db = database();
  authenticate.mockReset();
  authenticate.mockResolvedValue({ supabase: db.supabase, user: { id: 'admin-id' } });
});

describe('관리자 정본 문학책 게시 API', () => {
  it.each([401, 403])('권한 없는 요청 %s은 조회·게시를 거부한다', async (status) => {
    authenticate.mockResolvedValue({ error: '권한 없음', status });
    expect((await GET(new Request('http://localhost/api/admin/literature'))).status).toBe(status);
    expect((await post({ action: 'publish', key: KEY })).status).toBe(status);
    expect(db.supabase.from).not.toHaveBeenCalled();
  });

  it('목록: 정본 5편 요약(no-store) — 원문은 싣지 않는다', async () => {
    const response = await GET(new Request('http://localhost/api/admin/literature'));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { books } = await response.json();
    expect(books.map((item) => [item.key, item.plan.state])).toEqual(LITERATURE_BOOKS.map((item) => [item.book.key, 'unpublished']));
    expect(JSON.stringify(books)).not.toContain(book.chapters[0].rawText.slice(0, 20));
  });

  it('게시: 정본 장을 관리자 소유 공개 행으로 넣고, 다시 눌러도 더 넣지 않는다(멱등)', async () => {
    const first = await post({ action: 'publish', key: KEY, chapters: [{ rawText: '偽の本文' }] });
    expect(first.status).toBe(200);
    expect((await first.json()).inserted).toEqual([{ id: 500, order: '1' }, { id: 501, order: '2' }]);
    expect(db.state.inserts[0].map((item) => [item.owner_id, item.visibility, item.raw_text, item.processed_json.status]))
      .toEqual(book.chapters.map((chapter) => ['admin-id', 'public', chapter.rawText, 'pending']));
    const again = await post({ action: 'publish', key: KEY });
    expect(await again.json()).toMatchObject({ ok: true, inserted: [], plan: { state: 'published' } });
    expect(db.state.inserts).toHaveLength(1);
  });

  it('정본과 다른 장이 이미 있으면 409, 아무것도 넣지 않는다', async () => {
    db.state.rows.push({ id: 9, owner_id: 'admin-id', raw_text: '書き換え', visibility: 'public',
      processed_json: { status: 'completed', metadata: { book: { key: KEY, order: 1 } } } });
    const response = await post({ action: 'publish', key: KEY });
    expect(response.status).toBe(409);
    expect((await response.json()).plan.conflicts).toEqual([{ order: 1, id: 9, reason: 'text-differs' }]);
    expect(db.state.inserts).toEqual([]);
  });

  it('다른 사용자가 같은 book key로 만든 자료는 게시 판단에 섞이지 않는다', async () => {
    db.state.rows.push({ id: 3, owner_id: 'someone', raw_text: '偽', visibility: 'public', processed_json: { status: 'idle', metadata: { book: { key: KEY, order: 1 } } } });
    expect((await post({ action: 'publish', key: KEY })).status).toBe(200);
    expect(db.state.inserts[0]).toHaveLength(2);
  });

  it.each([
    [{ action: 'delete', key: KEY }, 400],
    [{ action: 'publish' }, 400],
    [{ action: 'publish', key: 'aozora-000001-000001' }, 404],
  ])('잘못된 요청 %j → %s', async (body, status) => {
    expect((await post(body)).status).toBe(status);
    expect(db.state.inserts).toEqual([]);
  });

  it('조회·저장 실패는 원문 없이 한국어 안내(503)', async () => {
    db.state.failRead = true;
    const read = await post({ action: 'publish', key: KEY });
    expect(read.status).toBe(503);
    expect((await read.json()).error).not.toMatch(/failed/);
    db.state.failRead = false;
    db.state.failInsert = true;
    const write = await post({ action: 'publish', key: KEY });
    expect(write.status).toBe(503);
    expect((await write.json()).error).not.toMatch(/failed/);
  });

  it('루비 적용률: 분석 전은 null', async () => {
    await post({ action: 'publish', key: KEY });
    const response = await GET(new Request(`http://localhost/api/admin/literature?ruby=${KEY}`));
    expect(await response.json()).toEqual({ key: KEY, coverage: book.chapters.map((chapter) => ({ order: chapter.order, rubyLocks: chapter.metadata.literature.rubyLocks.length, applied: null })) });
    expect((await GET(new Request('http://localhost/api/admin/literature?ruby=nope'))).status).toBe(404);
  });
});
