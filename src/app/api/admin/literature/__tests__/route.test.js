import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireAdmin: authenticate }));

import { GET, POST } from '../route';
import { LITERATURE_BOOKS } from '../../../../../content/literature/aozora/index.generated.js';

// 관리자 정본 문학책 게시 API(AOZORA-P0-2 · P0-3 · P0-4) — 권한·준비(비공개) 멱등·충돌 시 무게시·장 검수·분석과 검수를 마친 뒤에만 공개·원문은 리포 산출물에서만.

const KEY = 'aozora-000879-000042'; // 鼻(2장)
const book = LITERATURE_BOOKS.find((item) => item.book.key === KEY);

const PATHS = {
  'processed_json->metadata->book->>key': (item) => item.processed_json.metadata.book.key,
  'processed_json->metadata->book->>order': (item) => String(item.processed_json.metadata.book.order),
  'processed_json->metadata->>viewerRevision': (item) => item.processed_json.metadata?.viewerRevision ?? null,
};
const field = (item, key) => (PATHS[key] ? PATHS[key](item) : item[key]);
const matches = (item, filters) => filters.every(([kind, key, value]) => (kind === 'eq' ? field(item, key) === value : value.includes(field(item, key))));

function database() {
  const state = { rows: [], failRead: false, failInsert: false, inserts: [], updates: [], nextId: 500 };
  const supabase = { from: vi.fn(() => {
    let operation = 'read', payload, columns = '';
    const filters = [];
    const query = {
      select: (value) => { columns = value; return query; },
      eq: (key, value) => { filters.push(['eq', key, value]); return query; },
      in: (key, values) => { filters.push(['in', key, values]); return query; },
      insert: (value) => { operation = 'insert'; payload = value; return query; },
      update: (value) => { operation = 'update'; payload = value; return query; },
      then: (resolve) => {
        if (operation === 'update') {
          const hit = state.rows.filter((item) => matches(item, filters));
          hit.forEach((item) => Object.assign(item, structuredClone(payload)));
          state.updates.push({ payload, ids: hit.map((item) => item.id) });
          return Promise.resolve({ data: hit.map((item) => ({ id: item.id })), error: null }).then(resolve);
        }
        if (operation === 'insert') {
          if (state.failInsert) return Promise.resolve({ data: null, error: { message: 'insert failed' } }).then(resolve);
          state.inserts.push(payload);
          const created = payload.map((item) => ({ ...structuredClone(item), id: state.nextId++ }));
          state.rows.push(...created);
          return Promise.resolve({ data: created.map((item) => ({ id: item.id, order: String(item.processed_json.metadata.book.order) })), error: null }).then(resolve);
        }
        if (state.failRead) return Promise.resolve({ data: null, error: { message: 'read failed' } }).then(resolve);
        const data = state.rows.filter((item) => matches(item, filters))
          .map((item) => ({ id: item.id, raw_text: item.raw_text, visibility: item.visibility, status: item.processed_json.status,
            key: item.processed_json.metadata.book.key, order: String(item.processed_json.metadata.book.order),
            review: item.processed_json.metadata.literatureReview ?? null, revision: item.processed_json.metadata.viewerRevision ?? null,
            ...(/processed_json(,|$)/.test(columns) ? { processed_json: structuredClone(item.processed_json) } : {}) }));
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return query;
  }) };
  return { state, supabase };
}

/** 장을 「분석 완료」로 — 검수 힌트 표식이 남은 토큰(flagged)을 둘 수 있다. */
function analyze(item, revision, { flagged = false } = {}) {
  item.processed_json = { ...item.processed_json, status: 'completed', sequence: ['t1'],
    dictionary: { t1: { text: '鼻', meaning: '코', ...(flagged ? { meaningCheck: 'ctx', meaningSuggest: '코' } : {}) } },
    metadata: { ...item.processed_json.metadata, viewerRevision: revision } };
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
    expect((await post({ action: 'prepare', key: KEY })).status).toBe(status);
    expect(db.supabase.from).not.toHaveBeenCalled();
  });

  it('목록: 정본 5편 요약(no-store) — 원문은 싣지 않는다', async () => {
    const response = await GET(new Request('http://localhost/api/admin/literature'));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { books } = await response.json();
    expect(books.map((item) => [item.key, item.plan.state])).toEqual(LITERATURE_BOOKS.map((item) => [item.book.key, 'unpublished']));
    expect(JSON.stringify(books)).not.toContain(book.chapters[0].rawText.slice(0, 20));
  });

  it('준비: 정본 장을 관리자 소유 **비공개** 행으로 넣고, 다시 눌러도 더 넣지 않는다(멱등)', async () => {
    const first = await post({ action: 'prepare', key: KEY, chapters: [{ rawText: '偽の本文' }] });
    expect(first.status).toBe(200);
    expect((await first.json()).inserted).toEqual([{ id: 500, order: '1' }, { id: 501, order: '2' }]);
    expect(db.state.inserts[0].map((item) => [item.owner_id, item.visibility, item.raw_text, item.processed_json.status]))
      .toEqual(book.chapters.map((chapter) => ['admin-id', 'private', chapter.rawText, 'pending']));
    const again = await post({ action: 'prepare', key: KEY });
    expect(await again.json()).toMatchObject({ ok: true, inserted: [], plan: { state: 'published' } });
    expect(db.state.inserts).toHaveLength(1);
  });

  it('정본과 다른 장이 이미 있으면 409, 아무것도 넣지 않는다', async () => {
    db.state.rows.push({ id: 9, owner_id: 'admin-id', raw_text: '書き換え', visibility: 'public',
      processed_json: { status: 'completed', metadata: { book: { key: KEY, order: 1 } } } });
    const response = await post({ action: 'prepare', key: KEY });
    expect(response.status).toBe(409);
    expect((await response.json()).plan.conflicts).toEqual([{ order: 1, id: 9, reason: 'text-differs' }]);
    expect(db.state.inserts).toEqual([]);
  });

  it('다른 사용자가 같은 book key로 만든 자료는 게시 판단에 섞이지 않는다', async () => {
    db.state.rows.push({ id: 3, owner_id: 'someone', raw_text: '偽', visibility: 'public', processed_json: { status: 'idle', metadata: { book: { key: KEY, order: 1 } } } });
    expect((await post({ action: 'prepare', key: KEY })).status).toBe(200);
    expect(db.state.inserts[0]).toHaveLength(2);
  });

  it.each([
    [{ action: 'delete', key: KEY }, 400],
    [{ action: 'publish', key: KEY }, 400],
    [{ action: 'prepare' }, 400],
    [{ action: 'prepare', key: 'aozora-000001-000001' }, 404],
  ])('잘못된 요청 %j → %s', async (body, status) => {
    expect((await post(body)).status).toBe(status);
    expect(db.state.inserts).toEqual([]);
  });

  it('조회·저장 실패는 원문 없이 한국어 안내(503)', async () => {
    db.state.failRead = true;
    const read = await post({ action: 'prepare', key: KEY });
    expect(read.status).toBe(503);
    expect((await read.json()).error).not.toMatch(/failed/);
    db.state.failRead = false;
    db.state.failInsert = true;
    const write = await post({ action: 'prepare', key: KEY });
    expect(write.status).toBe(503);
    expect((await write.json()).error).not.toMatch(/failed/);
  });

  it('공개: 분석 전 장이 있으면 409로 아무것도 공개하지 않는다', async () => {
    await post({ action: 'prepare', key: KEY });
    analyze(db.state.rows[0], 'r1');
    const response = await post({ action: 'release', key: KEY });
    expect(response.status).toBe(409);
    expect((await response.json()).release).toEqual({ ok: false, reason: 'not-analyzed', ids: [] });
    expect(db.state.updates).toEqual([]);
    expect(db.state.rows.map((item) => item.visibility)).toEqual(['private', 'private']);
  });

  it('검수: 「뜻 확인 필요」가 남은 장은 409, 다 확인한 장은 그 분석 revision으로 검수 완료', async () => {
    await post({ action: 'prepare', key: KEY });
    analyze(db.state.rows[0], 'r1', { flagged: true });
    const blocked = await post({ action: 'review', key: KEY, order: 1 });
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).remaining).toBe(1);
    analyze(db.state.rows[0], 'r1');
    const ok = await post({ action: 'review', key: KEY, order: 1 });
    expect(ok.status).toBe(200);
    expect(db.state.rows[0].processed_json.metadata.literatureReview).toMatchObject({ viewerRevision: 'r1' });
    expect((await post({ action: 'review', key: KEY, order: 2 })).status).toBe(409); // 분석 전 장
    expect((await post({ action: 'review', key: KEY, order: 9 })).status).toBe(400);
  });

  it('공개: 검수하지 않은 장이 있으면 409, 모든 장을 검수하면 관리자 소유 비공개 장만 public으로', async () => {
    await post({ action: 'prepare', key: KEY });
    db.state.rows.forEach((item, index) => analyze(item, `r${index}`));
    const early = await post({ action: 'release', key: KEY });
    expect(early.status).toBe(409);
    expect((await early.json()).release.reason).toBe('not-reviewed');
    for (const order of [1, 2]) expect((await post({ action: 'review', key: KEY, order })).status).toBe(200);
    const { books: before } = await (await GET(new Request('http://localhost/api/admin/literature'))).json();
    expect(before.find((item) => item.key === KEY).stage).toBe('ready');
    const response = await post({ action: 'release', key: KEY });
    expect(response.status).toBe(200);
    expect((await response.json()).released).toEqual([{ id: 500 }, { id: 501 }]);
    expect(db.state.rows.map((item) => item.visibility)).toEqual(['public', 'public']);
    expect(await (await post({ action: 'release', key: KEY })).json()).toEqual({ ok: true, released: [] });
    const { books } = await (await GET(new Request('http://localhost/api/admin/literature'))).json();
    expect(books.find((item) => item.key === KEY).stage).toBe('released');
  });

  it('재분석하면(revision 변경) 검수가 낡아 다시 검수해야 공개된다', async () => {
    await post({ action: 'prepare', key: KEY });
    db.state.rows.forEach((item, index) => analyze(item, `r${index}`));
    for (const order of [1, 2]) await post({ action: 'review', key: KEY, order });
    db.state.rows[1].processed_json.metadata.viewerRevision = 'r9';
    expect((await (await post({ action: 'release', key: KEY })).json()).release.reason).toBe('not-reviewed');
  });

  it('검수 보조(루비 적용률·제안·남은 확인): 분석 전은 null', async () => {
    await post({ action: 'prepare', key: KEY });
    const response = await GET(new Request(`http://localhost/api/admin/literature?ruby=${KEY}`));
    expect(await response.json()).toEqual({ key: KEY, coverage: book.chapters.map((chapter) => ({ order: chapter.order, rubyLocks: chapter.metadata.literature.rubyLocks.length, applied: null,
      hints: 0, hintsAttached: null, hintsMissed: [], remaining: null })) });
    expect((await GET(new Request('http://localhost/api/admin/literature?ruby=nope'))).status).toBe(404);
  });
});
