import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('../AuthContext', () => ({ useAuth: () => ({}) }));
vi.mock('../ToastContext', () => ({ useToast: () => () => {} }));
import { invalidateVocabularyLearning, patchVocabularyLearningRow } from '../useVocabData.js';
import { projectVocabularyLearningRows } from '../vocabularyLearningRows.js';

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
  it('writes the saved schedule into that row only and re-projects with the canonical projector', () => {
    const client = new QueryClient(), before = learning();
    client.setQueryData(key, before);
    const patch = { interval: 10.97, ease_factor: 2.1, repetitions: 0, next_review_at: '2026-11-03T01:00:00.000Z', last_reviewed_at: now };
    expect(patchVocabularyLearningRow(client, actorId, wordId, patch)).toBe(true);
    const after = client.getQueryData(key);
    expect(after.rows.find(r => r.id === wordId)).toEqual({ ...row(wordId), ...patch });
    expect(after.rows.find(r => r.id === otherId)).toBe(before.rows.find(r => r.id === otherId));
    const expected = projectVocabularyLearningRows({ ...before, rows: after.rows }, { actorId, at: after.now });
    expect(after.projections).toEqual(expected.projections);
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
});
