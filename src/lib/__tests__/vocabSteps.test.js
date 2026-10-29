import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { calculateFSRS, calculateVocabFSRS, vocabStepPhase, VOCAB_STEP_POLICY } from '../fsrs';
import { FSRS_POLICIES } from '../fsrsScheduler';

// 계약: 단어 카드 학습 단계(오너 지시 2026-10-19 KST — 「뷰어 쪽에도 이번에 적용한 anki 값대로 분, 날짜 수 적용」).
// 옛 일정 단어 행(뷰어 저장 · 인라인 복습 · 복습실 옛 카드 · 퀘스트 · 학습 세션 · 단어 페이지)이 복습실 FSRS 카드와 같은
// anki-v2 학습 단계(1분 · 10분, 재학습 10분)를 따른다. 하루 이상 간격(복습 단계)의 어려움 · 알맞음 · 쉬움은 예전 계산 그대로.
const MIN = 60_000, DAY = 86_400_000;
const at = Date.parse('2026-10-19T03:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const gap = (stats, from = at) => Date.parse(stats.next_review_at) - from;

describe('단어 학습 단계 — anki-v2', () => {
  it('정책은 운영 FSRS 카드와 같은 anki-v2(학습 1분 · 10분, 재학습 10분)', () => {
    expect(VOCAB_STEP_POLICY).toBe('anki-v2');
    expect(FSRS_POLICIES[VOCAB_STEP_POLICY]).toEqual({ learning: [60, 600], relearning: [600] });
  });

  it('새 단어: 다시 1분 · 어려움 5.5분 · 알맞음 10분 · 쉬움 8일', () => {
    expect([1, 2, 3].map((g) => gap(calculateVocabFSRS(g, undefined, at)) / MIN)).toEqual([1, 5.5, 10]);
    expect(Math.round(gap(calculateVocabFSRS(4, undefined, at)) / DAY)).toBe(8);
  });

  it('담으며 알맞음(둘째 단계) → 다음 채점: 알맞음이면 졸업(2일), 다시면 1분', () => {
    const saved = calculateVocabFSRS(3, undefined, at);
    expect(vocabStepPhase(saved)).toEqual({ state: 'Learning', step: 1 });
    const later = at + 11 * MIN;
    expect(gap(calculateVocabFSRS(1, saved, later), later)).toBe(MIN);
    expect(gap(calculateVocabFSRS(2, saved, later), later)).toBe(10 * MIN);
    expect(gap(calculateVocabFSRS(3, saved, later), later) / DAY).toBeGreaterThanOrEqual(1);
  });

  it('채점한 행은 마지막 채점 → 다음 복습 간격으로 단계를 읽는다(하루 미만 = 학습 단계)', () => {
    const row = { interval: 2.3, ease_factor: 2.1, repetitions: 0, last_reviewed_at: iso(at - 12 * MIN), next_review_at: iso(at - 2 * MIN) };
    expect(vocabStepPhase(row)).toEqual({ state: 'Learning', step: 1 });
    expect(vocabStepPhase({ ...row, next_review_at: iso(at - 11 * MIN), last_reviewed_at: iso(at - 12 * MIN) })).toEqual({ state: 'Learning', step: 0 });
    expect(vocabStepPhase({ ...row, last_reviewed_at: iso(at - 3 * DAY) })).toEqual({ state: 'Review', step: 0 });
  });

  it('하루 간격 카드는 몇 ms 모자라게 찍혀도 복습 단계 — next_review_at은 계산 시각, last_reviewed_at은 기록 시각(조금 뒤)', () => {
    const row = { interval: 1.2, ease_factor: 2.1, repetitions: 1, next_review_at: iso(at), last_reviewed_at: iso(at - DAY + 3) };
    expect(vocabStepPhase(row)).toEqual({ state: 'Review', step: 0 });
    expect(gap(calculateVocabFSRS(1, row, at), at)).toBe(10 * MIN); // 다시 = 재학습 10분(1분이 아니다)
    expect(gap(calculateVocabFSRS(2, row, at), at)).toBeGreaterThan(DAY); // 어려움 = 일 단위(10분이 아니다)
  });

  afterEach(() => vi.useRealTimers());

  it('복습 단계 단어: 다시 = 10분 재학습(기억 상태는 예전 계산 그대로), 그 밖은 예전 일 단위 계산 그대로', () => {
    // 예전 계산(calculateFSRS)은 지금 시각을 읽는다 — 같은 시각으로 맞춰 비교한다(날이 바뀌는 자정 무렵에 하루 어긋났다, 2026-10-20 00:12 KST 실측).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at);
    const review = { interval: 20, ease_factor: 5, repetitions: 0, next_review_at: iso(at), last_reviewed_at: iso(at - 20 * DAY) };
    const again = calculateVocabFSRS(1, review, at);
    expect(gap(again)).toBe(10 * MIN);
    expect(again.repetitions).toBe(1);
    expect(again.interval).toBeCloseTo(calculateFSRS(1, review).interval, 6);
    for (const g of [2, 3, 4]) {
      const next = calculateVocabFSRS(g, review, at), old = calculateFSRS(g, review);
      expect(next.interval).toBeCloseTo(old.interval, 6);
      expect(Math.round(gap(next) / DAY)).toBe(Math.round((Date.parse(old.next_review_at) - Date.now()) / DAY));
    }
    // 재학습(10분) 뒤: 다시 10분 · 어려움 15분 · 알맞음은 하루 이상으로 졸업.
    const relearn = { ...again, last_reviewed_at: iso(at) };
    expect(vocabStepPhase(relearn)).toEqual({ state: 'Relearning', step: 0 });
    const later = at + 11 * MIN;
    expect(gap(calculateVocabFSRS(1, relearn, later), later)).toBe(10 * MIN);
    expect(gap(calculateVocabFSRS(2, relearn, later), later)).toBe(15 * MIN);
    expect(gap(calculateVocabFSRS(3, relearn, later), later)).toBeGreaterThanOrEqual(DAY);
  });

  it('간격 상한 365일은 그대로', () => {
    // 일 단위 계산은 지금 시각에서 센다 — 기준 시각(at)에 맞춰 둔다(at에서 하루가 지나자 366.0003일로 실패, 2026-10-20 12:01 KST CI 실측).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(at);
    const review = { interval: 300, ease_factor: 1, repetitions: 0, next_review_at: iso(at), last_reviewed_at: iso(at - 300 * DAY) };
    expect(gap(calculateVocabFSRS(4, review, at)) / DAY).toBeLessThanOrEqual(366);
  });

  it('단어 채점 길은 모두 calculateVocabFSRS — 단계를 잇도록 마지막 채점 · 담은 시각을 넘긴다. 문법 · 드릴은 예전 계산', () => {
    const vocab = ['src/lib/useInlineReview.js', 'src/views/VocabPage.jsx', 'src/components/world/QuestReview.jsx', 'src/lib/studyExerciseBridge.js', 'src/lib/levelWordStatus.js'];
    for (const f of vocab) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).toMatch(/calculateVocabFSRS\(/);
      expect(src, f).not.toMatch(/\bcalculateFSRS\(/);
      expect(src, f).toMatch(/last_reviewed_at: \w+\.last_reviewed_at,\s*created_at: \w+\.created_at/);
    }
    expect(fs.readFileSync('src/lib/vocabIO.js', 'utf8')).toMatch(/calculateVocabFSRS\(grade, undefined/);
    for (const f of ['src/lib/grammarSrs.js', 'src/lib/drillSrs.js']) expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/calculateVocabFSRS/);
  });
});
