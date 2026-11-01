import { describe, expect, it } from 'vitest';
import { buildWeeklyReport, isGradedReviewEvent, weekRangeLabel } from '../weeklyReport.js';
import { learningWeekStartMs } from '../growthStats.js';

// 🈁 주간 리포트 집계 계약(rfc-weekly-report R1) — 결정적·주간 경계는 growthStats 정본.

// 기준: 2026-08-20(목) 12:00 KST = 03:00 UTC. 이번 주 = 8/17(월) 04시~, 지난주 = 8/10(월) 04시~(학습일 경계 — STATS-MAP-001).
const NOW = Date.UTC(2026, 7, 20, 3, 0, 0);
const WEEK_START = learningWeekStartMs(NOW);
const iso = (offsetMs) => new Date(WEEK_START + offsetMs).toISOString();
const DAY = 86400000;

describe('isGradedReviewEvent — 채점 판정(EWMA 다이얼과 동일 결)', () => {
  it('ui·dict 소스는 정답률 신호가 아니다', () => {
    expect(isGradedReviewEvent({ source: 'vocab' })).toBe(true);
    expect(isGradedReviewEvent({ source: 'grammar' })).toBe(true);
    expect(isGradedReviewEvent({ source: 'ui' })).toBe(false);
    expect(isGradedReviewEvent({ source: 'dict' })).toBe(false);
    expect(isGradedReviewEvent(null)).toBe(false);
  });
});

describe('buildWeeklyReport — 이번 주·지난주 슬라이스', () => {
  it('주는 월요일 KST 04시에 시작한다 — 월요일 새벽 복습은 지난주(실제 기억률 · 새 단어 몫과 같은 학습일)', () => {
    expect(WEEK_START).toBe(Date.parse('2026-08-17T04:00:00+09:00'));
    const report = buildWeeklyReport({ now: NOW, events: [
      { source: 'vocab', correct: true, created_at: '2026-08-17T02:30:00+09:00' }, // 월요일 새벽 = 일요일 학습일
      { source: 'vocab', correct: true, created_at: '2026-08-17T04:00:00+09:00' },
    ] });
    expect(report.reviews.total).toBe(1);
    expect(report.prevReviews.total).toBe(1);
  });

  it('월요일 경계로 가르고, 채점 문항만 정답률에 넣는다', () => {
    const report = buildWeeklyReport({
      now: NOW,
      events: [
        { source: 'vocab', correct: true, created_at: iso(DAY) },        // 이번 주 정답
        { source: 'grammar', correct: false, created_at: iso(2 * DAY) }, // 이번 주 오답
        { source: 'dict', correct: true, created_at: iso(DAY) },         // 자가 채점 — 제외
        { source: 'vocab', correct: true, created_at: iso(-3 * DAY) },   // 지난주
        { source: 'vocab', correct: true, created_at: iso(-8 * DAY) },   // 지지난주 — 범위 밖
      ],
      vocabRows: [
        { created_at: iso(DAY) }, { created_at: iso(3 * DAY) },          // 이번 주 담김 2
        { created_at: iso(-DAY) },                                       // 지난주 담김 1
      ],
      encounterRows: [
        { first_met_at: iso(2 * DAY) },                                  // 이번 주 만남 1
        { first_met_at: iso(-6 * DAY) },                                 // 지난주 만남 1
      ],
      readRows: [
        { completed_at: iso(4 * DAY) },                                  // 이번 주 완독 1
        { completed_at: null },                                          // 미완독 — 제외
      ],
    });

    expect(report.week.startMs).toBe(WEEK_START);
    expect(report.reviews).toEqual({ total: 2, correct: 1, accuracy: 0.5 });
    expect(report.prevReviews).toEqual({ total: 1, correct: 1, accuracy: 1 });
    expect(report.newWords).toBe(2);
    expect(report.prevNewWords).toBe(1);
    expect(report.metWords).toBe(1);
    expect(report.prevMetWords).toBe(1);
    expect(report.readsCompleted).toBe(1);
    expect(report.prevReadsCompleted).toBe(0);
    expect(report.hasAny).toBe(true);
  });

  it('경계 정밀: 주 시작 정각은 이번 주, 직전 밀리초는 지난주', () => {
    const report = buildWeeklyReport({
      now: NOW,
      events: [
        { source: 'vocab', correct: true, created_at: new Date(WEEK_START).toISOString() },
        { source: 'vocab', correct: false, created_at: new Date(WEEK_START - 1).toISOString() },
      ],
    });
    expect(report.reviews.total).toBe(1);
    expect(report.prevReviews.total).toBe(1);
  });

  it('빈 입력 — 전 축 0·accuracy null·hasAny false(카드 무표기 결)', () => {
    const report = buildWeeklyReport({ now: NOW });
    expect(report.reviews).toEqual({ total: 0, correct: 0, accuracy: null });
    expect(report.newWords).toBe(0);
    expect(report.hasAny).toBe(false);
  });

  it('weekRangeLabel — KST 날짜 "월/일 ~ 월/일"', () => {
    const report = buildWeeklyReport({ now: NOW });
    expect(weekRangeLabel(report.week)).toBe('8/17 ~ 8/23');
  });
});
