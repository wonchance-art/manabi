import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { studyDayCounts, studyDayLabel, studyDaysBasis, STUDY_DAYS_SPAN } from '../studyDays.js';
import { buildWeeklyReport } from '../weeklyReport.js';

/**
 * 계약: 공부한 날(현황 히트맵 — 오너 결정 3 · A안, 2026-11-01 KST · STATS-MAP-001).
 * 한 칸 = 학습일(04시) 하나 = 답한 문항 + 담은 말. 답은 이번 주 「복습 N문항」과 같은 정의(연습 · 사전 · ui 제외).
 */
const read = f => fs.readFileSync(f, 'utf8');

describe('공부한 날', () => {
  it('복습만 한 날도 칸이 생긴다 — 담은 말만 세던 예전 히트맵의 빈칸', () => {
    const days = studyDayCounts({
      answers: [{ source: 'vocab', correct: true, created_at: '2026-11-02T10:00:00+09:00' }],
      saved: [],
    });
    expect(days['2026-11-02']).toEqual({ answers: 1, saved: 0 });
  });

  it('04시 학습일로 묶는다 — 새벽 2시 답은 전날 칸', () => {
    const days = studyDayCounts({
      answers: [{ source: 'vocab', correct: true, created_at: '2026-11-02T02:00:00+09:00' }],
      saved: [{ created_at: '2026-11-02T04:00:00+09:00' }],
    });
    expect(days).toEqual({ '2026-11-01': { answers: 1, saved: 0 }, '2026-11-02': { answers: 0, saved: 1 } });
  });

  it('답은 이번 주 「복습 N문항」과 같은 정의 — 연습 · 사전 · ui는 빼고 한자 · 목록 확인은 활동으로 센다', () => {
    const now = Date.parse('2026-11-05T12:00:00+09:00');
    const events = ['vocab', 'grammar', 'hanzi', 'level', 'practice', 'dict', 'ui']
      .map(source => ({ source, correct: true, created_at: '2026-11-04T12:00:00+09:00' }));
    const days = studyDayCounts({ answers: events });
    expect(days['2026-11-04'].answers).toBe(4);
    expect(buildWeeklyReport({ events, now }).reviews.total).toBe(4);
  });

  it('기간 밖은 뺀다', () => {
    const days = studyDayCounts({ saved: [{ created_at: '2026-01-01T12:00:00+09:00' }], sinceMs: Date.parse('2026-06-01T04:00:00+09:00') });
    expect(days).toEqual({});
  });

  it('칸 설명 — 0인 항목은 쓰지 않고, 안 한 날은 「쉼」', () => {
    expect(studyDayLabel('2026-11-02', { answers: 34, saved: 5 })).toBe('11월 2일 · 답 34 · 담은 말 5');
    expect(studyDayLabel('2026-11-02', { answers: 0, saved: 3 })).toBe('11월 2일 · 담은 말 3');
    expect(studyDayLabel('2026-11-03', undefined)).toBe('11월 3일 · 쉼');
  });

  it('현황 칸이 이 모듈을 쓴다 — 제목 「공부한 날」 · 위 오른쪽 「1년 중 N일 · Z%」', () => {
    const src = read('src/views/ProfileStats.jsx');
    expect(STUDY_DAYS_SPAN).toBe(364); // 52주 — 오너 「ㅇㅋ」 시안 2(2026-11-01 KST)
    expect(src).toContain('<h2 className="learn-sec-title">공부한 날</h2>');
    expect(src).toContain("일부터 ` : '1년 중 '}<b>{basis.studied}일</b> · {basis.percent}%");
    expect(src).toContain('studyDaysBasis(days, dayCounts, { hasOlder })');
    expect(src).not.toContain('지난 24주'); // 날짜 단위 둘이 붙어 읽히지 않던 머리글
    expect(src).toContain('title={studyDayLabel(key, dayCounts[key])}');
    expect(src).not.toContain('<h2 className="learn-sec-title">히트맵</h2>');
  });

  it('머리글 기준은 첫 기록부터 — 1년보다 오래 썼으면 1년(오너 「첫 기록부터로 바꿔」)', () => {
    const days = ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    const counts = { '2026-10-30': { answers: 3, saved: 0 }, '2026-11-01': { answers: 0, saved: 2 } };
    // 10월 30일 시작 — 사흘 중 이틀(전체 넷으로 나누면 50%라 갓 시작한 사람이 낮아 보인다).
    expect(studyDaysBasis(days, counts)).toEqual({ studied: 2, span: 3, percent: 67, sinceDay: '2026-10-30' });
    // 칸 기간보다 이른 기록이 있으면 1년(칸 전체) 기준 — 「1년 중」.
    expect(studyDaysBasis(days, counts, { hasOlder: true })).toEqual({ studied: 2, span: 4, percent: 50, sinceDay: null });
    // 첫 칸부터 기록 — 「1년 중」.
    expect(studyDaysBasis(days, { '2026-10-29': { answers: 1, saved: 0 } }).sinceDay).toBe(null);
    // 기록이 없으면 머리글 없음.
    expect(studyDaysBasis(days, {})).toBe(null);
  });

  it('1년은 옆으로 밀어 본다 — 카드 · 칸 크기 그대로(보이는 폭에 24주), 처음엔 오늘이 맨 오른쪽', () => {
    const src = read('src/views/ProfileStats.jsx');
    const css = read('src/components/learn/learn.css');
    expect(src).toContain('if (!touched.current) view.scrollLeft = view.scrollWidth;');
    expect(src).toContain('new ResizeObserver(pin)'); // 늦게 정해지는 폭에도 오늘이 맨 오른쪽
    expect(src).toContain('className={`learn-heatmap__view');
    expect(src).toContain('tabIndex={0}'); // 키보드 ← →
    expect(css).toMatch(/\.learn-heatmap__view\{container-type:inline-size;[^}]*overflow-x:auto/);
    expect(css).toContain('--cell:calc((100cqi - 46px) / 24)');
    expect(css).toMatch(/\.learn-heatmap\{grid-column:span 2;height:146px/); // 카드 높이 그대로
    // 시안 2에서 뺀 것 — 버튼 · 달 이름 · 범례가 다시 붙지 않는다(「현안 심플함에서 너무 번잡해졌네」).
    for (const banned of ['이전 반년', '다음 반년', 'learn-heatmap__months', '적음', '많음']) expect(src).not.toContain(banned);
  });
});
