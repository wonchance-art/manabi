import { describe, expect, it, vi } from 'vitest';
import { encounterPullThrottleKey, syncVocabEncounters } from '../vocabEncounterSync.js';
import { loadVocabEncounters, vocabEncounterStorageKey } from '../vocabEncounters.js';

// 🈁 서버 정본 동기화 계약(rfc-vocab-encounter §4.5) — 로컬이 원본:
//   pull 은 합집합, push 는 로컬 전용분만(ignoreDuplicates → first_met_at 보존),
//   게스트·에러·미적용 마이그레이션은 조용히 false(로컬 단독 동작 무해성).

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    values,
  };
}

function mockClient({ rows = [], selectError = null, upsertRejects = false } = {}) {
  const calls = { selects: 0, upserts: [] };
  const client = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: async () => {
            calls.selects += 1;
            return selectError ? { data: null, error: selectError } : { data: rows, error: null };
          },
        }),
      }),
      upsert: (payload, opts) => {
        calls.upserts.push({ payload, opts });
        return upsertRejects ? Promise.reject(new Error('down')) : Promise.resolve({ error: null });
      },
    })),
  };
  return { client, calls };
}

const seedLocal = (words) => memoryStorage({
  [vocabEncounterStorageKey('ja')]: JSON.stringify(words),
});

describe('syncVocabEncounters — 입구 가드', () => {
  it('클라이언트·userId·2자 lang·storage 중 하나라도 없으면 조용히 false, 서버 무접촉', async () => {
    const { client, calls } = mockClient();
    expect(await syncVocabEncounters(null, 'u1', 'ja', { storage: memoryStorage(), throttleStorage: memoryStorage() })).toBe(false);
    expect(await syncVocabEncounters(client, null, 'ja', { storage: memoryStorage(), throttleStorage: memoryStorage() })).toBe(false);
    expect(await syncVocabEncounters(client, 'u1', 'Japanese', { storage: memoryStorage(), throttleStorage: memoryStorage() })).toBe(false);
    expect(await syncVocabEncounters(client, 'u1', 'ja', { storage: null, throttleStorage: memoryStorage() })).toBe(false);
    expect(calls.selects).toBe(0);
  });
});

describe('syncVocabEncounters — 쌍방 병합', () => {
  it('pull 은 합집합으로 로컬에 더하고 true, push 는 로컬 전용분만 ignoreDuplicates 로 올린다', async () => {
    const { client, calls } = mockClient({ rows: [{ word_text: '券売機' }, { word_text: '替え玉' }] });
    const storage = seedLocal(['食券', '替え玉']);
    const changed = await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage: memoryStorage() });

    expect(changed).toBe(true);
    expect([...loadVocabEncounters('ja', storage)].sort()).toEqual(['券売機', '替え玉', '食券'].sort());
    expect(calls.upserts).toHaveLength(1);
    expect(calls.upserts[0].payload).toEqual([{ user_id: 'u1', lang: 'ja', word_text: '食券' }]);
    expect(calls.upserts[0].opts).toEqual({ onConflict: 'user_id,lang,word_text', ignoreDuplicates: true });
  });

  it('서버 ⊆ 로컬이면 false(재로딩 불필요)지만 로컬 전용분 push 는 그대로 한다', async () => {
    const { client, calls } = mockClient({ rows: [{ word_text: '食券' }] });
    const storage = seedLocal(['食券', 'お通し']);
    expect(await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage: memoryStorage() })).toBe(false);
    expect(calls.upserts[0].payload).toEqual([{ user_id: 'u1', lang: 'ja', word_text: 'お通し' }]);
  });

  it('양쪽이 같으면 false 에 upsert 도 없다(멱등)', async () => {
    const { client, calls } = mockClient({ rows: [{ word_text: '食券' }] });
    const storage = seedLocal(['食券']);
    expect(await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage: memoryStorage() })).toBe(false);
    expect(calls.upserts).toHaveLength(0);
  });

  it('DB CHECK(≤100자) 밖의 로컬 잔재·서버 깨진 행은 병합·push 양쪽에서 거른다', async () => {
    const { client, calls } = mockClient({ rows: [{ word_text: '' }, { word_text: null }, {}] });
    const storage = seedLocal(['食券', 'あ'.repeat(101)]);
    expect(await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage: memoryStorage() })).toBe(false);
    expect(calls.upserts[0].payload).toEqual([{ user_id: 'u1', lang: 'ja', word_text: '食券' }]);
    expect(loadVocabEncounters('ja', storage).size).toBe(2); // 로컬은 건드리지 않는다(로컬이 원본)
  });
});

describe('syncVocabEncounters — 스로틀·무해성', () => {
  it('같은 언어 5분 내 재호출은 서버 무접촉 false, force 는 스로틀을 뚫는다', async () => {
    const { client, calls } = mockClient({ rows: [] });
    const storage = seedLocal(['食券']);
    const throttleStorage = memoryStorage();

    await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage });
    expect(throttleStorage.values.has(encounterPullThrottleKey('ja'))).toBe(true);
    expect(calls.selects).toBe(1);

    expect(await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage })).toBe(false);
    expect(calls.selects).toBe(1);

    await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage, force: true });
    expect(calls.selects).toBe(2);
  });

  it('select 에러(미적용 마이그레이션)면 로컬 무변경·push 없이 false', async () => {
    const { client, calls } = mockClient({ selectError: { message: 'relation does not exist' } });
    const storage = seedLocal(['食券']);
    expect(await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage: memoryStorage() })).toBe(false);
    expect(calls.upserts).toHaveLength(0);
    expect([...loadVocabEncounters('ja', storage)]).toEqual(['食券']);
  });

  it('upsert 거부(네트워크)여도 예외 없이 pull 결과(true)를 돌려준다', async () => {
    const { client } = mockClient({ rows: [{ word_text: '券売機' }], upsertRejects: true });
    const storage = seedLocal(['食券']);
    expect(await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage: memoryStorage() })).toBe(true);
    expect(loadVocabEncounters('ja', storage).has('券売機')).toBe(true);
  });
});

describe('syncVocabEncounters — 출처 문맥 push 동봉(R3)', () => {
  it('로컬 문맥이 있는 전용분은 context/context_source가 실리고, 없는 행은 기존 형태 그대로', async () => {
    const { client, calls } = mockClient({ rows: [] });
    const storage = memoryStorage({
      [vocabEncounterStorageKey('ja')]: JSON.stringify(['食券', 'どうぞ']),
      'vocab-encounter-contexts:ja': JSON.stringify({ '食券': { t: 'まずは 食券を どうぞ。', s: 'npc' } }),
    });
    await syncVocabEncounters(client, 'u1', 'ja', { storage, throttleStorage: memoryStorage() });
    const byWord = Object.fromEntries(calls.upserts[0].payload.map((r) => [r.word_text, r]));
    expect(byWord['食券']).toEqual({
      user_id: 'u1', lang: 'ja', word_text: '食券',
      context: 'まずは 食券を どうぞ。', context_source: 'npc',
    });
    expect(byWord['どうぞ']).toEqual({ user_id: 'u1', lang: 'ja', word_text: 'どうぞ' });
  });
});
