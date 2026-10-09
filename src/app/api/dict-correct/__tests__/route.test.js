// 공유 사전 승격 API 권한 계약 — 로그인만으로는 공유 morpheme_dictionary를 덮을 수 없다.
// 화면(뷰어 ✏️ 「이 단어 전체에 적용」)은 자료 소유자에게만 이 옵션을 보인다. 서버도 같은 범위
// (그 자료의 소유자 또는 관리자 + 그 자료에 실제로 있는 단어)에서만 user_verified upsert를 허용해야
// 한다. user_verified 행은 자가 치유가 다시 덮지 않으므로, 잘못된 쓰기는 영구히 남는다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from '../../../../lib/__tests__/helpers/sliceBetween.js';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), limit: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/server/rateLimit', () => ({ rateLimit: mocks.limit, getClientKey: () => 'k' }));

import { POST } from '../route';

const OWNER = 'owner-id';
const STRANGER = 'stranger-id';
const ADMIN = 'admin-id';

function material(overrides = {}) {
  return {
    id: 101,
    owner_id: OWNER,
    processed_json: {
      metadata: { language: 'Japanese' },
      sequence: ['t1', 't2', 't3'],
      dictionary: {
        t1: { text: '食べた', base_form: '食べる', meaning: '먹다' },
        t2: { text: '本', base_form: '本', meaning: '책' },
        t3: { text: 'look', base_form: 'look', sep_link: 'look up', meaning: '찾아보다' },
      },
    },
    ...overrides,
  };
}

let state;
function fakeClient() {
  return {
    auth: {
      getUser: vi.fn(async (token) => (state.users[token]
        ? { data: { user: { id: state.users[token] } }, error: null }
        : { data: { user: null }, error: { message: 'bad jwt' } })),
    },
    from: vi.fn((table) => {
      const filters = {};
      const query = {
        select: () => query,
        eq: (key, value) => { filters[key] = value; return query; },
        maybeSingle: async () => {
          if (table === 'reading_materials') {
            const row = state.materials.find((m) => String(m.id) === String(filters.id)) || null;
            return { data: row, error: null };
          }
          if (table === 'morpheme_dictionary') return { data: state.dictRow, error: null };
          return { data: null, error: null };
        },
        single: async () => {
          if (table === 'profiles') return { data: { role: state.roles[filters.id] || 'user' }, error: null };
          return { data: null, error: null };
        },
        upsert: async (row, opts) => {
          state.upserts.push({ table, row, opts });
          return { error: null };
        },
      };
      return query;
    }),
  };
}

function post(body, token = 'owner-token') {
  return POST(new Request('http://localhost/api/dict-correct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }));
}

const valid = (extra = {}) => ({
  material_id: 101,
  base_form: '食べる',
  language: 'Japanese',
  corrections: { meaning: '먹었다(교정)' },
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  state = {
    users: { 'owner-token': OWNER, 'stranger-token': STRANGER, 'admin-token': ADMIN },
    roles: { [ADMIN]: 'admin' },
    materials: [material()],
    dictRow: null,
    upserts: [],
  };
  mocks.createClient.mockImplementation(() => fakeClient());
  mocks.limit.mockReturnValue({ ok: true });
});

describe('공유 사전 승격 — 권한 축소 계약', () => {
  it('비로그인·만료 세션은 401이고 쓰지 않는다', async () => {
    expect((await post(valid(), null)).status).toBe(401);
    expect((await post(valid(), 'expired')).status).toBe(401);
    expect(state.upserts).toHaveLength(0);
  });

  it('자료 없이(material_id 누락) 요청하면 upsert하지 않는다', async () => {
    const { material_id: _omit, ...noMaterial } = valid();
    const res = await post(noMaterial, 'stranger-token');
    expect(res.status).toBe(400);
    expect(state.upserts).toHaveLength(0);
  });

  it('자료 id 형식이 아니면(숫자 id 아님) 조회 전에 400', async () => {
    for (const material_id of ['abc', '1;drop', '', 12.5, { id: 101 }]) {
      expect((await post(valid({ material_id }), 'owner-token')).status).toBe(400);
    }
    expect(state.upserts).toHaveLength(0);
  });

  it('남의 자료로 요청하면 403이고 공유 사전을 덮지 않는다', async () => {
    const res = await post(valid(), 'stranger-token');
    expect(res.status).toBe(403);
    expect(await res.json()).toHaveProperty('error');
    expect(state.upserts).toHaveLength(0);
  });

  it('존재하지 않는 자료는 403(존재 여부를 흘리지 않는다)이고 쓰지 않는다', async () => {
    const res = await post(valid({ material_id: '999' }), 'owner-token');
    expect(res.status).toBe(403);
    expect(state.upserts).toHaveLength(0);
  });

  it('자기 자료라도 그 자료에 없는 단어는 422이고 쓰지 않는다', async () => {
    const res = await post(valid({ base_form: '核兵器' }), 'owner-token');
    expect(res.status).toBe(422);
    expect(state.upserts).toHaveLength(0);
  });

  it('자료 언어와 다른 language로 다른 언어 사전을 덮을 수 없다', async () => {
    const res = await post(valid({ base_form: '本', language: 'Chinese' }), 'owner-token');
    expect(res.status).toBe(422);
    expect(state.upserts).toHaveLength(0);
  });

  it('소유자가 자기 자료의 단어를 승격하면 user_verified로 upsert한다(기존 응답 형식)', async () => {
    const res = await post(valid(), 'owner-token');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]).toMatchObject({
      table: 'morpheme_dictionary',
      row: { base_form: '食べる', language: 'Japanese', source: 'user_verified' },
      opts: { onConflict: 'base_form,language' },
    });
  });

  it('뷰어가 보내는 키(sep_link → base_form → text) 어느 것이든 자료 토큰과 맞으면 허용한다', async () => {
    for (const base_form of ['look up', '本', '食べた']) {
      expect((await post(valid({ base_form }), 'owner-token')).status).toBe(200);
    }
    expect(state.upserts.map((u) => u.row.base_form)).toEqual(['look up', '本', '食べた']);
  });

  it('관리자는 남의 자료의 단어도 승격할 수 있다', async () => {
    const res = await post(valid(), 'admin-token');
    expect(res.status).toBe(200);
    expect(state.upserts).toHaveLength(1);
  });

  it('레이트 리밋은 자료 조회·쓰기 전에 429로 끊는다', async () => {
    mocks.limit.mockReturnValue({ ok: false, resetIn: 30_000 });
    const res = await post(valid(), 'owner-token');
    expect(res.status).toBe(429);
    expect(state.upserts).toHaveLength(0);
  });

  it('입력 검증(언어·교정 누락)은 그대로 400', async () => {
    expect((await post(valid({ language: 'Klingon' }))).status).toBe(400);
    expect((await post(valid({ corrections: {} }))).status).toBe(400);
    expect(state.upserts).toHaveLength(0);
  });
});

// 호출부 계약 — 승격을 부르는 곳은 뷰어 ✏️ 한 곳이고, 반드시 자료 id를 함께 보낸다.
describe('승격 호출부 배선', () => {
  it('뷰어 promoteCorrection이 material_id(현재 자료 id)를 보낸다', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/views/ViewerPage.jsx', 'utf8');
    const block = sliceBetween(src, 'const promoteCorrection = async', "toast('사전과 단어장에도 반영했어요!'");
    expect(block).toContain("fetch('/api/dict-correct'");
    expect(block).toMatch(/material_id:\s*id\b/);
  });
});
