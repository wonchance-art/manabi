import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({}) }));
vi.mock('../ToastContext', () => ({ useToast: () => () => {} }));
import { invalidateVocabularyLearning, patchVocabularyLearningRow, REVIEW_ROOM_DEFERRED } from '../useVocabData.js';
import { projectVocabularyLearningRows, reprojectVocabularyLearningRow, vocabularyReviewCalendar } from '../vocabularyLearningRows.js';
import { isVocabularyReviewAvailable, isVocabularyReviewDue, isVocabularyUnreviewed, vocabularyRetrievability } from '../vocabularyLearningRead.js';
import { introduceFsrsCard, scheduleFsrsReview } from '../fsrsScheduler.js';
import { wordStage } from '../growthStats.js';
import { countReviewScope, scopedFsrsCardIds } from '../reviewScope.js';
import { memoryHealth } from '../memoryHealth.js';

// 운영 실측 2026-10-23 KST: 단어장 복습 채점마다 전체 목록(fsrs_vocabulary_snapshot, 평균 2초)을 다시 읽어 작은 DB가
// 시간 초과로 넘어갔다. 복습 중에는 저장한 값을 캐시에 바로 반영하고 목록은 낡음으로만 표시한다.
const actorId = '00000000-0000-4000-8000-000000000001';
const wordId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const now = '2026-10-23T01:00:00.000Z';
const row = (id, extra = {}) => ({ id, user_id: actorId, word_text: id === wordId ? '学习' : '猫', meaning: '뜻', language: 'Chinese',
  base_form: null, created_at: '2026-10-01T00:00:00.000Z', interval: 1, ease_factor: 5, repetitions: 0,
  last_reviewed_at: '2026-10-22T01:00:00.000Z', next_review_at: '2026-10-23T00:00:00.000Z', source_material_id: null, ...extra });
const learning = () => projectVocabularyLearningRows({ version: 1, actorId, enabled: true, complete: true, registryAvailable: true, now,
  rows: [row(wordId), row(otherId)],
  registry: [wordId, otherId].map(cardId => ({ cardId, userId: actorId, enrolled: false, card: null, eligible: true, known: false,
    excluded: false, firstQuestionAt: null, nextQuestionAt: null })) }, { actorId });
const key = ['vocab', actorId, 'learning'];

describe('vocabulary learning list patch after a legacy grade', () => {
  it('writes the saved schedule into that row only and re-projects it with the canonical projector', () => {
    const client = new QueryClient(), before = learning();
    client.setQueryData(key, before);
    const patch = { interval: 10.97, ease_factor: 2.1, repetitions: 0, next_review_at: '2026-11-03T01:00:00.000Z', last_reviewed_at: now };
    expect(patchVocabularyLearningRow(client, actorId, wordId, patch)).toBe(true);
    const after = client.getQueryData(key);
    expect(after.rows.find(r => r.id === wordId)).toEqual({ ...row(wordId), ...patch });
    expect(after.rows.find(r => r.id === otherId)).toBe(before.rows.find(r => r.id === otherId));
    const expected = projectVocabularyLearningRows({ ...before, rows: after.rows }, { actorId, at: after.now });
    expect(after.projections[0]).toEqual(expected.projections[0]);
    expect(after.projections[1]).toBe(before.projections[1]);
    expect(JSON.stringify(after.projections)).not.toBe(JSON.stringify(before.projections));
  });

  it('reports false (so the caller refetches) for another account, a missing word or no cache', () => {
    const client = new QueryClient();
    expect(patchVocabularyLearningRow(client, actorId, wordId, { interval: 2 })).toBe(false);
    client.setQueryData(key, learning());
    expect(patchVocabularyLearningRow(client, actorId, '00000000-0000-4000-8000-00000000ffff', { interval: 2 })).toBe(false);
    client.setQueryData(['vocab', otherId, 'learning'], learning());
    expect(patchVocabularyLearningRow(client, otherId, wordId, { interval: 2 })).toBe(false);
  });

  it('marks the list stale without refetching it, while other learning screens still refetch', async () => {
    const client = new QueryClient();
    const vocab = vi.fn(async () => learning()), home = vi.fn(async () => ({}));
    // 화면에 떠 있는(활성) 두 목록 — 무효화가 어느 쪽을 지금 다시 읽는지 본다.
    const observers = [[key, vocab], [['home-v2', actorId], home]].map(([queryKey, queryFn]) => new QueryObserver(client, { queryKey, queryFn }));
    const stop = observers.map(observer => observer.subscribe(() => {}));
    await vi.waitFor(() => expect(client.getQueryData(key)).toBeTruthy());
    vocab.mockClear(); home.mockClear();
    await invalidateVocabularyLearning(client, actorId, { refetchLearning: false });
    expect(vocab).not.toHaveBeenCalled();
    expect(client.getQueryState(key).isInvalidated).toBe(true);
    expect(home).toHaveBeenCalledTimes(1);
    await invalidateVocabularyLearning(client, actorId);
    expect(vocab).toHaveBeenCalledTimes(1);
    stop.forEach(unsubscribe => unsubscribe());
  });

  // LOGGED-IN-PERF 감사(2026-10-25 KST, 3,000단어 합성 계정): 채점 1번마다 출처 제목 · 헷갈린 표현 조회가 다시 나갔다.
  // 세션 중에는 복습방 전용 조회를 낡음으로만 표시하고, 다른 학습 화면 무효화와 세션 밖 무효화는 그대로 다시 읽는다.
  it('defers only the review-room queries while a session is running', async () => {
    expect(REVIEW_ROOM_DEFERRED).toEqual(['vocab-titles', 'confused-events']);
    const client = new QueryClient();
    const fns = Object.fromEntries(['vocab-titles', 'confused-events', 'home-v2'].map(prefix => [prefix, vi.fn(async () => ({}))]));
    const stop = Object.entries(fns).map(([prefix, queryFn]) =>
      new QueryObserver(client, { queryKey: [prefix, actorId], queryFn }).subscribe(() => {}));
    await vi.waitFor(() => expect(client.getQueryData(['home-v2', actorId])).toBeTruthy());
    await vi.waitFor(() => expect(client.getQueryData(['confused-events', actorId])).toBeTruthy());
    Object.values(fns).forEach(fn => fn.mockClear());
    await invalidateVocabularyLearning(client, actorId, { refetchLearning: false, deferReviewRoom: true });
    expect(fns['vocab-titles']).not.toHaveBeenCalled();
    expect(fns['confused-events']).not.toHaveBeenCalled();
    expect(client.getQueryState(['confused-events', actorId]).isInvalidated).toBe(true);
    expect(fns['home-v2']).toHaveBeenCalledTimes(1);
    await invalidateVocabularyLearning(client, actorId, { refetchLearning: false });
    expect(fns['vocab-titles']).toHaveBeenCalledTimes(1);
    expect(fns['confused-events']).toHaveBeenCalledTimes(1);
    stop.forEach(unsubscribe => unsubscribe());
  });
});

// LOGGED-IN-PERF F7(2026-10-25 KST, 3,000단어 합성 계정): 채점 1번마다 전체 3,000행을 다시 투영했다(Node 16 ms → 모바일 CPU ×4 약 65 ms).
// 지금은 바뀐 행 하나만 다시 투영하고 다른 행의 투영 객체는 그대로 둔다. 투영에서 시각에 기대는 칸은 review.evaluatedAt뿐이고
// 화면은 모두 max(지금, evaluatedAt) 시계로 판정하므로, 전체 재투영과 화면 값(만기 · 단계 · 기억률 · 달력 · 오늘 개수 · 줄)이 같아야 한다.
describe('patch-one re-projection == full re-projection for everything the screens read', () => {
  const T0 = Date.parse('2026-10-25T00:00:00.000Z');
  const ids = Array.from({ length: 96 }, (_, i) => `00000000-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`);
  const iso = ms => new Date(ms).toISOString();
  function heavySnapshot() {
    const rows = [], registry = [];
    ids.forEach((id, i) => {
      const lang = i % 4 === 3 ? 'Chinese' : 'Japanese';
      const kind = i % 6;
      // 만기는 투영 시각(T0) 앞 · T0와 채점 시각 사이(그사이 만기가 된 카드) · 채점 뒤 · 며칠 뒤로 고르게 퍼뜨린다.
      const dueOffsets = [-3 * 86400000, 40_000, 90_000, 5 * 86400000, -60_000, 30 * 86400000];
      const base = { id, user_id: actorId, word_text: `${lang === 'Chinese' ? '词' : '語'}${i}`, base_form: null, meaning: i % 17 === 5 ? '' : `뜻 ${i}`,
        language: lang, created_at: iso(T0 - 40 * 86400000), source_material_id: i % 5 === 0 ? 50000 + (i % 3) : null, source_ref: null,
        interval: kind === 4 ? 0 : 1 + (i % 9) * 3.5, ease_factor: 5 + (i % 4), repetitions: i % 3,
        last_reviewed_at: kind === 4 ? null : iso(T0 - (1 + (i % 9)) * 86400000), next_review_at: iso(T0 + dueOffsets[i % dueOffsets.length]) };
      rows.push(base);
      const flags = { eligible: !(i % 23 === 7), known: i % 19 === 4, excluded: i % 29 === 11 };
      if (flags.eligible && (flags.known || flags.excluded)) flags.eligible = false;
      if (i % 7 === 2) {
        const introduced = T0 - 10 * 86400000;
        const card = scheduleFsrsReview(introduceFsrsCard(introduced), 1 + (i % 4), introduced + 60_000).card;
        registry.push({ cardId: id, userId: actorId, enrolled: true, card, nextQuestionAt: card.due, firstQuestionAt: iso(introduced + 60_000), ...flags });
      } else {
        registry.push({ cardId: id, userId: actorId, enrolled: false, card: null, nextQuestionAt: null, firstQuestionAt: null, ...flags });
      }
    });
    return projectVocabularyLearningRows({ version: 1, actorId, enabled: true, complete: true, registryAvailable: true, now: iso(T0), rows, registry }, { actorId });
  }
  const stripClock = p => ({ ...p, review: { ...p.review, evaluatedAt: null } });
  // 화면이 실제로 읽는 판정 — VocabPage · VocabList · VocabDetailCard · VocabReview · reviewScope의 시계 규칙 그대로.
  function screenValues(snapshot, clock) {
    const at = p => Math.max(clock, Date.parse(p.review.evaluatedAt) || 0);
    const quota = { active: true, remaining: 7, admittedLegacyCardIds: [ids[4], ids[10]] };
    const fsrsEntries = snapshot.registry.filter(entry => entry.enrolled);
    const scopes = [['Japanese', 'due'], ['Chinese', 'due'], ['Japanese', 'new'], ['Japanese', 'fragile']]
      .map(([lang, state]) => ({ lang, level: null, source: null, state }));
    return {
      perRow: snapshot.projections.map(p => [p.vocabulary.id, isVocabularyReviewAvailable(p), isVocabularyReviewDue(p, at(p)),
        isVocabularyUnreviewed(p), vocabularyRetrievability(p, at(p)), wordStage(p).key, p.review.nextQuestionAt, p.review.blockedReason]),
      calendar: vocabularyReviewCalendar(snapshot.projections, Math.max(clock, ...snapshot.projections.map(p => Date.parse(p.review.evaluatedAt)))),
      health: memoryHealth(snapshot.projections, clock),
      counts: scopes.map(scope => countReviewScope({ snapshot: { projections: snapshot.projections, enabled: snapshot.enabled }, scope, now: clock,
        quota, fsrsEntries, fsrsEnabled: true, pendingIds: [], canLegacy: () => true, reviewSupported: () => true })),
      fsrsScope: scopes.map(scope => scopedFsrsCardIds({ snapshot: { projections: snapshot.projections, enabled: snapshot.enabled }, scope, now: clock })),
    };
  }

  it.each([
    ['다시(1) — 1분 뒤 재질문', 4, { interval: 0.01, ease_factor: 7.2, repetitions: 1, next_review_at: '2026-10-25T00:03:00.000Z' }],
    ['알맞음(3) — 처음 채점한 새 표현', 22, { interval: 2.3, ease_factor: 5.1, repetitions: 0, next_review_at: '2026-10-27T00:02:00.000Z' }],
    ['알맞음(3) — 그사이 만기가 된 카드', 1, { interval: 12.4, ease_factor: 4.9, repetitions: 0, next_review_at: '2026-11-06T00:02:00.000Z' }],
  ])('%s', (_label, index, stats) => {
    vi.useFakeTimers();
    try {
      const gradedAt = T0 + 120_000; // 투영 2분 뒤 채점 — 그사이 만기가 된 카드(40 · 90초 뒤 만기)가 있다
      vi.setSystemTime(gradedAt);
      const client = new QueryClient(), before = heavySnapshot();
      client.setQueryData(key, before);
      const patch = { ...stats, last_reviewed_at: iso(gradedAt) };
      expect(patchVocabularyLearningRow(client, actorId, ids[index], patch)).toBe(true);
      const after = client.getQueryData(key);
      // 정본: 바뀐 행으로 전체를 같은 시각에 다시 투영(예전 구현).
      const full = projectVocabularyLearningRows({ ...before, rows: after.rows }, { actorId, at: iso(gradedAt) });
      expect(after.now).toBe(full.now);
      expect(after.rows).toEqual(full.rows);
      expect(after.registry).toBe(before.registry);
      after.projections.forEach((p, i) => {
        if (i === index) expect(p).toEqual(full.projections[i]);
        else expect(p).toBe(before.projections[i]); // 다른 행은 같은 객체 — 화면의 memo가 그대로 맞는다
        expect(stripClock(p)).toEqual(stripClock(full.projections[i])); // 시각 칸 말고는 전체 재투영과 같다
      });
      for (const clock of [gradedAt, gradedAt + 1, gradedAt + 45_000, gradedAt + 2 * 86400000]) {
        expect(screenValues(after, clock)).toEqual(screenValues(full, clock));
      }
    } finally { vi.useRealTimers(); }
  });

  it('falls back to the full projector when projections are not aligned with rows, and rejects a foreign row', () => {
    const before = heavySnapshot();
    const misaligned = { ...before, projections: before.projections.slice(1) };
    const row = { ...before.rows[3], interval: 4 };
    const result = reprojectVocabularyLearningRow(misaligned, row.id, row, { actorId, at: before.now });
    expect(result.projections).toEqual(projectVocabularyLearningRows({ ...before, rows: result.rows }, { actorId, at: before.now }).projections);
    expect(() => reprojectVocabularyLearningRow(before, row.id, { ...row, user_id: otherId }, { actorId, at: before.now })).toThrow('vocabulary_learning_invalid_rows');
    expect(() => reprojectVocabularyLearningRow(before, row.id, row, { actorId, at: iso(T0 - 1) })).toThrow('vocabulary_learning_clock_reversed');
    expect(() => reprojectVocabularyLearningRow(before, row.id, { ...row, last_reviewed_at: iso(T0 + 5000) }, { actorId, at: before.now }))
      .toThrow('vocabulary_learning_clock_reversed');
  });
});
