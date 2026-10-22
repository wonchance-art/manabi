import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate } = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ requireAdmin: authenticate }));

import { GET, POST } from '../route';
import { createBookPublishHandlers } from '../../../../../lib/server/bookPublishRoute.js';
import { artBooks } from '../../../../../lib/artBook.js';
import { releaseState, releasesTable } from '../../../../../lib/__tests__/helpers/canonicalReleasesMock.js';

// 관리자 큐레이션 책 게시 API(ART-P0-3) — 정본 문학책과 같은 처리(bookPublishRoute)로 준비(비공개) → 분석 → 검수 → 공개.
// 원문은 카탈로그에서만 오고, 출처 기록이 카탈로그와 어긋난 책은 게시하지 않는다(422).

const [book, second] = artBooks();
const KEY = book.book.key; // art-ukiyoe-landscape-hokusai-hiroshige(8장)
const URL_BASE = 'http://localhost/api/admin/art-books';

const PATHS = {
  'processed_json->metadata->book->>key': (item) => item.processed_json.metadata.book.key,
  'processed_json->metadata->book->>order': (item) => String(item.processed_json.metadata.book.order),
  'processed_json->metadata->>viewerRevision': (item) => item.processed_json.metadata?.viewerRevision ?? null,
};
const field = (item, key) => (PATHS[key] ? PATHS[key](item) : item[key]);
const matches = (item, filters) => filters.every(([kind, key, value]) => (kind === 'eq' ? field(item, key) === value : value.includes(field(item, key))));

function database() {
  const state = { rows: [], inserts: [], updates: [], nextId: 700, ...releaseState() };
  const supabase = { from: vi.fn((table) => {
    if (table === 'canonical_book_releases') return releasesTable(state);
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
          state.inserts.push(payload);
          const created = payload.map((item) => ({ ...structuredClone(item), id: state.nextId++ }));
          state.rows.push(...created);
          return Promise.resolve({ data: created.map((item) => ({ id: item.id, order: String(item.processed_json.metadata.book.order) })), error: null }).then(resolve);
        }
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

/** 장을 「분석 완료」로. */
function analyze(item, revision) {
  item.processed_json = { ...item.processed_json, status: 'completed', sequence: ['t1'],
    dictionary: { t1: { text: '波', meaning: '파도' } }, metadata: { ...item.processed_json.metadata, viewerRevision: revision } };
}

const request = (body) => new Request(URL_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const post = (body) => POST(request(body));
const ORDERS = book.chapters.map((chapter) => chapter.order);
let db;
beforeEach(() => {
  db = database();
  authenticate.mockReset();
  authenticate.mockResolvedValue({ supabase: db.supabase, user: { id: 'admin-id' } });
});

describe('관리자 큐레이션 책 게시 API', () => {
  it('권한 없는 요청은 조회·게시를 거부한다', async () => {
    authenticate.mockResolvedValue({ error: '권한 없음', status: 403 });
    expect((await GET(new Request(URL_BASE))).status).toBe(403);
    expect((await post({ action: 'prepare', key: KEY })).status).toBe(403);
    expect(db.supabase.from).not.toHaveBeenCalled();
  });

  it('목록: 큐레이션 책 두 권 — 권리 근거 대신 장별 출처·라이선스·원문 링크·크레딧, 원문은 싣지 않는다', async () => {
    const response = await GET(new Request(URL_BASE));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const { books } = await response.json();
    expect(books.map((item) => [item.key, item.total, item.publishable, item.stage]))
      .toEqual([[KEY, 8, true, 'unpublished'], [second.book.key, 7, true, 'unpublished']]);
    const [summary] = books;
    expect(summary).not.toHaveProperty('rights');
    expect(summary.provenance.provider).toBe('art');
    expect(summary.provenance.chapters.map((item) => item.order)).toEqual(ORDERS);
    for (const item of summary.provenance.chapters) {
      expect(['colbase', 'aic']).toContain(item.source);
      expect(item.license).toBeTruthy();
      expect(item.sourceUrl).toMatch(/^https:\/\//);
      expect(item.credit).toBeTruthy();
    }
    expect(summary.chapters.map((chapter) => chapter.rubyLocks)).toEqual(ORDERS.map(() => 0));
    expect(JSON.stringify(books)).not.toContain(book.chapters[0].rawText.slice(0, 20));
  });

  it('준비: 여덟 장을 관리자 소유 **비공개** 행(provider art)으로 넣고, 다시 눌러도 더 넣지 않는다(멱등)', async () => {
    const first = await post({ action: 'prepare', key: KEY, chapters: [{ rawText: '偽の本文' }] });
    expect(first.status).toBe(200);
    expect((await first.json()).inserted.map((item) => item.order)).toEqual(ORDERS.map(String));
    expect(db.state.inserts[0].map((item) => [item.owner_id, item.visibility, item.raw_text, item.processed_json.status, item.processed_json.metadata.literature.provider]))
      .toEqual(book.chapters.map((chapter) => ['admin-id', 'private', chapter.rawText, 'pending', 'art']));
    expect(await (await post({ action: 'prepare', key: KEY })).json()).toMatchObject({ ok: true, inserted: [], plan: { state: 'published' } });
    expect(db.state.inserts).toHaveLength(1);
  });

  // 「뜻 확인 필요」 표식은 아오조라 검수 힌트에서만 온다(viewerSenseReview — 일본어는 provider 'aozora'만) — 해설문은 장마다 「검수 완료」만.
  it('공개: 분석·검수를 모두 마쳐야만 — 분석 전·검수 전이면 409, 다 마치면 비공개 장 여덟 개만 public으로', async () => {
    await post({ action: 'prepare', key: KEY });
    expect((await (await post({ action: 'release', key: KEY })).json()).release.reason).toBe('not-analyzed');
    expect((await post({ action: 'review', key: KEY, order: 1 })).status).toBe(409); // 분석 전 장은 검수 완료 불가
    db.state.rows.forEach((item, index) => analyze(item, `r${index}`));
    const early = await post({ action: 'release', key: KEY });
    expect(early.status).toBe(409);
    expect((await early.json()).release.reason).toBe('not-reviewed');
    for (const order of ORDERS) expect((await post({ action: 'review', key: KEY, order })).status).toBe(200);
    expect(db.state.updates.every((item) => item.ids.length === 1)).toBe(true);
    const response = await post({ action: 'release', key: KEY });
    expect(response.status).toBe(200);
    expect((await response.json()).released).toHaveLength(8);
    expect(db.state.rows.map((item) => item.visibility)).toEqual(ORDERS.map(() => 'public'));
    const { books } = await (await GET(new Request(URL_BASE))).json();
    expect(books[0].stage).toBe('released');
    // 발행 기록(CANON-RELEASE-001) — 409로 막힌 두 번은 기록하지 않고, 공개 때 관리자 본인 이름으로 한 번(on conflict do nothing)
    expect(db.state.releaseWrites).toEqual([{ value: { book_key: KEY, owner_id: 'admin-id' }, options: { onConflict: 'book_key', ignoreDuplicates: true } }]);
    expect(db.state.releases).toEqual([{ book_key: KEY, owner_id: 'admin-id' }]);
    // 이미 모두 공개한 책을 다시 「공개」 — 장은 그대로, 기록은 멱등
    expect(await (await post({ action: 'release', key: KEY })).json()).toEqual({ ok: true, released: [] });
    expect(db.state.releases).toHaveLength(1);
  });

  async function readyToRelease() {
    await post({ action: 'prepare', key: KEY });
    db.state.rows.forEach((item, index) => analyze(item, `r${index}`));
    for (const order of ORDERS) await post({ action: 'review', key: KEY, order });
  }

  it('공개: 다른 관리자가 먼저 발행한 key면 409로 장을 공개하지 않는다', async () => {
    await readyToRelease();
    db.state.releases.push({ book_key: KEY, owner_id: 'other-admin' });
    const response = await post({ action: 'release', key: KEY });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('다른 관리자 계정이 이미 정본으로 발행한 책이에요. 그 계정에서 관리해 주세요.');
    expect(db.state.rows.every((item) => item.visibility === 'private')).toBe(true);
  });

  it('공개: 발행 기록을 남기지 못하면 503으로 장을 공개하지 않는다', async () => {
    await readyToRelease();
    db.state.releaseError = { message: 'permission denied' };
    const response = await post({ action: 'release', key: KEY });
    expect(response.status).toBe(503);
    expect(db.state.rows.every((item) => item.visibility === 'private')).toBe(true);
  });

  it('검수 보조: 저자 루비가 없는 해설문도 장별 줄을 낸다(루비 0)', async () => {
    await post({ action: 'prepare', key: KEY });
    const response = await GET(new Request(`${URL_BASE}?ruby=${KEY}`));
    expect(await response.json()).toEqual({ key: KEY, coverage: ORDERS.map((order) => ({ order, rubyLocks: 0, applied: null,
      hints: 0, hintsAttached: null, hintsMissed: [], remaining: null, boundary: null, boundaryWords: [] })) });
  });

  it.each([
    [{ action: 'prepare', key: 'aozora-000879-000042' }, 404], // 문학책 key는 이 API의 정본이 아니다
    [{ action: 'delete', key: KEY }, 400],
  ])('잘못된 요청 %j → %s', async (body, status) => {
    expect((await post(body)).status).toBe(status);
    expect(db.state.inserts).toEqual([]);
  });

  it('출처 기록이 카탈로그와 어긋난 책(원문 변조)은 422로 아무것도 넣지 않는다 — 공용 처리의 게시 가능 판정', async () => {
    const tampered = structuredClone(book);
    tampered.chapters[2].rawText += '（追記）';
    const handlers = createBookPublishHandlers(() => [tampered], { notPublishableError: '출처·라이선스 기록이 공개 기준을 통과하지 못한 책이에요.' });
    const response = await handlers.POST(request({ action: 'prepare', key: KEY }));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe('출처·라이선스 기록이 공개 기준을 통과하지 못한 책이에요.');
    expect((await (await handlers.GET(new Request(URL_BASE))).json()).books[0].publishable).toBe(false);
    expect(db.state.inserts).toEqual([]);
  });

  it('정본 목록 자체가 깨지면(getBooks throw — 카탈로그 계약 위반) 아무것도 읽거나 쓰지 않는다 — POST 422, GET 500(DB 장애 503과 구분)', async () => {
    const handlers = createBookPublishHandlers(() => { throw new TypeError('없는 큐레이션'); },
      { notPublishableError: '출처·라이선스 기록이 공개 기준을 통과하지 못한 책이에요.' });
    for (const action of ['prepare', 'review', 'release']) {
      const response = await handlers.POST(request({ action, key: KEY, order: 1 }));
      expect(response.status).toBe(422);
      expect(response.headers.get('Content-Type')).toMatch(/application\/json/);
      expect(await response.json()).toEqual({ error: '출처·라이선스 기록이 공개 기준을 통과하지 못한 책이에요.' });
    }
    for (const url of [URL_BASE, `${URL_BASE}?ruby=${KEY}`]) {
      const response = await handlers.GET(new Request(url));
      expect(response.status).toBe(500);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect((await response.json()).error).toBe('정본 책 목록을 만들지 못했어요. 리포의 원본 기록을 확인해 주세요.');
    }
    // 입력 검사는 그대로 먼저 — 잘못된 요청은 여전히 400.
    expect((await handlers.POST(request({ action: 'delete', key: KEY }))).status).toBe(400);
    expect(db.supabase.from).not.toHaveBeenCalled();
    expect(db.state.inserts).toEqual([]);
  });
});
