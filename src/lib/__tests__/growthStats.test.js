import { describe, it, expect } from 'vitest';
import {
  KNOWN_WORD_MIN_INTERVAL,
  isKnownWord,
  isPassedChapter,
  kstWeekStartMs,
  kstWeekStartIso,
  isThisWeekSession,
  GROWTH_LABELS,
  GROWTH_COPY,
} from '../growthStats';

describe('isKnownWord — 아는 단어 판정(interval ≥ 7)', () => {
  it('임계값 상수는 7', () => {
    expect(KNOWN_WORD_MIN_INTERVAL).toBe(7);
  });

  it('interval null → 미달(false)', () => {
    expect(isKnownWord({ interval: null })).toBe(false);
  });

  it('interval 미정의 → 미달(false)', () => {
    expect(isKnownWord({})).toBe(false);
    expect(isKnownWord(undefined)).toBe(false);
  });

  it('interval 6 → 미달(false, 경계 바로 아래)', () => {
    expect(isKnownWord({ interval: 6 })).toBe(false);
  });

  it('interval 7 → 아는 단어(true, 경계 포함)', () => {
    expect(isKnownWord({ interval: 7 })).toBe(true);
  });

  it('interval 30 → 아는 단어(true)', () => {
    expect(isKnownWord({ interval: 30 })).toBe(true);
  });
});

describe('isPassedChapter — 통과 챕터 판정(passed === true)', () => {
  it('passed true → true', () => {
    expect(isPassedChapter({ passed: true })).toBe(true);
  });
  it('passed false → false', () => {
    expect(isPassedChapter({ passed: false })).toBe(false);
  });
  it('passed 없음/행 없음 → false', () => {
    expect(isPassedChapter({})).toBe(false);
    expect(isPassedChapter(null)).toBe(false);
  });
});

describe('kstWeekStart — KST 주 시작', () => {
  // 2024-01-03(수) 12:00 UTC → KST 21:00 수. 이번 주 월요일은 2024-01-01.
  // KST 2024-01-01 00:00 = UTC 2023-12-31 15:00.
  const WED_UTC = Date.UTC(2024, 0, 3, 12, 0, 0);

  it('주중 임의 시각 → 그 주 월요일 KST 자정의 UTC ms', () => {
    expect(kstWeekStartMs(WED_UTC)).toBe(Date.UTC(2023, 11, 31, 15, 0, 0));
  });

  it('ISO 변환도 동일 순간', () => {
    expect(kstWeekStartIso(WED_UTC)).toBe(new Date(Date.UTC(2023, 11, 31, 15, 0, 0)).toISOString());
  });

  it('KST 일요일 늦은 시각도 같은 주 월요일로 묶인다', () => {
    // UTC 2024-01-07 20:00 → KST 2024-01-08 05:00(월). 새 주 월요일 = 2024-01-08 KST.
    const monKst = Date.UTC(2024, 0, 7, 15, 0, 0); // KST 2024-01-08 00:00
    expect(kstWeekStartMs(Date.UTC(2024, 0, 7, 20, 0, 0))).toBe(monKst);
    // UTC 2024-01-07 10:00 → KST 2024-01-07 19:00(일). 이전 주 월요일 = 2024-01-01 KST.
    expect(kstWeekStartMs(Date.UTC(2024, 0, 7, 10, 0, 0))).toBe(Date.UTC(2023, 11, 31, 15, 0, 0));
  });
});

describe('isThisWeekSession — 이번 주 세션 판정', () => {
  const now = Date.UTC(2024, 0, 3, 12, 0, 0); // 수요일
  const weekStart = kstWeekStartMs(now);

  it('주 시작 이후 시각 → true', () => {
    expect(isThisWeekSession(new Date(weekStart + 3600 * 1000).toISOString(), now)).toBe(true);
    expect(isThisWeekSession(weekStart, now)).toBe(true); // 경계 포함
  });

  it('주 시작 이전 시각 → false', () => {
    expect(isThisWeekSession(weekStart - 1, now)).toBe(false);
  });

  it('빈 값 → false', () => {
    expect(isThisWeekSession(null, now)).toBe(false);
    expect(isThisWeekSession(undefined, now)).toBe(false);
    expect(isThisWeekSession('', now)).toBe(false);
  });

  it('ms / Date / ISO 입력 모두 지원', () => {
    const t = weekStart + 5000;
    expect(isThisWeekSession(t, now)).toBe(true);
    expect(isThisWeekSession(new Date(t), now)).toBe(true);
    expect(isThisWeekSession(new Date(t).toISOString(), now)).toBe(true);
  });
});

describe('표시 문구 상수', () => {
  it('라벨·설명이 정의돼 있다', () => {
    expect(GROWTH_LABELS.knownWords).toBe('아는 단어');
    expect(GROWTH_LABELS.passedChapters).toBe('통과 챕터');
    expect(GROWTH_LABELS.weekSessions).toBe('이번 주 세션');
    expect(GROWTH_COPY.knownWordSub).toBe('일주일 넘게 기억한 단어');
  });
});
