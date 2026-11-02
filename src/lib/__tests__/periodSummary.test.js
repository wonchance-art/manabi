import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { buildRangeReport, buildWeeklyReport, periodRange } from '../weeklyReport.js';
import { learningDayStartMs, learningWeekStartMs, learningDateString } from '../growthStats.js';
import {
  STANDARD_BAND, balanceRows, historyBuckets, periodDates, periodStandards, periodSummaryText, standardZone, studyDaysIn,
} from '../periodSummary.js';

/* 기간 요약 · 학습 진단지(STATS-MAP-001 — 오너 2026-11-02 KST: 「1번으로」 · 진단지 「ㅇㅇ」 · 「자세히 보기」 · 기준 「표준」 · 머리 공부한 날 · 복사부터). */
const DAY = 86400000;
const NOW = Date.parse('2026-11-02T06:00:00Z'); // 11/2 15시 KST(월요일)
const iso = ms => new Date(ms).toISOString();
const read = f => fs.readFileSync(f, 'utf8');

describe('기간 — 이번 주 · 지난 30일(04시 학습일)', () => {
  it('지난 30일 = 오늘을 포함한 30학습일, 비교 = 그 앞 30학습일', () => {
    const r = periodRange('30d', NOW);
    expect(r.endMs).toBe(learningDayStartMs(NOW) + DAY);
    expect(r.endMs - r.startMs).toBe(30 * DAY);
    expect(r.startMs - r.prevStartMs).toBe(30 * DAY);
    expect(periodDates(r)).toBe('2026-10-04 ~ 11-02');
  });
  it('이번 주는 지금 그대로(월요일 04시부터 · 지난주 비교)', () => {
    const r = periodRange('week', NOW);
    expect(r.startMs).toBe(learningWeekStartMs(NOW));
    expect(r.endMs - r.startMs).toBe(7 * DAY);
  });
  it('이번 주 리포트 = 기간 리포트의 한 경우 — 같은 행에서 같은 숫자(셈 정본 하나)', () => {
    const rows = {
      events: [{ source: 'vocab', correct: true, created_at: iso(NOW - 2 * 3600e3) }, { source: 'vocab', correct: false, created_at: iso(NOW - 8 * DAY) }],
      vocabRows: [{ created_at: iso(NOW - 3600e3) }, { created_at: iso(NOW - 9 * DAY) }],
      encounterRows: [], readRows: [{ completed_at: iso(NOW - 3600e3) }], conversationRows: [], now: NOW,
    };
    const week = buildWeeklyReport(rows);
    const r = periodRange('week', NOW);
    const range = buildRangeReport(rows, r);
    expect(range.reviews).toEqual(week.reviews);
    expect(range.newWords).toBe(week.newWords);
    expect(range.prevReviews).toEqual(week.prevReviews);
    expect(week.week).toEqual(range.period);
    const thirty = buildRangeReport(rows, periodRange('30d', NOW));
    expect(thirty.reviews.total).toBe(2);
    expect(thirty.newWords).toBe(2);
  });
});

describe('표준(오너 「표준」) — 하루 기준 × 일수 · 목표가 있으면 목표 창 값', () => {
  it('복습 · 담기는 dailyGoals(목표 창 · 배움 오늘 목표와 같은 정본), 나머지는 manabi 기본값', () => {
    expect(periodStandards({ goal_review: 20, goal_words: 10 }, 30)).toEqual({ reviews: 600, newWords: 300, metWords: 300, readsCompleted: 9, turns: 300, used: 15 });
    expect(periodStandards(null, 7)).toMatchObject({ reviews: 35, newWords: 35, readsCompleted: 2 });
  });
  it('표준 띠 80 ~ 120% — 이하 · 표준 · 이상', () => {
    expect([STANDARD_BAND.low, STANDARD_BAND.high]).toEqual([80, 120]);
    expect([standardZone(79), standardZone(80), standardZone(120), standardZone(121), standardZone(null)]).toEqual(['under', 'standard', 'standard', 'over', null]);
  });
  it('균형 줄 = 값 / 표준 — 직접 쓴 말은 직접 쓴 말 셈(usedWords) 그대로', () => {
    const report = { reviews: { total: 300 }, newWords: 150, metWords: 0, readsCompleted: 9, conversation: { turns: 360 } };
    const rows = balanceRows({ report, output: { total: 15 }, standards: periodStandards({ goal_review: 20, goal_words: 10 }, 30) });
    expect(rows.map(r => [r.key, r.pct, r.zone])).toEqual([
      ['reviews', 50, 'under'], ['newWords', 50, 'under'], ['metWords', 0, 'under'],
      ['readsCompleted', 100, 'standard'], ['turns', 120, 'standard'], ['used', 100, 'standard'],
    ]);
  });
});

describe('공부한 날 · 변화 기록', () => {
  it('공부한 날 = 기간 안 학습일 중 답 또는 담은 말이 있는 날(공부한 날 칸과 같은 셈)', () => {
    const r = periodRange('30d', NOW);
    const day = ms => learningDateString(ms);
    const counts = { [day(NOW)]: { answers: 3, saved: 0 }, [day(NOW - 5 * DAY)]: { answers: 0, saved: 1 }, [day(NOW - 40 * DAY)]: { answers: 9, saved: 0 } };
    expect(studyDaysIn(counts, r)).toBe(2);
  });
  it('7일씩 8칸 — 오래된 → 최근, 칸 합 = 56일 합', () => {
    const events = Array.from({ length: 56 }, (_, i) => ({ source: 'vocab', correct: i % 2 === 0, created_at: iso(NOW - i * DAY) }));
    const endMs = learningDayStartMs(NOW) + DAY;
    const h = historyBuckets({ events }, { endMs, buckets: 8, buildRange: buildRangeReport });
    expect(h).toHaveLength(8);
    expect(h.reduce((s, b) => s + b.reviews, 0)).toBe(56);
    expect(h[7].endMs).toBe(endMs);
  });
});

describe('요약 텍스트 — 진단지와 같은 번호 · 같은 숫자, 0 · 개인 정보 없음', () => {
  const range = periodRange('30d', NOW);
  const report = { reviews: { total: 412, accuracy: 0.88 }, newWords: 64, metWords: 120, readsCompleted: 6, conversation: { turns: 42, fixed: 5 } };
  const text = periodSummaryText({
    range, report, studyDays: 18, balance: [{ label: '복습', pct: 117 }, { label: '완독', pct: null }],
    output: { total: 11, firstTime: 7 }, remet: { total: 23 }, retention: { pct: 86, target: 90 },
    health: { measured: 98, buckets: { high: 11, mid: 41, low: 38, forgotten: 8 } },
    levels: [{ label: 'HSK 1', pct: 96 }], history: [{ reviews: 64 }, { reviews: 71 }], next: [{ text: '흐릿 · 위험 말 46개 복습' }], language: '중국어',
  });
  it('머리 · ① ~ ⑦ · 형식 꼬리', () => {
    expect(text.split('\n')[0]).toBe('# manabi 학습 진단지 · 지난 30일 (2026-10-04 ~ 11-02, 04시 기준)');
    expect(text).toContain('공부한 날: 18 / 30');
    expect(text).toContain('① 구성: 만난 말 120 · 완독 6 / 새로 담은 말 64 / 복습 412 (정답 88%) / 직접 쓴 말 11 · 대화 42마디');
    expect(text).toContain('② 균형(표준=100%): 복습 117');
    expect(text).not.toContain('완독 null');
    expect(text).toContain('③ 기억(중국어): 실제 기억률 86% (목표 90%) · 선명 11 · 양호 41 · 흐릿 38 · 위험 8');
    expect(text).toContain('④ 수준(확보): HSK 1 96%');
    expect(text).toContain('⑤ 변화(7일씩 · 복습): 64 71');
    expect(text).toContain('⑥ 다음: 흐릿 · 위험 말 46개 복습');
    expect(text).toContain('⑦ 세부: 다시 만난 말 23 · 처음 씀 7 · 고친 문장 5');
    expect(text.trim().endsWith('@manabi-summary: v1 · period=30d')).toBe(true);
  });
  it('없는 축 · 0은 줄째 뺀다', () => {
    const t = periodSummaryText({ range, report: { reviews: { total: 0, accuracy: null }, newWords: 0, metWords: 0, readsCompleted: 0, conversation: { turns: 0, fixed: 0 } } });
    expect(t.split('\n')).toEqual(['# manabi 학습 진단지 · 지난 30일 (2026-10-04 ~ 11-02, 04시 기준)', '---', '@manabi-summary: v1 · period=30d']);
  });
});

describe('배선 — 이번 주 창 기간 칩 · 「자세히 보기」 · 진단지 화면', () => {
  const stats = read('src/views/ProfileStats.jsx');
  const page = read('src/views/StudyReportPage.jsx');
  it('이번 주 창: 기간 칩 · 지난 30일은 고를 때만 60일치 · 공부한 날 줄 · 「자세히 보기 ›」(오너 문구) · 요약 복사', () => {
    expect(stats).toContain('<div className="learn-period" role="group" aria-label="기간">');
    expect(stats).toContain("enabled: !!user?.id && range.kind === '30d',");
    expect(stats).toContain("const studied = range.kind === '30d' && studyDays ? studyDaysIn(studyDays, range) : null;");
    expect(stats).toContain('<Link href={`/progress/report?period=${period}`} prefetch={false} className="learn-week__more">자세히 보기 <span aria-hidden="true">›</span></Link>');
    expect(stats).toContain('return periodSummaryText({');
  });
  it('진단지: 새 셈 없이 정본만 — 기간 리포트 · 레벨 어휘 훅 · 기억 건강 · 실제 기억률 · 공부한 날 칸과 같은 재료', () => {
    expect(fs.existsSync('src/app/(app)/progress/report/page.jsx')).toBe(true);
    for (const piece of ['buildRangeReport(rows, range)', 'useLevelRows({ lang, vocab, projections', 'memoryHealth(mine,', 'buildTrueRetention({ ...retentionRows, lang })',
      'fetchStudyAnswerRows(user.id,', 'historyBuckets(rows,', 'unusedReviewedWords({ projections: mine', "serializeReviewScope({ lang, state: 'fragile' })"]) {
      expect(page).toContain(piece);
    }
    expect(read('src/components/learn/LevelVocabCard.jsx')).toContain('const { supported, rows } = useLevelRows({ lang, vocab, projections, knownRows });');
  });
  it('거울 규약 — 진단지에 판정색(경고 · 위험 토큰) · 화살표 없음', () => {
    const css = read('src/components/learn/study-report.css');
    expect(css).not.toMatch(/--(danger|warning|accent-text)|#[0-9a-f]{3,6}\b/i);
    // 없는 토큰을 font 단축에 넣으면 선언째 버려진다(큰 숫자가 본문 글씨로 보이던 것 — 빌드 캡처 실측).
    expect(css).not.toContain('--font-sans-kr');
    expect(page).not.toMatch(/[↑↓▲▼]/);
  });
});
