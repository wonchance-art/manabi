import { describe, expect, it } from 'vitest';
import { buildWeeklyReport, isGradedReviewEvent, weekRangeLabel } from '../weeklyReport.js';
import { learningWeekStartMs } from '../growthStats.js';
import { sliceBetween } from './helpers/sliceBetween.js';

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

// STATS-MAP-001 S7(오너 「권장대로」 2026-11-01 KST) — 대화 성과 · 담은 곳. 대화 자료에서 유도만(새 기록 0).
describe('buildWeeklyReport — 대화 성과 · 담은 곳', () => {
  const at = offset => WEEK_START + offset;
  const conversationRows = [
    { id: 77, turns: [
      { who: 'me', text: 'a', at: at(DAY) },
      { who: 'ai', text: 'b', at: at(DAY + 1) },
      { who: 'me', text: 'c', at: at(2 * DAY), focus: { from: 'x', to: 'y', state: 'fixed' } },
      { who: 'me', text: 'd', at: at(-2 * DAY), focus: { from: 'x', to: 'y', state: 'fixed' } }, // 지난주 — 빠짐
    ], reask: [{ to: 'y', ok: true, at: at(3 * DAY) }, { to: 'z', ok: null }] },
  ];
  it('이번 주 내 말 · 스스로 고친 문장 · 다시 쓴 문형만 센다', () => {
    const report = buildWeeklyReport({ now: NOW, conversationRows });
    expect(report.conversation).toEqual({ turns: 2, fixed: 1, reaskOk: 1 });
    expect(report.hasAny).toBe(true); // 대화만 한 주도 카드가 산다
  });
  it('담은 곳 — 대화 자료 · 읽기 자료 · 단어 목록(source_ref) · 오늘 학습 · 직접', () => {
    const vocabRows = [
      { created_at: iso(DAY), source_material_id: 77 },
      { created_at: iso(DAY), source_material_id: 12 },
      { created_at: iso(DAY), source_material_id: null, source_ref: '중국어 · H3' },
      { created_at: iso(DAY), source_material_id: null, source_ref: '오늘 학습' },
      { created_at: iso(DAY), source_material_id: null, source_ref: null },
      { created_at: iso(-DAY), source_material_id: 12 }, // 지난주 — 빠짐
    ];
    expect(buildWeeklyReport({ now: NOW, vocabRows, conversationRows }).savedBySource)
      .toEqual({ reading: 1, conversation: 1, level: 1, study: 1, manual: 1 });
  });
});

describe('이번 주 카드 화면 — 대화 줄 · 담은 곳 줄 · 앞면 차례', () => {
  it('2차 목업 그대로 배선된다 — 복습 큰 숫자 · 세 칸 · 자세히 목록(대화 · 담은 곳 막대 · 약한 곳)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/views/ProfileStats.jsx', 'utf8');
    const css = readFileSync('src/components/learn/learn.css', 'utf8');
    expect(src).toContain('`${conv.turns}마디`');
    expect(src).toContain('`고친 문장 ${conv.fixed}`');
    expect(src).toContain('`다시 쓴 문형 ${conv.reaskOk}`');
    expect(src).toContain('<span>담은 곳</span>');
    expect(src).toContain('.sort((x, y) => y.n - x.n)'); // 담은 곳은 많은 순
    // 세 칸은 0이면 「–」로 자리를 지킨다(내 정보 「내 기록」 선례), 목록 줄은 0이면 줄째 빠진다.
    expect(src).toContain("n > 0 ? `${n.toLocaleString('ko-KR')}${unit}` : '–'");
    expect(css).toContain('.learn-week__list:empty{display:none}');
    // 넓은 창 — 실제 기억률 창과 같은 폭.
    // 창 제목 = 고른 기간 이름(이번 주 · 지난 30일) + 날짜(기간 요약 — 오너 「1번으로」 2026-11-02 KST).
    expect(src).toMatch(/<TileModal title=\{`\$\{words\.now\} \(\$\{weekRangeLabel\(range\)\}\)`\} className="tile-modal--wide"/);
    // 거울 규약 — 이번 주 창 스타일에 경고 · 성적 색이 없다.
    const week = sliceBetween(css, '.learn-week{', '.learn-levels,.learn-memory{');
    for (const banned of ['--danger', '--warning', '--learn-go', '--learn-stop', '--grade-']) expect(week).not.toContain(banned);
    // 앞면: 복습 → 담은 말 → 대화 → 만난 말 → 완독
    const order = ['이번 주 복습', "'이번 주 담은 말'", "'이번 주 대화'", "'이번 주 만난 말'", "'이번 주 완독'"].map(k => src.indexOf(k));
    expect(order.every(i => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
