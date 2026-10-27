// SNAPSHOT-CARDS-001(오너 「A안 적용」 2026-10-26 KST) — 저장 · 채점 뒤 색인(['vocab-words'])을 전체 snapshot으로 다시 받지 않고 그 카드만 붙인다.
// ⑴ 붙인 색인 = 전체 snapshot(그 카드만 새 값)으로 다시 만든 색인(열쇠 순서 규칙 · 언어 열쇠 · 투영 · 등록 정보) — 표기가 겹치는 카드 포함
// ⑵ 되짚을 수 없으면 null(호출부가 전체로) · 다른 계정은 버림 · 평가 전송 중 행은 지킨다 · 붙인 뒤 낡음 표시만(다시 받지 않음)
// ⑶ 배선 — 뷰어 저장 셋 · 교정 · 한국어 저장 · 단어장 글자 칸 저장 · FSRS 채점이 이 길을 쓰고, 되돌리기는 지금처럼 전체 무효화.
// 실제 SQL 출력(모든 fixture 학습자 · 3,000단어) 위의 같은 동치는 supabase/tests/vocabulary-snapshot-cards.mjs가 본다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/query-core';
import { sliceBetween } from './helpers/sliceBetween';
import { buildVocabularyWordIndex, mergeVocabularyWordIndexCards } from '../vocabularyDueIndex';
import { projectVocabularyLearningRows } from '../vocabularyLearningRows';
import { defaultRegistryEntry } from '../vocabularySnapshotLight';
import { introduceFsrsCard } from '../fsrsScheduler';
import { beginVocabularyReview, refreshVocabWordsCards } from '../viewerVocabularyCache';

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ACTOR = '10000000-0000-4000-8000-0000000000aa';
const OTHER = '10000000-0000-4000-8000-0000000000bb';
const NOW = '2026-10-26T03:00:00.000Z';
const AT = Date.parse(NOW) + 60000;
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const KEYS = ['byKey', 'surfaces', 'bases', 'projectionsById', 'registryById', 'actorId', 'enabled', 'complete', 'registryAvailable', 'now'];

/** 표기 · 기본형이 겹치는 카드(같은 언어 · 다른 언어) · 아는 단어 · 제외 · 등록(FSRS) · 언어 없음이 섞인 snapshot(행은 id 오름차순 — SQL과 같다). */
function snapshot(actorId = ACTOR) {
  const spec = [
    ['Japanese', 'ねこ', 'ねこ'], ['Japanese', 'ねこ', '猫'], ['Japanese', '食べた', '食べる'], ['Japanese', '食べて', '食べる'],
    ['Japanese', 'ok', 'ok'], ['English', 'ok', 'ok'], ['Chinese', '学校', '学校'], [null, 'nolang', ''], ['Japanese', 'ねこ', 'ねこ'],
  ];
  const rows = spec.map(([language, word, base], i) => ({ id: id(i + 1), user_id: actorId, word_text: word, base_form: base, meaning: `뜻 ${i + 1}`,
    language, created_at: NOW, interval: 2, ease_factor: 2.5, repetitions: 1, last_reviewed_at: '2026-10-20T00:00:00.000Z',
    next_review_at: i % 2 ? '2026-10-25T00:00:00.000Z' : '2026-10-30T00:00:00.000Z', source_material_id: null, source_ref: null }));
  const registry = rows.map(row => defaultRegistryEntry(row.id, actorId));
  const card = introduceFsrsCard(Date.parse(NOW) - 3600000, { policyVersion: 'anki-v2' });
  Object.assign(registry[2], { enrolled: true, card, nextQuestionAt: card.due });
  Object.assign(registry[3], { known: true, excluded: true, eligible: false });
  Object.assign(registry[6], { excluded: true, eligible: false });
  return { version: 1, learningAdmissionVersion: 1, actorId, enabled: true, registryAvailable: true, complete: true, now: NOW, rows, registry };
}
const without = (full, cardId) => ({ ...full, rows: full.rows.filter(r => r.id !== cardId), registry: full.registry.filter(e => e.cardId !== cardId) });
const cardsOf = (full, ids) => projectVocabularyLearningRows({ ...full, rows: full.rows.filter(r => ids.includes(r.id)), registry: full.registry.filter(e => ids.includes(e.cardId)) },
  { actorId: full.actorId });
const pickKeys = index => Object.fromEntries(KEYS.map(key => [key, index[key]]));

describe('⑴ 붙인 색인 = 전체 snapshot으로 다시 만든 색인', () => {
  const full = snapshot();
  const want = pickKeys(buildVocabularyWordIndex(full, AT));
  it.each(full.rows.map(row => [row.id, row.word_text]))('막 담은 카드 %s(%s) — 겹치는 표기의 열쇠 주인도 같다', cardId => {
    const merged = mergeVocabularyWordIndexCards(buildVocabularyWordIndex(without(full, cardId), AT), cardsOf(full, [cardId]), { ids: [cardId], at: AT });
    expect(pickKeys(merged)).toEqual(want);
  });
  it('여러 장을 한 번에 · 바뀐 카드(뜻 · 일정 · 판정)도 같다', () => {
    const ids = [id(2), id(4), id(9)];
    const stale = { ...full, rows: full.rows.map(r => (ids.includes(r.id) ? { ...r, meaning: '옛 뜻', interval: 40 } : r)),
      registry: full.registry.map(e => (ids.includes(e.cardId) ? defaultRegistryEntry(e.cardId, ACTOR) : e)) };
    const base = buildVocabularyWordIndex(stale, AT);
    const merged = mergeVocabularyWordIndexCards(base, cardsOf(full, ids), { ids, at: AT });
    expect(pickKeys(merged)).toEqual(want);
    expect(base.byKey.get(`surface:ねこ`).meaning).toBe('옛 뜻'); // 원래 색인은 그대로(새 Map)
  });
  it('담기 직후 낙관 행(insertConfirmedVocabulary — 열쇠 둘만)이 있어도 같은 결과로 바뀐다', () => {
    const cardId = id(9);
    const base = buildVocabularyWordIndex(without(full, cardId), AT);
    const raw = full.rows.find(r => r.id === cardId);
    const optimistic = { ...base, byKey: new Map(base.byKey).set(`surface:${raw.word_text}`, raw) };
    expect(pickKeys(mergeVocabularyWordIndexCards(optimistic, cardsOf(full, [cardId]), { ids: [cardId], at: AT }))).toEqual(want);
  });
  it('투영은 서버 판정 그대로 — 등록 카드의 다음 질문 · 아는 단어 · 제외가 붙는다(브라우저가 판정하지 않는다)', () => {
    const merged = mergeVocabularyWordIndexCards(buildVocabularyWordIndex(without(full, id(3)), AT), cardsOf(full, [id(3)]), { ids: [id(3)], at: AT });
    expect(merged.registryById.get(id(3))).toBe(full.registry[2]);
    expect(merged.projectionsById.get(id(3))).toEqual(buildVocabularyWordIndex(full, AT).projectionsById.get(id(3)));
  });
});

describe('⑵ 되짚을 수 없으면 null · 다른 계정 · 전송 중 평가', () => {
  const full = snapshot();
  const index = () => buildVocabularyWordIndex(without(full, id(1)), AT);
  it.each([
    ['색인이 없음', () => [undefined, cardsOf(full, [id(1)]), [id(1)]]],
    ['불완전 색인(받기 실패 사본)', () => [{ ...index(), complete: false }, cardsOf(full, [id(1)]), [id(1)]]],
    ['다른 계정의 응답', () => [index(), cardsOf(snapshot(OTHER), [id(1)]), [id(1)]]],
    ['FSRS 켜짐이 다름', () => [index(), cardsOf({ ...full, enabled: false }, [id(1)]), [id(1)]]],
    ['요청한 카드가 응답에 없는데 색인에 있음(지워짐)', () => [buildVocabularyWordIndex(full, AT), cardsOf(full, []), [id(2)]]],
    ['이미 있던 카드의 표기가 바뀜', () => [buildVocabularyWordIndex(full, AT), cardsOf({ ...full, rows: full.rows.map(r => (r.id === id(2) ? { ...r, word_text: 'いぬ' } : r)) }, [id(2)]), [id(2)]]],
  ])('%s → null', (_name, make) => {
    const [current, cards, ids] = make();
    expect(mergeVocabularyWordIndexCards(current, cards, { ids, at: AT })).toBeNull();
  });
  it('응답에도 색인에도 없는 id는 그냥 넘어간다(전체로 다시 만들어도 없다)', () => {
    expect(pickKeys(mergeVocabularyWordIndexCards(index(), cardsOf(full, []), { ids: [id(77)], at: AT }))).toEqual(pickKeys(index()));
  });
});

describe('⑵ refreshVocabWordsCards — 그 카드만 받아 붙이고 낡음 표시만', () => {
  const full = snapshot();
  const key = ['vocab-words', ACTOR];
  const setupClient = (data = buildVocabularyWordIndex(without(full, id(1)), AT)) => {
    const client = new QueryClient();
    client.setQueryData(key, data);
    vi.spyOn(client, 'invalidateQueries');
    return client;
  };
  it('붙이고(전체로 다시 만든 것과 같다) refetchType none으로만 무효화 — 전체 snapshot을 다시 받지 않는다', async () => {
    const client = setupClient();
    const fetchCards = vi.fn(async (actor, ids) => cardsOf(full, ids));
    expect(await refreshVocabWordsCards(client, ACTOR, [id(1), id(1), 'not-a-uuid'], { fetchCards })).toBe('patched');
    expect(fetchCards).toHaveBeenCalledExactlyOnceWith(ACTOR, [id(1)], expect.objectContaining({ getActorId: expect.any(Function) }));
    const { now, ...got } = pickKeys(client.getQueryData(key));
    const { now: _n, ...want } = pickKeys(buildVocabularyWordIndex(full, AT));
    expect(got).toEqual(want);
    expect(client.invalidateQueries.mock.calls).toEqual([[{ queryKey: key, refetchType: 'none' }]]);
    expect(client.getQueryState(key).isInvalidated).toBe(true);
  });
  it('평가 전송 중 행(__pendingReview)은 그대로 둔다 — 전체 받기와 같은 길(preservePendingVocabularyReviews)', async () => {
    const client = setupClient(buildVocabularyWordIndex(full, AT));
    const row = full.rows[1];
    beginVocabularyReview(client, ACTOR, row, { interval: 9 });
    await refreshVocabWordsCards(client, ACTOR, [row.id], { fetchCards: async (actor, ids) => cardsOf(full, ids) });
    const kept = client.getQueryData(key).byKey.get(`Japanese:base:猫`);
    expect(kept).toMatchObject({ id: row.id, interval: 9 });
    expect(kept.__pendingReview).toBeTruthy();
  });
  it.each([
    ['다른 계정의 응답', async () => cardsOf(snapshot(OTHER), [id(1)])],
    ['계정이 바뀐 뒤 도착(owner mismatch)', async () => { throw Object.assign(new Error('x'), { code: 'vocabulary_learning_owner_mismatch' }); }],
  ])('%s → 버린다(색인 · 무효화 그대로)', async (_name, fetchCards) => {
    const client = setupClient();
    const before = client.getQueryData(key);
    expect(await refreshVocabWordsCards(client, ACTOR, [id(1)], { fetchCards })).toBe('discarded');
    expect(client.getQueryData(key)).toBe(before);
    expect(client.invalidateQueries).not.toHaveBeenCalled();
  });
  it.each([
    ['id 없음(이미 있던 단어 — upsert가 행을 돌려주지 않음)', [], async () => cardsOf(full, [])],
    ['좁은 읽기 실패', [id(1)], async () => { throw Object.assign(new Error('x'), { code: 'fsrs_storage_unavailable' }); }],
    ['붙일 수 없음(표기가 바뀜)', [id(2)], async () => cardsOf({ ...full, rows: full.rows.map(r => (r.id === id(2) ? { ...r, word_text: 'いぬ' } : r)) }, [id(2)])],
  ])('%s → 지금처럼 전체 무효화(다시 받기)', async (_name, ids, fetchCards) => {
    const client = setupClient();
    expect(await refreshVocabWordsCards(client, ACTOR, ids, { fetchCards })).toBe('full');
    expect(client.invalidateQueries.mock.calls).toEqual([[{ queryKey: key }]]);
  });
  it('색인이 아직 없으면 · 그 사이 전체 받기가 진행 중이면 전체로(진행 중인 받기는 저장 전 것일 수 있다)', async () => {
    const empty = new QueryClient(); vi.spyOn(empty, 'invalidateQueries');
    const fetchCards = vi.fn(async (actor, ids) => cardsOf(full, ids));
    expect(await refreshVocabWordsCards(empty, ACTOR, [id(1)], { fetchCards })).toBe('full');
    expect(fetchCards).not.toHaveBeenCalled();
    const busy = setupClient();
    void busy.prefetchQuery({ queryKey: key, queryFn: () => new Promise(() => {}), staleTime: 0 });
    expect(await refreshVocabWordsCards(busy, ACTOR, [id(1)], { fetchCards })).toBe('full');
  });
});

describe('⑶ 배선 — 저장 · 채점은 그 카드만, 되돌리기는 지금처럼', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  const level = read('src/lib/useLevelWordGrade.js');
  const FULL_VIEWER = "invalidateQueries({ queryKey: ['vocab-words', user?.id] })";
  it('뷰어 원탭 담기 · 등급과 함께 담기 · 교정 반영 · 한국어 저장', () => {
    const inline = sliceBetween(viewer, 'const saveInlineVocabulary = async', 'const undoLastSave');
    expect(inline).toContain('const inserted = await upsertViewerVocabulary(buildVocabRow({');
    expect(inline).toContain('void refreshVocabWordsCards(queryClient, user?.id, inserted.map(row => row.id));');
    expect(inline).not.toContain(FULL_VIEWER);
    const graded = sliceBetween(viewer, 'const addToVocab = async', 'const undo = await prepareViewerSaveUndo(');
    expect(graded).toContain('insertConfirmedVocabulary(queryClient, user.id, inserted[0]);\n      // ');
    expect(graded).toContain('void refreshVocabWordsCards(queryClient, user.id, inserted.map(row => row.id));');
    expect(graded).toContain("queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });"); // 학습 목록은 그대로
    expect(graded).not.toContain(FULL_VIEWER);
    const sync = sliceBetween(viewer, 'const syncSavedVocab = async', 'const applyCorrectionToVocab');
    expect(sync).toContain('void refreshVocabWordsCards(queryClient, user?.id, [vocab.id]);');
    expect(sync).not.toContain(FULL_VIEWER);
    const korean = sliceBetween(viewer, 'async function saveKoreanVocabulary(', 'async function attachReadingContext(');
    expect(korean).toContain('void refreshVocabWordsCards(queryClient, accountId, [result.vocabulary?.id || result.vocabularyId]);');
    expect(korean).toContain("for (const key of ['vocab', 'vocabulary-contexts', 'book-review']) {");
  });
  it('되돌리기(담기 · 본문 안 채점)는 지금처럼 전체 무효화', () => {
    expect(sliceBetween(viewer, 'const undoLastSave = async', 'const savedRowId')).toContain(FULL_VIEWER);
    expect(sliceBetween(viewer, 'const undoInlineGrade = async', 'const undoAny')).toContain(FULL_VIEWER);
  });
  it('단어장 글자 칸: 담기 · FSRS 채점은 그 카드만, 되돌리기 · 이미 있던 단어의 ☆는 전체', () => {
    const save = sliceBetween(level, 'const save = useCallback(', 'const legacy = useCallback(');
    expect(save).toContain('void refreshVocabWordsCards(queryClient, userId, [inserted.id]);');
    expect(save).not.toContain('invalidateQueries({ queryKey: vocabKey(userId) })');
    const fsrs = sliceBetween(level, "if (engine === 'fsrs') {", "return { ok: false, reason: 'not-due' };");
    expect(fsrs).toContain('void refreshVocabWordsCards(queryClient, userId, [row.id]);');
    expect(fsrs).not.toContain('invalidateQueries');
    expect(sliceBetween(level, 'const undo = useCallback(', 'const star = useCallback(')).toContain('queryClient.invalidateQueries({ queryKey: vocabKey(userId) });');
    expect(sliceBetween(level, 'const star = useCallback(', 'const undoable')).toContain('queryClient.invalidateQueries({ queryKey: vocabKey(userId) });');
  });
});
