import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween';

// 계약: 인라인·퀘스트 채점의 오프라인 큐 합류 (W 후속 ③ — W R2 설계 §후속 후보, #1077 5504350927).
// 복습 화면만 recordReviewCompleted(이벤트 + SRS + 보상 + v2-N R2 outbox)를 탔고, 인라인(뷰어)과
// 퀘스트는 persistVocabGrade·logReviewEvents를 따로 불러 오프라인이면 채점이 유실됐다. 이제 셋이
// 같은 한 길을 탄다 — 큐에 담긴 채점은 성공으로 다루고(queued), undo는 큐 항목 제거다.

const recordReviewCompleted = vi.fn();
vi.mock('../learn/progressStore', () => ({
  recordReviewCompleted: (...args) => recordReviewCompleted(...args),
}));
const qc = { invalidateQueries: vi.fn(), setQueryData: vi.fn() };
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => qc,
  useMutation: (config) => config,
}));
vi.mock('../fsrs', () => ({
  calculateFSRS: vi.fn(() => ({ interval: 3, ease_factor: 2.6, repetitions: 1, next_review_at: '2026-09-10T00:00:00.000Z' })),
}));

const { useInlineReview, patchVocabWordsCache } = await import('../useInlineReview');

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const vocab = { id: 'v1', word_text: 'chat', meaning: '고양이', language: 'French', interval: 0, ease_factor: 0, repetitions: 0, next_review_at: '2026-09-01T00:00:00.000Z', last_reviewed_at: null };
const NEXT = { interval: 3, ease_factor: 2.6, repetitions: 1, next_review_at: '2026-09-10T00:00:00.000Z' };

describe('인라인 채점 — 한 길(recordReviewCompleted)과 큐 결과', () => {
  let fetchProfile; let toast; let hook;
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProfile = vi.fn();
    toast = vi.fn();
    hook = useInlineReview({ user: { id: 'u1' }, fetchProfile, toast });
  });

  it('정본 호출 모양 — VocabPage와 같은 reviewRef·snake_case 4필드', async () => {
    recordReviewCompleted.mockResolvedValue({ ok: true, reviewedAt: '2026-09-03T00:00:00.000Z' });
    await hook.mutationFn({ vocab, rating: 1 });
    expect(recordReviewCompleted).toHaveBeenCalledWith('u1', {
      type: 'vocab', itemKey: 'chat', lang: 'French', correct: false,
      detail: { word_id: 'v1', meaning: '고양이', rating: 1, qtype: 'flash' },
    }, NEXT);
  });

  it('큐에 담긴 채점 — 성공으로 다루고 queued를 실어 돌려준다; 토스트는 「연결되면 보내요」, 낙관 반영, streak 표시 갱신은 건너뛴다', async () => {
    recordReviewCompleted.mockResolvedValue({ ok: true, queued: true, reviewedAt: '2026-09-03T00:00:00.000Z' });
    const result = await hook.mutationFn({ vocab, rating: 3 });
    expect(result).toMatchObject({ queued: true, reviewedAt: '2026-09-03T00:00:00.000Z', nextStats: NEXT });
    expect(result.prev).toEqual({ interval: 0, ease_factor: 0, repetitions: 0, next_review_at: '2026-09-01T00:00:00.000Z', last_reviewed_at: null });
    await hook.onSuccess(result);
    expect(qc.setQueryData).toHaveBeenCalledWith(['vocab-words', 'u1'], expect.any(Function));
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['vocab-words', 'u1'] });
    expect(fetchProfile).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('복습 저장 — 연결되면 보내요', 'success', 2000);
  });

  it('온라인 저장 — queued false, 「복습 완료!」, streak 표시 갱신', async () => {
    recordReviewCompleted.mockResolvedValue({ ok: true, reviewedAt: '2026-09-03T00:00:00.000Z' });
    const result = await hook.mutationFn({ vocab, rating: 4 });
    expect(result.queued).toBe(false);
    await hook.onSuccess(result);
    expect(fetchProfile).toHaveBeenCalledWith('u1');
    expect(toast).toHaveBeenCalledWith('복습 완료!', 'success', 2000);
  });

  it('큐마저 못 쓴 환경 — { ok:false }를 삼키지 않고 던진다(무증상 유실 금지)', async () => {
    recordReviewCompleted.mockResolvedValue({ ok: false, error: new Error('offline-queue-unavailable') });
    await expect(hook.mutationFn({ vocab, rating: 2 })).rejects.toThrow('offline-queue-unavailable');
    recordReviewCompleted.mockResolvedValue(undefined);
    await expect(hook.mutationFn({ vocab, rating: 2 })).rejects.toThrow('review-save-failed');
  });
});

describe('patchVocabWordsCache — vocab-words 캐시 낙관 반영', () => {
  const apply = (cur, wordId, patch) => {
    const client = { setQueryData: vi.fn((key, updater) => updater(cur)) };
    patchVocabWordsCache(client, 'u1', wordId, patch);
    expect(client.setQueryData.mock.calls[0][0]).toEqual(['vocab-words', 'u1']);
    return client.setQueryData.mock.results[0].value;
  };

  it('같은 행이 surface·base 두 키에 걸려 있어도 id로 전부 고치고, 다른 행은 그대로 둔다(새 Map)', () => {
    const row = { id: 'v1', word_text: 'chat', base_form: 'chats', next_review_at: '2026-09-01T00:00:00.000Z' };
    const other = { id: 'v2', word_text: 'chien' };
    const cur = { byKey: new Map([['surface:chat', row], ['base:chats', row], ['surface:chien', other]]), surfaces: new Set(), bases: new Set() };
    const out = apply(cur, 'v1', { next_review_at: '2026-09-10T00:00:00.000Z', last_reviewed_at: 'x' });
    expect(out).not.toBe(cur);
    expect(out.byKey).not.toBe(cur.byKey);
    expect(out.byKey.get('surface:chat')).toEqual({ ...row, next_review_at: '2026-09-10T00:00:00.000Z', last_reviewed_at: 'x' });
    expect(out.byKey.get('base:chats')).toEqual(out.byKey.get('surface:chat'));
    expect(out.byKey.get('surface:chien')).toBe(other);
    expect(cur.byKey.get('surface:chat')).toBe(row); // 원본 무변경
  });

  it('그 단어가 없거나 캐시 모양이 다르면 캐시 그대로(같은 참조 — 리렌더 없음)', () => {
    const cur = { byKey: new Map([['surface:chien', { id: 'v2' }]]) };
    expect(apply(cur, 'v1', { x: 1 })).toBe(cur);
    expect(apply(undefined, 'v1', { x: 1 })).toBe(undefined);
    expect(apply({ rows: [] }, 'v1', { x: 1 })).toEqual({ rows: [] });
  });
});

describe('배선 계약 — 세 지점이 한 길을 타고, 큐 undo는 항목 제거', () => {
  it('훅은 정본만 부른다 — persistVocabGrade·logReviewEvents 직접 호출 부활 금지', () => {
    const hook = read('src/lib/useInlineReview.js');
    expect(hook).toContain("import { recordReviewCompleted } from './learn/progressStore';");
    expect(hook).not.toMatch(/persistVocabGrade\(|logReviewEvents\(|recordActivity\(/);
    expect(hook).not.toContain('flushReviews');
  });

  it('정본은 한 시계 — reviewedAt이 SRS 쓰기까지 닿는다', () => {
    const store = read('src/lib/learn/progressStore.js');
    expect(store).toContain('await updateVocabNextReviewRemote(userId, detail.word_id, nextStats, reviewedAt);');
    expect(store).toContain('return persistVocabGrade(supabase, wordId, nextStats, reviewedAt);');
  });

  it('퀘스트 채점은 정본을 타고(이벤트 직접 적재 없음), undo는 큐 항목 제거 / 서버 복원 두 갈래', () => {
    const quest = read('src/components/world/QuestReview.jsx');
    expect(quest).toContain("import { recordReviewCompleted } from '../../lib/learn/progressStore';");
    const g = sliceBetween(quest, 'const grade = async (rating) => {', '\n  };');
    expect(g).toContain('r = await recordReviewCompleted(userId, {');
    expect(g).not.toContain('logReviewEvents(');
    expect(g).not.toContain('persistQuestReviewGrade(');
    expect(g).toContain("if (!r?.ok) {");
    const u = sliceBetween(quest, 'const undoLast = async () => {', '\n  };');
    expect(u).toContain('if (last.queued) {');
    expect(u).toContain('await removeOutboxEntry({ userId, itemKey: last.itemKey, reviewedAt: last.reviewedAt });');
    expect(u).toContain('await persistQuestReviewGrade(supabase, last.wordId, prevStats, prevReviewedAt);');
    expect(u).toContain('if (!last.queued) logReviewEvents(userId, [{'); // 큐 undo에는 보상 이벤트 없음(원 이벤트가 서버에 없다)
    expect(quest).not.toContain('flushReviews');
  });

  it('뷰어 undo — 큐 항목 제거 / 서버 복원 두 갈래 + 낙관 반영 되돌림, 스냅샷에 queued', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("import { useInlineReview, patchVocabWordsCache } from '../lib/useInlineReview';");
    expect(viewer).toContain('queued: !!res.queued,');
    const u = sliceBetween(viewer, 'const undoInlineGrade = async () => {', '\n  };');
    expect(u).toContain('if (last.queued) {');
    expect(u).toContain('await removeOutboxEntry({ userId: user.id, itemKey: last.itemKey, reviewedAt: last.reviewedAt });');
    expect(u).toContain('await persistVocabGrade(supabase, last.wordId, prevStats, prevReviewedAt);');
    expect(u).toContain('patchVocabWordsCache(queryClient, user?.id, last.wordId, last.prev || {});');
    expect(u).toContain("queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });");
  });

  it('큐를 보내는 곳은 Layout의 flush 하나 — 새 소비처를 만들지 않는다(복습 화면 R2 잣대와 같은 undo)', () => {
    expect(read('src/components/Layout.jsx')).toContain('flushReviews(supabase, user.id, { persist: persistVocabGrade })');
    expect(read('src/views/VocabPage.jsx')).toContain('await removeOutboxEntry({ userId: user.id, itemKey: last.itemKey, reviewedAt: last.reviewedAt });');
  });
});
