// 학습 snapshot 나눠 쓰기(SNAPSHOT-SHARE-001, 2026-11-02 KST) — 화면을 옮길 때 같은 /api/learning/vocabulary를 다시 받지 않되,
// 쓰기(채점 · 아는 표시 · 제외 · 저장) 뒤에는 모든 소비자(배움 숫자 · 현황 · 복습방 · 읽을거리 맞춤도)가 새 숫자를 받는다.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/query-core';
import { legacyLearningSnapshot } from '../../../e2e/fixtures/learning-snapshot.mjs';
import { sliceBetween } from './helpers/sliceBetween';

const db = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: db }));

const { fetchSharedVocabularySummary, settledLearningSnapshot, VOCAB_SUMMARY_SHARE_MS, vocabularyLearningKey, vocabularySummaryKey } =
  await import('../vocabularyLearningShare');
const { projectVocabularyLearningRows } = await import('../vocabularyLearningRows');
const { invalidateVocabularyLearning, patchVocabularyLearningRow } = await import('../useVocabData');
const { knownWordsMutationOptions } = await import('../useKnownWords');
const { clearAccountQueries, isAccountFreeQuery } = await import('../accountQueryCache');
const { VOCAB_EARLY_KEY } = await import('../vocabularyEarly');
const { HOME_DATA_KEY } = await import('../homeQueryKey');
const { fetchHomeData } = await import('../../views/HomePage');
const { fetchProfileStats } = await import('../../views/ProfileStats');

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const UID = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const SUMMARY_URL = '/api/learning/vocabulary?view=learning&fields=summary';

const wordRow = (id, extra = {}) => ({ id, word_text: `本${id}`, base_form: `本${id}`, language: 'Japanese', meaning: '책',
  created_at: '2026-10-01T00:00:00.000Z', interval: 3, ease_factor: 5, repetitions: 0,
  last_reviewed_at: '2026-10-20T00:00:00.000Z', next_review_at: '2026-10-25T00:00:00.000Z', ...extra });
const wordsV1 = [wordRow('w1'), wordRow('w2')];
// 채점 뒤 — w1의 다음 복습이 미래로(배움 「복습 대기」가 하나 준다), 새 단어 w3 저장.
const wordsV2 = [wordRow('w1', { next_review_at: '2099-01-01T00:00:00.000Z', last_reviewed_at: '2026-11-02T00:00:00.000Z' }), wordRow('w2'), wordRow('w3')];

/** 서버 흉내 — 부를 때마다 지금 단어 목록으로 요약/전체 snapshot. 요청 주소를 센다. */
function server(actorId = UID) {
  const state = { words: wordsV1, calls: [], gate: null };
  const fetch = vi.fn(async (url) => {
    state.calls.push(url);
    const words = state.words;
    if (state.gate) await state.gate;
    const fields = new URL(url, 'http://x').searchParams.get('fields');
    const body = legacyLearningSnapshot({ actorId, rows: words, fields });
    return { ok: true, status: 200, json: async () => body };
  });
  vi.stubGlobal('fetch', fetch);
  return state;
}
const fullSnapshot = (actorId = UID, rows = wordsV1) => projectVocabularyLearningRows(legacyLearningSnapshot({ actorId, rows }), { actorId });
function recentProgress() {
  const chain = {};
  for (const method of ['select', 'eq', 'order']) chain[method] = vi.fn(() => chain);
  chain.limit = vi.fn(async () => ({ data: [] }));
  db.from.mockImplementation(() => chain);
}
const dueCount = home => home.learning.projections.filter(p => Date.parse(p.vocabulary.next_review_at) <= Date.now()).length;

let client;
beforeEach(() => { client = new QueryClient(); recentProgress(); });
afterEach(() => { client.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); delete globalThis[VOCAB_EARLY_KEY]; });

describe('나눠 쓰는 칸 — 요약 소비자는 같은 요약 snapshot 하나', () => {
  it('배움 → 현황 → 읽을거리 맞춤도: 요약 읽기는 한 번(같은 신선도 안)', async () => {
    const api = server();
    const home = await fetchHomeData(UID, Date.now(), { queryClient: client });
    const stats = await fetchProfileStats(UID, Date.now(), { queryClient: client });
    const due = await fetchSharedVocabularySummary(client, UID);
    expect(api.calls).toEqual([SUMMARY_URL]);
    expect(stats.vocab).toBe(home.learning.rows);
    expect(due).toBe(home.learning);
  });

  it('동시에 부르면 한 번만 받는다', async () => {
    const api = server();
    const [a, b] = await Promise.all([fetchSharedVocabularySummary(client, UID), fetchSharedVocabularySummary(client, UID)]);
    expect(api.calls).toHaveLength(1);
    expect(a).toBe(b);
  });

  it('단어장이 막 받은 완전 snapshot이 신선하면 그것을 쓴다(요약 칸 ⊂ 전체 칸) — 요청 0', async () => {
    const api = server();
    const full = fullSnapshot();
    client.setQueryData(vocabularyLearningKey(UID), full);
    expect(await fetchSharedVocabularySummary(client, UID)).toBe(full);
    const home = await fetchHomeData(UID, Date.now(), { queryClient: client });
    expect(home.learning).toBe(full);
    expect(api.calls).toEqual([]);
  });

  it.each([
    ['다른 계정의 완전 snapshot', c => c.setQueryData(vocabularyLearningKey(UID), fullSnapshot(OTHER))],
    ['기기 사본(끊긴 채 받은 불완전 목록)', c => c.setQueryData(vocabularyLearningKey(UID), { ...fullSnapshot(), offline: true, complete: false })],
    ['채점 뒤 낡음 표시', c => { c.setQueryData(vocabularyLearningKey(UID), fullSnapshot()); c.invalidateQueries({ queryKey: ['vocab', UID], refetchType: 'none' }); }],
    ['신선도 밖(60초 지남)', c => c.setQueryData(vocabularyLearningKey(UID), fullSnapshot(), { updatedAt: Date.now() - VOCAB_SUMMARY_SHARE_MS - 1 })],
    ['요약 칸이 신선도 밖', c => c.setQueryData(vocabularySummaryKey(UID), fullSnapshot(), { updatedAt: Date.now() - VOCAB_SUMMARY_SHARE_MS - 1 })],
  ])('쓰지 않는다(지금처럼 받는다): %s', async (_label, arrange) => {
    const api = server();
    arrange(client);
    const got = await fetchSharedVocabularySummary(client, UID);
    expect(api.calls).toEqual([SUMMARY_URL]);
    expect(got.actorId).toBe(UID);
    expect(got.offline).toBeUndefined();
  });

  it('칸은 계정 · \'vocab\' 아래(모든 쓰기가 이미 무효화하는 앞머리) · 계정 캐시 비우기 대상', () => {
    expect(vocabularySummaryKey(UID)).toEqual(['vocab', UID, 'summary']);
    expect(vocabularyLearningKey(UID)).toEqual(['vocab', UID, 'learning']);
    expect(isAccountFreeQuery(vocabularySummaryKey(UID))).toBe(false);
    expect(settledLearningSnapshot(client, vocabularySummaryKey(UID), null, { staleTime: 1e9 })).toBe(undefined);
  });

  it('화면은 이 길로만 받는다 — 요약 소비자 셋 · 단어 레벨 색인은 뷰어와 같은 신선도 · 시작 값', () => {
    expect(read('src/views/HomePage.jsx')).toContain('queryFn: ({ client }) => fetchHomeData(user.id, Date.now(), { queryClient: client }),');
    expect(read('src/views/ProfileStats.jsx')).toContain('queryFn: ({ client }) => fetchProfileStats(user.id, Date.now(), { queryClient: client }),');
    const due = sliceBetween(read('src/views/MaterialsPage.jsx'), "queryKey: ['due-vocab-index', user?.id],", '});');
    expect(due).toContain('fetchSharedVocabularySummary(queryClient, user.id)');
    const level = sliceBetween(read('src/components/levels/word/LevelWordScreen.jsx'), "queryKey: ['vocab-words', userId],", '});');
    expect(level).toContain('staleTime: VOCAB_WORDS_STALE_MS,');
    expect(level).toContain('initialData: () => vocabWordsFromLearningCache(queryClient, userId),');
    expect(level).toContain("initialDataUpdatedAt: () => queryClient.getQueryState(['vocab', userId, 'learning'])?.dataUpdatedAt,");
    expect(level).not.toContain('staleTime: 30_000');
  });
});

describe('쓰기 뒤 — 모든 소비자가 새 숫자', () => {
  it('채점(복습방 invalidateVocabularyLearning · 패치 후 낡음 표시)이면 다음 배움 · 현황은 새로 받는다', async () => {
    const api = server();
    const before = await fetchHomeData(UID, Date.now(), { queryClient: client });
    expect(dueCount(before)).toBe(2);
    client.setQueryData(vocabularyLearningKey(UID), fullSnapshot());
    api.words = wordsV2;
    patchVocabularyLearningRow(client, UID, 'w1', wordsV2[0]);
    await invalidateVocabularyLearning(client, UID, { refetchLearning: false, deferReviewRoom: true });
    const after = await fetchHomeData(UID, Date.now(), { queryClient: client });
    const stats = await fetchProfileStats(UID, Date.now(), { queryClient: client });
    expect(api.calls).toEqual([SUMMARY_URL, SUMMARY_URL]);
    expect(dueCount(after)).toBe(2 - 1 + 1); // w1은 미래로, 새 w3는 만기
    expect(after.vocab.map(row => row.id)).toEqual(['w1', 'w2', 'w3']);
    expect(stats.vocab.map(row => row.id)).toEqual(['w1', 'w2', 'w3']);
  });

  it('화면에 떠 있는 배움(활성 조회)도 무효화 순서대로 새 snapshot으로 다시 그린다 — \'vocab\'이 앞이라 옛 칸을 집지 않는다', async () => {
    const api = server();
    const observer = new QueryObserver(client, { queryKey: [HOME_DATA_KEY, UID], queryFn: () => fetchHomeData(UID, Date.now(), { queryClient: client }), staleTime: 60000 });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.vocab).toHaveLength(2));
    api.words = wordsV2;
    await invalidateVocabularyLearning(client, UID);
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.vocab).toHaveLength(3));
    expect(api.calls).toEqual([SUMMARY_URL, SUMMARY_URL]);
    unsubscribe();
  });

  it('아는 표시 · 제외 · 단어장 무효화 목록은 \'vocab\'을 요약 소비자보다 먼저 무효화한다', () => {
    const lists = [
      sliceBetween(read('src/lib/useVocabData.js'), 'return Promise.all([', '.map(prefix'),
      sliceBetween(read('src/lib/useKnownWords.js'), 'const KNOWN_CONSUMERS = [', '];'),
      sliceBetween(read('src/lib/useVocabularyExclusions.js'), 'for (const prefix of [', '])'),
    ];
    for (const list of lists) {
      const at = name => list.indexOf(name);
      expect(at("'vocab'")).toBeGreaterThanOrEqual(0);
      for (const consumer of ['HOME_DATA_KEY', "'profile-stats'", "'due-vocab-index'"]) expect(at("'vocab'")).toBeLessThan(at(consumer));
    }
  });

  it('아는 표시가 성공하면 다음 요약 소비자는 새로 받는다', async () => {
    const api = server();
    await fetchSharedVocabularySummary(client, UID);
    api.words = wordsV2;
    knownWordsMutationOptions({ client, toast: () => {}, isActiveOwner: () => true })
      .onSuccess(null, { accountId: UID, lang: 'ja', wordText: '本w1', known: true });
    expect((await fetchSharedVocabularySummary(client, UID)).rows).toHaveLength(3);
    expect(api.calls).toHaveLength(2);
  });

  it.each([
    ['뷰어 저장 · 되돌리기 · 문맥 담기(\'vocab\' 앞머리)', c => c.invalidateQueries({ queryKey: ['vocab', UID] })],
    ['오늘 학습 · 단어장 쓰기(낡음만 표시)', c => c.invalidateQueries({ queryKey: ['vocab', UID], refetchType: 'none' })],
  ])('%s 뒤에도 새로 받는다', async (_label, write) => {
    const api = server();
    await fetchSharedVocabularySummary(client, UID);
    api.words = wordsV2;
    await write(client);
    expect((await fetchSharedVocabularySummary(client, UID)).rows).toHaveLength(3);
  });

  it('받는 중에 쓰기가 끼면(쓰기 전 숫자) 끝에서 다시 받는다 — 먼저 부른 화면 · 뒤늦게 올라탄 화면 모두 쓴 뒤 숫자', async () => {
    const api = server();
    let open;
    api.gate = new Promise(resolve => { open = resolve; });
    const first = fetchSharedVocabularySummary(client, UID); // 옛 목록(wordsV1)으로 응답할 받기
    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    api.words = wordsV2;
    await invalidateVocabularyLearning(client, UID, { refetchLearning: false });
    const joined = fetchSharedVocabularySummary(client, UID);
    api.gate = null;
    open();
    expect((await first).rows).toHaveLength(3);
    expect((await joined).rows).toHaveLength(3);
    expect(api.calls).toHaveLength(2);
    // 다시 받은 결과는 신선하다 — 다음 화면은 다시 받지 않는다.
    await fetchSharedVocabularySummary(client, UID);
    expect(api.calls).toHaveLength(2);
  });
});

describe('계정 경계 · 일찍 보낸 읽기', () => {
  it('계정이 바뀌면 칸이 지워지고(accountQueryCache) 다른 계정의 칸은 쓰지 않는다', async () => {
    server();
    await fetchSharedVocabularySummary(client, UID);
    expect(client.getQueryData(vocabularySummaryKey(UID))?.actorId).toBe(UID);
    clearAccountQueries(client);
    expect(client.getQueryData(vocabularySummaryKey(UID))).toBe(undefined);
    const other = server(OTHER);
    client.setQueryData(vocabularySummaryKey(OTHER), fullSnapshot(UID)); // 잘못 담긴 남의 snapshot
    expect((await fetchSharedVocabularySummary(client, OTHER)).actorId).toBe(OTHER);
    expect(other.calls).toEqual([SUMMARY_URL]);
  });

  it('문서 머리가 일찍 보낸 요약 읽기(VOCAB-EARLY-001)를 그대로 넘겨받는다', async () => {
    const api = server();
    const early = legacyLearningSnapshot({ actorId: UID, rows: wordsV1, fields: 'summary' });
    globalThis[VOCAB_EARLY_KEY] = { url: SUMMARY_URL, at: Date.now(), res: Promise.resolve({ ok: true, status: 200, json: async () => early }) };
    const home = await fetchHomeData(UID, Date.now(), { queryClient: client });
    expect(home.vocab.map(row => row.id)).toEqual(['w1', 'w2']);
    expect(api.calls).toEqual([]);
    expect(globalThis[VOCAB_EARLY_KEY]).toBe(undefined);
  });
});
