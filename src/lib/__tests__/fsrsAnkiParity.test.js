import { describe, expect, it } from 'vitest';
import { introduceFsrsCard, previewFsrsRatings } from '../fsrsScheduler.js';
import { beginFsrsAttempt, finishFsrsAttempt, planFsrsUndo, revealFsrsAttempt } from '../fsrsReviewSession.js';
import { calculateVocabFSRS } from '../fsrs.js';

// Anki 대조(오너 승인 2026-10-23 KST). 기대값은 실제 Anki 26.09.3 스케줄러(rslib · FSRS 켬 · 학습 1분 10분 · 재학습 10분 ·
// 목표 기억률 0.9 · 최대 365일 · 기본 매개변수)로 같은 채점 순서를 돌린 안정도(S) · 난이도(D)와 하루 안쪽 간격이다.
// 다시 돌리기: /mnt/project-files/fsrs-anki-compare/README.md. 3일 이상 간격은 Anki가 무작위로 퍼뜨려 기억 상태만 대조한다.
// 순서 원소 1–4 = 그 등급으로 채점(하루 안 단계는 차례가 오면 바로), 'D<n>' = n일 뒤로.
const T0 = Date.parse('2026-10-22T01:00:00Z');
const DAY = 86400e3;
const ANKI = {
  'A,A,A,G': { seq: [1, 1, 1, 3], S: 0.046, D: 9.579 },
  'A,A,D1,A,A,G': { seq: [1, 1, 'D1', 1, 1, 3], S: 0.028, D: 9.836 },
  'A,A,D1,G': { seq: [1, 1, 'D1', 3], S: 0.614, D: 8.792 },
  'G,G,D2,A': { seq: [3, 3, 'D2', 1], S: 0.608, D: 7.392 },
  'G,G,D2,H': { seq: [3, 3, 'D2', 2], S: 7.517, D: 4.748 },
  'G,G,D2,G': { seq: [3, 3, 'D2', 3], S: 10.971, D: 2.104 },
};
const stepWait = (t, due) => (due - t < DAY ? Math.max(t + 5000, due) : t + 5000);

function strictRun(seq) {
  let card = introduceFsrsCard(T0, { policyVersion: 'anki-v2' }), t = Date.parse(card.due);
  for (const g of seq) {
    if (typeof g === 'string') { t += Number(g.slice(1)) * DAY; continue; }
    t = Math.max(t, Date.parse(card.due));
    card = previewFsrsRatings(card, new Date(t).toISOString())[g].card;
    t = stepWait(t, Date.parse(card.due));
  }
  return { card, t };
}

function legacyRun(seq) {
  let t = T0, row = { interval: 0, ease_factor: 0, repetitions: 0, next_review_at: null, last_reviewed_at: null,
    created_at: new Date(T0 - 1000).toISOString() };
  for (const g of seq) {
    if (typeof g === 'string') { t += Number(g.slice(1)) * DAY; continue; }
    const next = calculateVocabFSRS(g, row, t);
    row = { ...row, ...next, last_reviewed_at: new Date(t).toISOString() };
    t = stepWait(t, Date.parse(next.next_review_at));
  }
  return { row, t };
}

describe('FSRS matches Anki (memory state for both card paths)', () => {
  for (const [name, { seq, S, D }] of Object.entries(ANKI)) {
    it(`${name}: server card and legacy word row land on Anki's S/D`, () => {
      const { card } = strictRun(seq);
      expect(card.stability).toBeCloseTo(S, 2);
      expect(card.difficulty).toBeCloseTo(D, 2);
      const { row } = legacyRun(seq);
      expect(row.interval).toBeCloseTo(S, 2);
      expect(row.ease_factor).toBeCloseTo(D, 2);
    });
  }

  it('repeated same-day Again keeps Good at 1 day and Easy one day above it (Anki 1d · 2d)', () => {
    const { card, t } = strictRun([1, 1, 1, 3]);
    const p = previewFsrsRatings(card, new Date(Math.max(t, Date.parse(card.due))).toISOString());
    expect([3, 4].map(g => p[g].card.scheduledDays)).toEqual([1, 2]);
    const { row, t: lt } = legacyRun([1, 1, 1, 3]);
    expect([3, 4].map(g => Math.round((Date.parse(calculateVocabFSRS(g, row, lt).next_review_at) - lt) / DAY))).toEqual([1, 2]);
  });

  it('relearning Easy is one day above Good too (Anki 10m · 15m · 1d · 2d)', () => {
    const { row, t } = legacyRun([3, 3, 'D2', 1]);
    const ms = [1, 2, 3, 4].map(g => Date.parse(calculateVocabFSRS(g, row, t).next_review_at) - t);
    expect(ms.slice(0, 2)).toEqual([600e3, 900e3]);
    expect(ms.slice(2).map(v => Math.round(v / DAY))).toEqual([1, 2]);
  });

  it('a legacy review-stage row reads its real last review, not due minus stability', () => {
    // 2일 카드를 제때 복습 — Anki의 다음 안정도. 예전 calculateFSRS는 마지막 복습을 0.3일 당겨 추정해 S 13.8로 길었다.
    const reviewedAt = Date.parse('2026-10-20T01:00:00Z');
    const row = { interval: 2.3065, ease_factor: 2.1105, repetitions: 0, last_reviewed_at: new Date(reviewedAt).toISOString(),
      next_review_at: new Date(reviewedAt + 2 * DAY).toISOString(), created_at: new Date(reviewedAt - 600e3).toISOString() };
    expect(calculateVocabFSRS(3, row, reviewedAt + 2 * DAY).interval).toBeCloseTo(10.971, 2);
    // 차례 전 채점(단어장 인라인 복습은 막지 않는다)도 같은 계산으로 받는다.
    expect(Date.parse(calculateVocabFSRS(3, row, reviewedAt + DAY).next_review_at)).toBeGreaterThan(reviewedAt + 2 * DAY);
  });

  it('a learning-stage Easy graded before the Easy floor can still be undone', () => {
    let card = introduceFsrsCard(T0, { policyVersion: 'anki-v2' });
    for (let i = 0; i < 3; i++) card = previewFsrsRatings(card, card.due)[1].card;
    const question = card.due, revealed = new Date(Date.parse(question) + 3000).toISOString();
    const attempt = revealFsrsAttempt(beginFsrsAttempt(card, { id: 'attempt', userId: 'alice', cardId: 'word', at: question }), revealed);
    // 쉬움 하한 전 채점은 날 경계 기한(2026-10-25 KST) 전이기도 하다 — 둘 다 그때 계산으로 짓는다.
    const old = finishFsrsAttempt(attempt, 4, { operationId: 'grade', at: revealed, easyFloor: false, dayDue: false });
    const now = finishFsrsAttempt(attempt, 4, { operationId: 'grade', at: revealed });
    expect([old.nextCard.scheduledDays, now.nextCard.scheduledDays]).toEqual([1, 2]);
    for (const op of [old, now]) {
      expect(planFsrsUndo(op, op.nextCard, { operationId: 'undo', userId: 'alice', cardId: 'word', at: revealed }).nextCard)
        .toEqual({ ...op.previousCard, revision: op.nextCard.revision + 1 });
    }
    const forged = { ...old, nextCard: { ...old.nextCard, due: now.nextCard.due } };
    expect(() => planFsrsUndo(forged, forged.nextCard, { operationId: 'undo', userId: 'alice', cardId: 'word', at: revealed })).toThrow('invalid_grade_snapshot');
  });
});
