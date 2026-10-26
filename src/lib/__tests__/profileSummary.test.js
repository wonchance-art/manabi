// 내 정보 줄 값(PROFILE-REDESIGN-001) — 줄마다 지금 값을 보여 준다. 화면 문구의 재료가 정본(학습 언어 순서 · D 표기 · KST 날짜)과 같은 답을 내는지.
import { describe, expect, it } from 'vitest';
import {
  countValue, dailyGoalLine, goalSummary, joinedLine, languageAria, languageEntries, levelOptions, levelShort,
  makePrimary, reminderSummary, sessionLengthLabel, sheetLanguageOrder, signInMethods, toggleLanguage,
} from '../profileSummary';
import { goalTrackView } from '../learnDashboard';

const NOW = Date.parse('2026-10-25T03:00:00Z'); // KST 10/25 12:00

describe('학습 언어', () => {
  const profile = { learning_language: ['Japanese', 'Chinese'], learning_level_japanese: 'N3 중급', learning_level_chinese: 'H3 중급' };
  it('저장 순서대로, 첫 번째가 기본 — 수준은 짧은 이름', () => {
    expect(languageEntries(profile).map(e => [e.name, e.short, e.primary])).toEqual([['일본어', 'N3', true], ['중국어', 'H3', false]]);
    expect(languageAria(languageEntries(profile))).toBe('학습 언어, 일본어 N3 기본, 중국어 H3');
  });
  it('언어가 하나면 「기본」을 말하지 않는다 · 비어 있으면 일본어 · 수준이 없으면 이름만', () => {
    expect(languageAria(languageEntries({ learning_language: ['French'] }))).toBe('학습 언어, 프랑스어');
    expect(languageEntries(null).map(e => e.lang)).toEqual(['Japanese']);
    expect(levelShort('')).toBe('');
  });
  it('켜고 끄기는 하나를 남기고, 새 언어는 맨 뒤, 「기본으로」는 맨 앞', () => {
    expect(toggleLanguage(['Japanese'], 'Japanese')).toEqual(['Japanese']);
    expect(toggleLanguage(['Japanese', 'Chinese'], 'Japanese')).toEqual(['Chinese']);
    expect(toggleLanguage(['Chinese'], 'English')).toEqual(['Chinese', 'English']);
    expect(makePrimary(['Japanese', 'Chinese'], 'Chinese')).toEqual(['Chinese', 'Japanese']);
    expect(makePrimary(['Japanese'], 'French')).toEqual(['Japanese']);
  });
  it('시트 순서는 배우는 언어 먼저 · 수준 선택에서 입문 과정(A0 · OT)은 뺀다', () => {
    expect(sheetLanguageOrder(['Chinese', 'Japanese'])).toEqual(['Chinese', 'Japanese', 'English', 'French']);
    expect(levelOptions('French')[0]).toBe('A1 기초');
    expect(levelOptions('Chinese')[0]).toBe('H1 기초');
    expect(levelOptions('Japanese')[0]).toBe('N5 기초');
  });
});

describe('목표', () => {
  it('날짜 목표 + 하루 목표 — D 표기는 진행바 칸과 같다', () => {
    const profile = { dday_date: '2026-12-06', dday_label: 'JLPT N3', goal_review: 20, goal_words: 10 };
    expect(goalSummary(profile, NOW)).toEqual({ head: 'JLPT N3 · D-42', daily: '하루 복습 20 · 담기 10' });
    const p = { daysLeft: 42, done: false, gapDays: null, etaDate: null, needPerDay: 1, actualPerDay: 0 };
    expect(goalTrackView({ marked: { done: 0, total: 1 }, p, goalName: 'x', goalDate: '2026-12-06' }).dLabel).toBe('D-42');
  });
  it('이름이 없으면 날짜로 부르고, 날짜 목표가 없으면 하루 목표만(기본 5 · 5)', () => {
    expect(goalSummary({ dday_date: '2026-10-25' }, NOW).head).toBe('10/25 · D-Day');
    expect(goalSummary({ dday_date: '2026-10-20', dday_label: '  ' }, NOW).head).toBe('10/20 · D+5');
    expect(goalSummary({}, NOW)).toEqual({ head: null, daily: '하루 복습 5 · 담기 5' });
    expect(dailyGoalLine({ goal_review: 0, goal_words: 3 })).toBe('하루 복습 0 · 담기 3');
  });
});

describe('알림 · 함께한 날 · 로그인 방법 · 기록 칸', () => {
  it('알림 — 푸시 먼저, 시각 알림은 덧붙임', () => {
    expect(reminderSummary({ pushOn: true, hour: '21' })).toBe('푸시 · 매일 21시');
    expect(reminderSummary({ pushOn: true })).toBe('푸시 켜짐');
    expect(reminderSummary({ hour: '9' })).toBe('매일 9시 · 이 브라우저');
    expect(reminderSummary({})).toBe('꺼짐');
    expect(reminderSummary({ hour: '9', blocked: true })).toBe('차단됨');
    expect(reminderSummary({ pushOn: true, blocked: true })).toBe('푸시 켜짐');
  });
  it('함께한 날은 KST 날짜, 올해가 아니면 연도', () => {
    expect(joinedLine('2026-03-01T16:30:00Z', NOW)).toBe('3월 2일부터 함께하고 있어요');
    expect(joinedLine('2025-12-31T23:00:00Z', NOW)).toBe('1월 1일부터 함께하고 있어요');
    expect(joinedLine('2025-03-02T00:00:00Z', NOW)).toBe('2025년 3월 2일부터 함께하고 있어요');
    expect(joinedLine(null, NOW)).toBeNull();
  });
  it('로그인 방법 — identities 우선, 없으면 app_metadata', () => {
    expect(signInMethods({ identities: [{ provider: 'google' }, { provider: 'email' }] })).toBe('Google · 이메일');
    expect(signInMethods({ app_metadata: { providers: ['email'] } })).toBe('이메일');
    expect(signInMethods({ app_metadata: { provider: 'google' } })).toBe('Google');
  });
  it('기록 칸 — 0 · 모름은 「–」, 그 밖은 쉼표 + 단위 · 세션 길이', () => {
    expect(countValue(0)).toBe('–');
    expect(countValue(null, '편')).toBe('–');
    expect(countValue(1248)).toBe('1,248');
    expect(countValue(7, '편')).toBe('7편');
    expect(sessionLengthLabel(null)).toBe('한 번에 전부');
    expect(sessionLengthLabel(20)).toBe('한 번에 20개');
  });
});
