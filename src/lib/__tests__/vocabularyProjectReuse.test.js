// VIEWER-INDEX-001(2026-11-02 KST) — 뷰어 첫 화면의 긴 작업(3,000단어 CPU×4 약 0.15초: 응답 → 투영 → 색인)을 덜고 나눈다. 표시는 그대로다.
// ⑴ 이미 투영한 snapshot을 다시 투영하면(색인 만들기 · 학습 화면들) 검사를 되풀이하지 않고 시각만 옮겨 적는다 — 결과는 처음 투영(새 객체)과 깊은 비교로 같다.
//    합성 무거운 계정(3,000단어) · 무작위 snapshot(legacy 마이크로초 · FSRS 등록/채점 · 아는 단어 · 제외 · 부적격 · 표기 겹침 · 언어 없음 · FSRS 꺼짐)
//    · 같은/늦은/이른 시각(이른 시각은 같은 오류).
// ⑵ 머리 칸 · 행 · 등록 · 투영 배열이 바뀌었으면 처음처럼 다 검사한다(바뀐 행의 오류를 놓치지 않는다).
// ⑶ 나눠 돌기(sliced)는 동기 판과 같은 결과 · 같은 오류이고, 실제로 여러 번 양보한다. 나눠 도는 사이 계정이 바뀌면 버린다.
// ⑷ 배선 — 뷰어 색인은 나눠 받고 다음 작업에서 색인을 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { buildHeavyAccount, HEAVY_UID } from '../../../e2e/fixtures/heavy-account.mjs';
import { buildVocabularyWordIndex } from '../vocabularyDueIndex';
import { fetchVocabularyLearningRows, projectVocabularyLearningRows, projectVocabularyLearningRowsSliced } from '../vocabularyLearningRows';
import { defaultRegistryEntry } from '../vocabularySnapshotLight';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler';

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ACTOR = '10000000-0000-4000-8000-0000000000aa';
const OTHER = '10000000-0000-4000-8000-0000000000bb';
const KEYS = ['byKey', 'surfaces', 'bases', 'projectionsById', 'registryById', 'actorId', 'enabled', 'complete', 'registryAvailable', 'now'];
const pickKeys = index => Object.fromEntries(KEYS.map(key => [key, index[key]]));
// 처음 투영(옛 동작) — 기억에 없는 새 객체를 주면 언제나 전체 검사 · 투영을 탄다.
const fresh = value => structuredClone(value);
const codeOf = fn => { try { fn(); return null; } catch (error) { return error.code || error.message; } };

function heavySnapshot() {
  const account = buildHeavyAccount({ now: Date.parse('2026-11-02T00:00:00.000Z') });
  const rows = account.tables.user_vocabulary.map(({ is_excluded: _x, ...row }) => row);
  return { version: 1, actorId: HEAVY_UID, enabled: true, complete: true, registryAvailable: true, rows,
    registry: rows.map(row => defaultRegistryEntry(row.id, HEAVY_UID)), now: '2026-11-02T00:00:00.000Z' };
}

function rng(seed) { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
const NOW_MS = Date.parse('2026-10-30T03:00:00.000Z');
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function randomSnapshot(seed) {
  const r = rng(seed), pick = list => list[Math.floor(r() * list.length)];
  const n = 1 + Math.floor(r() * 120);
  const words = ['ねこ', '猫', '食べる', '食べた', 'ok', '学校', '走', 'le chat', 'x'];
  const micro = ms => new Date(ms).toISOString().replace('Z', '').replace(/\.(\d{3})$/, (_, m) => `.${m}${pick(['', '412', '000'])}`) + pick(['Z', '+00:00']);
  const rows = [], registry = [];
  for (let i = 0; i < n; i++) {
    const reviewed = r() < 0.6, last = NOW_MS - Math.floor(r() * 40 * 86400000);
    const row = { id: id(i + 1), user_id: ACTOR, word_text: pick(words), base_form: pick([...words, '', null]), meaning: pick(['뜻', '', null]),
      language: pick(['Japanese', 'Chinese', 'English', null]), created_at: new Date(last - 86400000).toISOString(),
      interval: reviewed ? Math.round(r() * 300) / 10 : null, ease_factor: pick([0, 2.5, 5, 11, null]), repetitions: reviewed ? Math.floor(r() * 9) : null,
      last_reviewed_at: reviewed ? micro(last) : null, next_review_at: reviewed ? micro(last + Math.floor(r() * 30 * 86400000)) : pick([null, micro(NOW_MS + 3600000)]),
      source_material_id: null, source_ref: null };
    const entry = defaultRegistryEntry(row.id, ACTOR);
    const kind = r();
    if (kind < 0.3) {
      let card = introduceFsrsCard(NOW_MS - Math.floor(r() * 10 * 86400000), { policyVersion: pick(['anki-v2', undefined]) });
      if (r() < 0.6) card = scheduleFsrsReview(card, pick([1, 3, 4]), Date.parse(card.due) + 60000).card;
      Object.assign(entry, { enrolled: true, card, nextQuestionAt: card.due });
    } else if (kind < 0.4) Object.assign(entry, { known: true, eligible: false });
    else if (kind < 0.5) Object.assign(entry, { excluded: true, eligible: false, known: r() < 0.5 });
    else if (kind < 0.55) Object.assign(entry, { eligible: false });
    rows.push(row); registry.push(entry);
  }
  return { version: 1, learningAdmissionVersion: 1, actorId: ACTOR, enabled: r() < 0.8, registryAvailable: true, complete: true,
    now: new Date(NOW_MS).toISOString(), rows, registry };
}

describe('⑴ 다시 투영 = 처음 투영(깊은 비교)', () => {
  it('합성 무거운 계정(3,000단어) — 받은 투영으로 만든 색인이 옛 길(색인이 다시 투영)과 같다', () => {
    const projected = projectVocabularyLearningRows(heavySnapshot(), { actorId: HEAVY_UID });
    for (const at of [projected.now, Date.parse(projected.now) + 1, Date.parse(projected.now) + 4 * 3600000]) {
      const reused = buildVocabularyWordIndex(projected, at);
      expect(pickKeys(reused)).toStrictEqual(pickKeys(buildVocabularyWordIndex(fresh(projected), at)));
      expect(reused.projectionsById.size).toBe(3000);
    }
  });

  it.each(Array.from({ length: 40 }, (_, i) => [i + 1]))('무작위 snapshot #%i — 같은 · 늦은 · 이른 시각', seed => {
    const raw = randomSnapshot(seed);
    const projected = projectVocabularyLearningRows(raw, { actorId: ACTOR });
    expect(projected).toStrictEqual(projectVocabularyLearningRows(fresh(raw), { actorId: ACTOR }));
    for (const at of [projected.now, NOW_MS + 1, NOW_MS + 50 * 86400000, new Date(NOW_MS + 7).toISOString()]) {
      const again = projectVocabularyLearningRows(projected, { actorId: ACTOR, at });
      expect(again).toStrictEqual(projectVocabularyLearningRows(fresh(projected), { actorId: ACTOR, at }));
      expect(again.projections.every(Object.isFrozen) && again.projections.every(p => Object.isFrozen(p.review))).toBe(true);
      // 시각을 옮긴 결과를 또 받아도 같다(연쇄)
      const chained = projectVocabularyLearningRows(again, { actorId: ACTOR, at: NOW_MS + 60 * 86400000 });
      expect(chained).toStrictEqual(projectVocabularyLearningRows(fresh(again), { actorId: ACTOR, at: NOW_MS + 60 * 86400000 }));
      expect(pickKeys(buildVocabularyWordIndex(projected, at))).toStrictEqual(pickKeys(buildVocabularyWordIndex(fresh(projected), at)));
    }
    // 이른 시각 · 다른 계정 — 처음 투영과 같은 오류
    for (const options of [{ actorId: ACTOR, at: NOW_MS - 1 }, { actorId: OTHER }, { actorId: ACTOR, at: 'not-a-time' }]) {
      const want = codeOf(() => projectVocabularyLearningRows(fresh(projected), options));
      expect(want).not.toBeNull();
      expect(codeOf(() => projectVocabularyLearningRows(projected, options))).toBe(want);
    }
  });
});

describe('⑵ 바뀐 snapshot은 다시 다 검사한다', () => {
  const base = () => projectVocabularyLearningRows(randomSnapshot(7), { actorId: ACTOR });
  it.each([
    ['행 하나를 다른 계정 행으로 바꿈(제자리)', p => { p.rows[0] = { ...p.rows[0], user_id: OTHER }; }, 'vocabulary_learning_invalid_rows'],
    ['행 배열 교체', p => { p.rows = p.rows.map((row, i) => (i ? row : { ...row, id: '' })); }, 'vocabulary_learning_invalid_rows'],
    ['불완전 표시', p => { p.complete = false; }, 'vocabulary_learning_unavailable'],
    ['계정 칸', p => { p.actorId = OTHER; }, 'vocabulary_learning_owner_mismatch'],
    ['등록 배열 교체(줄 수 다름)', p => { p.registry = p.registry.slice(1); }, 'vocabulary_learning_incomplete_registry'],
    ['snapshot 시각', p => { p.now = new Date(NOW_MS + 86400000).toISOString(); }, 'vocabulary_learning_clock_reversed'],
  ])('%s', (_, mutate, code) => {
    const projected = base();
    mutate(projected);
    expect(codeOf(() => projectVocabularyLearningRows(projected, { actorId: ACTOR, at: NOW_MS + 1000 }))).toBe(code);
  });
  it('같은 객체 · 같은 배열이면 검사를 되풀이하지 않는다(재사용이 실제로 일어남 — 행 객체를 제자리에서 고치지 않는다는 전제의 표지)', () => {
    const projected = base();
    projected.rows[0].user_id = OTHER; // 앱은 이렇게 고치지 않는다 — 새 객체를 만든다(위 「제자리 바꿈」 줄은 잡힌다)
    expect(codeOf(() => projectVocabularyLearningRows(projected, { actorId: ACTOR, at: NOW_MS + 1000 }))).toBeNull();
    expect(codeOf(() => projectVocabularyLearningRows(fresh(projected), { actorId: ACTOR, at: NOW_MS + 1000 }))).toBe('vocabulary_learning_invalid_rows');
  });
  it('투영 배열의 줄을 바꿔 끼우면(행과 어긋남) 다시 투영한다 — 결과는 처음 투영과 같다', () => {
    const projected = base();
    projected.projections[0] = projected.projections[1];
    expect(projectVocabularyLearningRows(projected, { actorId: ACTOR, at: NOW_MS + 1000 }))
      .toStrictEqual(projectVocabularyLearningRows(fresh({ ...projected, projections: undefined }), { actorId: ACTOR, at: NOW_MS + 1000 }));
  });
});

describe('⑶ 나눠 돌기', () => {
  it.each([[1], [2], [3], [11]])('무작위 snapshot #%i — 동기 판과 같은 결과 · 줄마다 양보 가능', async seed => {
    const raw = randomSnapshot(seed);
    const yieldTo = vi.fn(async () => {});
    const sliced = await projectVocabularyLearningRowsSliced(fresh(raw), { actorId: ACTOR }, { sliceMs: 0, yieldTo });
    expect(sliced).toStrictEqual(projectVocabularyLearningRows(fresh(raw), { actorId: ACTOR }));
    expect(yieldTo.mock.calls.length).toBeGreaterThanOrEqual(1 + Math.floor(raw.rows.length / 64));
    // 나눠 돈 결과도 기억된다 — 색인이 다시 투영하지 않고 같은 값을 낸다
    expect(pickKeys(buildVocabularyWordIndex(sliced, NOW_MS + 5))).toStrictEqual(pickKeys(buildVocabularyWordIndex(fresh(sliced), NOW_MS + 5)));
  });
  it('3,000단어 — 시간 조각(sliceMs)이 차면 양보하고 결과는 같다', async () => {
    const raw = heavySnapshot();
    let t = 0;
    const yieldTo = vi.fn(async () => {});
    const sliced = await projectVocabularyLearningRowsSliced(fresh(raw), { actorId: HEAVY_UID }, { sliceMs: 5, yieldTo, clock: () => (t += 1) });
    expect(sliced).toStrictEqual(projectVocabularyLearningRows(fresh(raw), { actorId: HEAVY_UID }));
    expect(yieldTo.mock.calls.length).toBeGreaterThanOrEqual(5); // 64줄(한 걸음)마다 1틱 · 5틱마다 양보 — 3,000줄 = 48걸음
  });
  it('같은 오류 — 잘못된 행', async () => {
    const raw = randomSnapshot(5);
    raw.rows[raw.rows.length - 1] = { ...raw.rows.at(-1), user_id: OTHER };
    await expect(projectVocabularyLearningRowsSliced(raw, { actorId: ACTOR }, { sliceMs: 0, yieldTo: async () => {} }))
      .rejects.toMatchObject({ code: 'vocabulary_learning_invalid_rows' });
  });
  it('fetchVocabularyLearningRows(sliced) — 같은 결과, 나눠 도는 사이 계정이 바뀌면 버린다', async () => {
    const raw = heavySnapshot();
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => fresh(raw) });
    const plain = await fetchVocabularyLearningRows(HEAVY_UID, { fetchImpl });
    expect(await fetchVocabularyLearningRows(HEAVY_UID, { fetchImpl, sliced: true })).toStrictEqual(plain);
    let actor = HEAVY_UID;
    const scheduler = globalThis.scheduler;
    globalThis.scheduler = { yield: async () => { actor = OTHER; } };
    try {
      const clock = vi.spyOn(performance, 'now');
      let t = 0; clock.mockImplementation(() => (t += 100));
      await expect(fetchVocabularyLearningRows(HEAVY_UID, { fetchImpl, sliced: true, getActorId: () => actor }))
        .rejects.toMatchObject({ code: 'vocabulary_learning_owner_mismatch' });
      clock.mockRestore();
    } finally { globalThis.scheduler = scheduler; }
  });
});

describe('⑷ 배선', () => {
  it('뷰어 색인 — 나눠 받고(sliced), 한 번 양보한 뒤 색인을 만든다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    const fn = sliceBetween(viewer, 'async function fetchUserVocabWords', 'function findSavedVocab');
    expect(fn).toMatch(/fetchVocabularyLearningRows\(userId, \{ signal, sliced: true \}\)/);
    expect(fn.indexOf('await yieldToMain()')).toBeGreaterThan(fn.indexOf('sliced: true'));
    expect(fn.indexOf('buildVocabularyWordIndex(projected)')).toBeGreaterThan(fn.indexOf('await yieldToMain()'));
  });
});
