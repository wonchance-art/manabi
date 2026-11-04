// 답 아닌 출처 하나(EVENT-SOURCE-001, 2026-11-04 KST). /study 재료 단어 팝오버 · 「왜 이게 답이에요?」(source 'assist', correct:false)가
// 채점 판정과 난이도 다이얼 양쪽에서 오답 한 번으로 셌다 — 두 판정이 각자 목록(ui · dict)을 들고 있었고 assist는 어느 쪽에도 없었다.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NON_ANSWER_SOURCES } from '../reviewEventSources.js';
import { buildWeeklyReport, countsAsStudyAnswer, isGradedReviewEvent } from '../weeklyReport.js';
import { countsForDifficulty } from '../practiceEvents.js';
import { studyDayCounts } from '../studyDays.js';

const NOW = Date.parse('2026-11-04T06:00:00Z');
const ev = (source, correct, extra = {}) => ({ source, correct, lang: 'zh', item_key: '猫', created_at: new Date(NOW - 3600e3).toISOString(), ...extra });

describe('답 아닌 출처 — ui · dict · assist', () => {
  it('집합 하나', () => {
    expect([...NON_ANSWER_SOURCES].sort()).toEqual(['assist', 'dict', 'ui']);
  });
  it('채점 판정 · 난이도 다이얼 · 공부한 날 모두 assist를 답으로 세지 않는다', () => {
    for (const qtype of ['assist', 'explain']) {
      const e = ev('assist', false, { detail: { qtype } });
      expect(isGradedReviewEvent(e)).toBe(false);
      expect(countsForDifficulty(e)).toBe(false);
      expect(countsAsStudyAnswer(e)).toBe(false);
    }
  });
  it('이번 주 정답률 — 팝오버를 몇 번 열어도 그대로(예전: 연 만큼 오답)', () => {
    const answers = [ev('vocab', true), ev('vocab', true), ev('grammar', false), ev('reading', true)];
    const base = buildWeeklyReport({ events: answers, now: NOW }).reviews;
    const withAssist = buildWeeklyReport({ events: [...answers, ev('assist', false), ev('assist', false, { detail: { qtype: 'explain' } })], now: NOW }).reviews;
    expect(withAssist).toEqual(base);
    expect(base).toMatchObject({ total: 4, correct: 3 });
  });
  it('답인 출처는 그대로 — vocab · grammar · reading · writing은 채점, practice self는 다이얼 밖', () => {
    for (const s of ['vocab', 'grammar', 'reading', 'writing']) {
      expect(isGradedReviewEvent(ev(s, true))).toBe(true);
      expect(countsForDifficulty(ev(s, true))).toBe(true);
    }
    expect(countsForDifficulty(ev('practice', true, { detail: { qtype: 'self' } }))).toBe(false);
    expect(countsForDifficulty(ev('practice', true, { detail: { qtype: 'choice' } }))).toBe(true);
  });
  it('assist만 있는 날은 공부한 날 칸에 켜지지 않는다(답이 아니다)', () => {
    expect(studyDayCounts({ answers: [ev('assist', false)] })).toEqual({});
  });
  it('두 판정이 같은 집합을 쓴다 — 각자 목록을 다시 들지 않는다', () => {
    const weekly = fs.readFileSync('src/lib/weeklyReport.js', 'utf8');
    const practice = fs.readFileSync('src/lib/practiceEvents.js', 'utf8');
    for (const src of [weekly, practice]) {
      expect(src).toContain("import { NON_ANSWER_SOURCES } from './reviewEventSources.js';");
      expect(src).toContain('!NON_ANSWER_SOURCES.has(event.source)');
      expect(src).not.toMatch(/event\.source !== 'dict'/);
    }
    expect(fs.readFileSync('src/lib/reviewEventSources.js', 'utf8')).not.toMatch(/^import /m);
  });
});
