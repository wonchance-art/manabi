import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// IPA-DICT-001 계약 — backfill-ipa 2단계: 공개 영어 자료에 쓰인 사전 행의 빈 reading만 채운다(reading만 · 비었을 때만 ·
// 하루 상한 3묶음을 1단계와 함께 쓴다). 1단계(단어장)는 그대로.
const state = vi.hoisted(() => ({ tables: {}, updates: [], prompts: [] }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table) {
      const q = { table, filters: [], op: 'select', patch: null };
      const rowsFor = () => {
        let rows = [...(state.tables[table] || [])];
        for (const [kind, col, val] of q.filters) {
          if (kind === 'eq') rows = rows.filter((r) => (col.includes('->') ? true : r[col] === val));
          if (kind === 'is') rows = rows.filter((r) => r[col] === val);
          if (kind === 'in') rows = rows.filter((r) => val.includes(r[col]));
          if (kind === 'or') rows = rows.filter((r) => r.reading == null || r.reading === '');
        }
        return rows;
      };
      const b = {
        select() { return b; },
        eq(col, val) { q.filters.push(['eq', col, val]); return b; },
        is(col, val) { q.filters.push(['is', col, val]); return b; },
        in(col, val) { q.filters.push(['in', col, val]); return b; },
        or(expr) { q.filters.push(['or', expr]); return b; },
        limit() { return b; },
        update(patch) { q.op = 'update'; q.patch = patch; return b; },
        then(resolve, reject) {
          try {
            const rows = rowsFor();
            if (q.op === 'update') {
              for (const r of rows) Object.assign(r, q.patch);
              state.updates.push({ table, patch: q.patch, keys: rows.map((r) => r.base_form ?? r.id) });
            }
            return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
          } catch (e) { return Promise.reject(e).then(resolve, reject); }
        },
      };
      return b;
    },
    rpc: vi.fn(async () => ({ data: true, error: null })),
  }),
}));
vi.mock('../../gemini.js', () => ({
  callGemini: vi.fn(async (prompt) => {
    state.prompts.push(prompt);
    const words = [...prompt.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]);
    return JSON.stringify({ results: words.map((w) => ({ word: w, ipa: `/${w}/` })) });
  }),
  parseGeminiJSON: (t) => JSON.parse(t),
}));

const material = (bases) => ({ visibility: 'public', processed_json: { status: 'completed', metadata: { language: 'English' },
  dictionary: Object.fromEntries(bases.map((b, i) => [`id_0_${i}_x`, { text: b, base_form: b, pos: b === '.' ? '기호' : '명사' }])) } });

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-test';
  process.env.CRON_SECRET = 'cron-test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.test';
  state.updates = []; state.prompts = [];
});
afterEach(() => { vi.resetModules(); });
const run = async () => {
  const { GET } = await import('../../../app/api/cron/backfill-ipa/route.js');
  const res = await GET(new Request('https://x.test/api/cron/backfill-ipa', { headers: { authorization: 'Bearer cron-test' } }));
  return res.json();
};

describe('backfill-ipa 2단계 — 공개 자료에 쓰인 사전 행의 빈 IPA', () => {
  it('단어장이 비어 있어도 2단계는 돈다: 빈 reading 행만 채우고, 뜻 · source는 그대로', async () => {
    state.tables = {
      user_vocabulary: [],
      reading_materials: [material(['party', 'adele', 'cat', '.'])],
      morpheme_dictionary: [
        { base_form: 'party', language: 'English', reading: null, source: 'user_verified', meanings: [{ meaning: '파티, 모임' }] },
        { base_form: 'adele', language: 'English', reading: '', source: 'user_verified', meanings: [{ meaning: '아델(영국 가수)' }] },
        { base_form: 'cat', language: 'English', reading: '/kæt/', source: 'gemini', meanings: [{ meaning: '고양이' }] },
        { base_form: 'unused', language: 'English', reading: null, source: 'gemini', meanings: [] },
      ],
    };
    const out = await run();
    expect(out).toMatchObject({ publicDictTargets: 2, publicDictUpdated: 2 });
    const dict = Object.fromEntries(state.tables.morpheme_dictionary.map((r) => [r.base_form, r]));
    expect(dict.party).toMatchObject({ reading: '/party/', source: 'user_verified', meanings: [{ meaning: '파티, 모임' }] });
    expect(dict.adele.reading).toBe('/adele/');
    expect(dict.cat.reading).toBe('/kæt/');          // 이미 있는 IPA는 그대로
    expect(dict.unused.reading).toBeNull();          // 공개 자료에 안 쓰인 행은 대상 밖
    for (const u of state.updates.filter((x) => x.table === 'morpheme_dictionary')) expect(Object.keys(u.patch)).toEqual(['reading']);
    expect(state.prompts.join('\n')).not.toContain('. cat');
  });
  it('하루 상한 3묶음(75낱말)을 1단계와 함께 쓴다 — 1단계가 3묶음을 다 쓰면 2단계는 0묶음', async () => {
    const vocab = Array.from({ length: 80 }, (_, i) => ({ id: i, base_form: `w${i}`, language: 'English', furigana: null }));
    state.tables = {
      user_vocabulary: vocab,
      reading_materials: [material(['party'])],
      morpheme_dictionary: [{ base_form: 'party', language: 'English', reading: null, source: 'user_verified', meanings: [] }],
    };
    const out = await run();
    expect(state.prompts).toHaveLength(3);
    expect(out.publicDictUpdated).toBe(0);
    expect(state.tables.morpheme_dictionary[0].reading).toBeNull();
  });
  it('할 일이 없으면 idle', async () => {
    state.tables = { user_vocabulary: [], reading_materials: [material(['cat'])],
      morpheme_dictionary: [{ base_form: 'cat', language: 'English', reading: '/kæt/', source: 'gemini', meanings: [] }] };
    expect(await run()).toMatchObject({ stage: 'idle', publicDictTargets: 0, publicDictUpdated: 0 });
    expect(state.prompts).toHaveLength(0);
  });
});
