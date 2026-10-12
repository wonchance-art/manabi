import { beforeEach, describe, expect, it, vi } from 'vitest';

// MEANING-VERIFY-001 ③ — 관리자 사전 편집(PATCH /api/admin/dictionary)이 뜻별 pos·en_pos_v(·zh ja)를 지우지 않는다.
// 예전엔 meanings를 {meaning, priority}로만 다시 만들어, 뜻 하나를 고치면 겸류 뜻 정렬 정보가 user_verified 행에서
// 영구히 사라졌다(백필은 user_verified를 건드리지 않는다).

const db = vi.hoisted(() => ({ row: null, updates: [], role: 'admin' }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } } }) },
    from: (table) => {
      const q = { table, op: 'select', payload: null };
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        update(payload) { q.op = 'update'; q.payload = payload; return chain; },
        async single() {
          if (table === 'profiles') return { data: { role: db.role }, error: null };
          if (q.op === 'update') {
            db.updates.push(q.payload);
            return { data: { ...db.row, ...q.payload }, error: null };
          }
          return db.row ? { data: db.row, error: null } : { data: null, error: { message: 'not found' } };
        },
      };
      return chain;
    },
  }),
}));

import { PATCH } from '../../../app/api/admin/dictionary/route.js';
import { normalizeAdminMeanings } from '../adminDictionaryMeanings.js';

const patch = (body) => PATCH(new Request('https://test/api/admin/dictionary', {
  method: 'PATCH',
  headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}));

const EN_ROW = {
  id: 7, base_form: 'record', language: 'English', pos: '동사·명사', source: 'gemini',
  meanings: [
    { meaning: '기록하다', priority: 1, pos: '동사', en_pos_v: 1, verify: 'ok' },
    { meaning: '기록', priority: 2, pos: '명사' },
  ],
};

beforeEach(() => {
  db.row = JSON.parse(JSON.stringify(EN_ROW));
  db.updates = [];
  db.role = 'admin';
});

describe('normalizeAdminMeanings', () => {
  it('요청에 pos·en_pos_v가 있으면 보존한다(정본 pos만, en_pos_v는 1만)', () => {
    const out = normalizeAdminMeanings([
      { meaning: '음반', pos: '명사', en_pos_v: 1 },
      { meaning: '녹음하다', pos: '동사', en_pos_v: 7 },
      { meaning: '이상', pos: '엉뚱품사' },
    ], { language: 'English', previous: [] });
    expect(out).toEqual([
      { meaning: '음반', priority: 1, pos: '명사', en_pos_v: 1 },
      { meaning: '녹음하다', priority: 2, pos: '동사' },
      { meaning: '이상', priority: 3 },
    ]);
  });

  it('글자가 그대로인 뜻은 기존 pos·en_pos_v·ja를 이어받고, 바꾼 뜻은 이어받지 않는다', () => {
    const previous = [
      { meaning: '도서관', priority: 1, pos: '명사', ja: { form: '図書館', yomi: 'としょかん', warn: null } },
      { meaning: '서재', priority: 2, pos: '명사' },
    ];
    const out = normalizeAdminMeanings([{ meaning: '서재' }, { meaning: '도서관' }, { meaning: '새 뜻' }], { language: 'Chinese', previous });
    expect(out).toEqual([
      { meaning: '서재', priority: 1, pos: '명사' },
      { meaning: '도서관', priority: 2, pos: '명사', ja: { form: '図書館', yomi: 'としょかん', warn: null } },
      { meaning: '새 뜻', priority: 3 },
    ]);
  });
});

describe('PATCH /api/admin/dictionary', () => {
  it('뜻 하나만 고쳐도 나머지 뜻의 pos·en_pos_v가 남고 source는 user_verified로 승격된다', async () => {
    const res = await patch({ id: 7, updates: { meanings: [{ meaning: '기록하다' }, { meaning: '음반', pos: '명사' }] } });
    expect(res.status).toBe(200);
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0]).toEqual({
      meanings: [
        { meaning: '기록하다', priority: 1, pos: '동사', en_pos_v: 1 },
        { meaning: '음반', priority: 2, pos: '명사' },
      ],
      source: 'user_verified',
    });
  });

  it('없는 행이면 404, 관리자가 아니면 403 — 어느 쪽도 쓰지 않는다', async () => {
    db.row = null;
    expect((await patch({ id: 99, updates: { meanings: [{ meaning: 'x' }] } })).status).toBe(404);
    db.role = 'user';
    expect((await patch({ id: 7, updates: { meanings: [{ meaning: 'x' }] } })).status).toBe(403);
    expect(db.updates).toEqual([]);
  });

  it('뜻 없이 pos·reading만 고치면 기존 행을 읽지 않고 그대로 갱신한다(현행 유지)', async () => {
    const res = await patch({ id: 7, updates: { reading: '/ˈrek.ɔːd/' } });
    expect(res.status).toBe(200);
    expect(db.updates[0]).toEqual({ reading: '/ˈrek.ɔːd/', source: 'user_verified' });
  });
});
