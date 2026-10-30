// LEVEL-UNDO-REGRADE-001 — 단어 페이지에서 되돌린 FSRS 카드를 다시 채점할 수 없던 것. 서버는 되돌린 카드를 30초 뒤에야 다시 묻는다
// (next_question_at = 되돌린 시각 + 30초, 운영 2026-10-30 12:56:51 → 12:57:21 KST). 단어 페이지는 그동안 「복습 차례에만」으로 막았다(요청 0).
// 이제 60초 창 안이면 채점을 받아 두었다가 차례가 오면 보낸다 — 기다림은 줄 밖, 되돌리기는 기다리는 채점 뒤.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FSRS_GRADE_WAIT_MS, fsrsGradeWait, gradeEngine } from '../levelWordStatus';

const log = [];
let ready = () => true;
vi.mock('../useFsrsReview', () => ({ createFsrsReviewController: () => {
  let current = null, last = null;
  return {
    start() {}, dispose() {}, setWords() {},
    getSnapshot: () => ({ current, cards: [], error: null }),
    async question(id) { if (!ready()) { log.push(`refused:${id}`); return false; } log.push(`question:${id}`); current = { cardId: id, phase: 'question' }; return true; },
    async reveal() { current = { ...current, phase: 'revealed' }; return true; },
    async grade(r) { log.push(`grade:${current.cardId}:${r}`); last = current.cardId; current = null; return true; },
    async undo() { if (!last) return false; log.push(`undo:${last}`); last = null; return true; },
  };
} }));
vi.mock('../fsrsLearningClient', () => ({ createFsrsLearningClient: () => ({}) }));
const { gradeLevelFsrs, undoLevelFsrs, disposeLevelFsrs } = await import('../levelFsrsGrade');
const owner = '10000000-0000-4000-8000-000000000001';
afterEach(() => { disposeLevelFsrs(); log.length = 0; vi.useRealTimers(); ready = () => true; });

const T = Date.parse('2026-10-30T03:56:52Z');
const fsrs = (nextQuestionAt) => ({ source: 'fsrs-v1', review: { available: true, nextQuestionAt } });

describe('LEVEL-UNDO-REGRADE-001 — 곧 차례인 카드(되돌린 뒤 30초 · 곧 오는 학습 단계)', () => {
  it('60초 창 안이면 채점할 수 있고(기다릴 ms), 창 밖은 지금처럼 못 한다', () => {
    expect(fsrsGradeWait(fsrs('2026-10-30T03:57:21.791Z'), T)).toBe(29791);
    expect(gradeEngine({ projection: fsrs('2026-10-30T03:57:21.791Z'), row: { id: 'A' }, at: T })).toBe('fsrs');
    expect(fsrsGradeWait(fsrs('2026-10-30T03:50:00Z'), T)).toBe(0);
    expect(fsrsGradeWait(fsrs(new Date(T + FSRS_GRADE_WAIT_MS + 1000).toISOString()), T)).toBeNull();
    expect(gradeEngine({ projection: fsrs('2026-10-31T19:00:00Z'), row: { id: 'A' }, at: T })).toBeNull();
  });
  it('기다린 뒤 보낸다 — 그동안 다른 카드 채점은 줄을 막지 않는다', async () => {
    vi.useFakeTimers();
    const a = gradeLevelFsrs({ accountId: owner, row: { id: 'A' }, rating: 3, waitMs: 30000 });
    const b = gradeLevelFsrs({ accountId: owner, row: { id: 'B' }, rating: 4 });
    await vi.advanceTimersByTimeAsync(100);
    expect(await b).toEqual({ ok: true });
    expect(log).toEqual(['question:B', 'grade:B:4']);
    await vi.advanceTimersByTimeAsync(32000);
    expect(await a).toEqual({ ok: true });
    expect(log).toEqual(['question:B', 'grade:B:4', 'question:A', 'grade:A:3']);
  });
  it('되돌리기는 기다리는 채점이 보내진 뒤에 — 그 채점을 되돌린다', async () => {
    vi.useFakeTimers();
    const a = gradeLevelFsrs({ accountId: owner, row: { id: 'A' }, rating: 2, waitMs: 20000 });
    const u = undoLevelFsrs({ accountId: owner });
    await vi.advanceTimersByTimeAsync(25000);
    await a; await u;
    expect(log).toEqual(['question:A', 'grade:A:2', 'undo:A']);
  });
});
