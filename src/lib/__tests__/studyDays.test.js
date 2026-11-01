import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { studyDayCounts, studyDayLabel, STUDY_DAYS_SPAN } from '../studyDays.js';
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

  it('현황 칸이 이 모듈을 쓴다 — 제목 「공부한 날」 · 위 오른쪽 「N일 · 지난 24주」', () => {
    const src = read('src/views/ProfileStats.jsx');
    expect(STUDY_DAYS_SPAN).toBe(168);
    expect(src).toContain('<h2 className="learn-sec-title">공부한 날</h2>');
    expect(src).toContain('{studied}일 · 지난 24주');
    expect(src).toContain('title={studyDayLabel(key, dayCounts[key])}');
    expect(src).not.toContain('<h2 className="learn-sec-title">히트맵</h2>');
  });
});
