import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  KNOWN_WORD_MIN_INTERVAL,
  MASTERED_MIN_INTERVAL,
  wordStage,
  isKnownWord,
  isPassedChapter,
  kstDayStartMs,
  kstDayStartIso,
  kstDateString,
  kstWeekStartMs,
  kstWeekStartIso,
  isThisWeekSession,
  GROWTH_LABELS,
  GROWTH_COPY,
} from '../growthStats';

describe('kstDayStart — KST 일간 경계', () => {
  it('KST 자정 직전은 같은 KST 날짜의 시작으로 묶인다', () => {
    const beforeMidnight = Date.UTC(2024, 0, 1, 14, 59, 59); // KST 1/1 23:59:59
    expect(kstDayStartMs(beforeMidnight)).toBe(Date.UTC(2023, 11, 31, 15, 0, 0));
    expect(kstDayStartIso(beforeMidnight)).toBe('2023-12-31T15:00:00.000Z');
  });

  it('KST 자정부터 다음 날짜의 시작으로 전환된다', () => {
    const midnight = Date.UTC(2024, 0, 1, 15, 0, 0); // KST 1/2 00:00:00
    expect(kstDayStartMs(midnight)).toBe(Date.UTC(2024, 0, 1, 15, 0, 0));
    expect(kstDayStartIso(midnight)).toBe('2024-01-01T15:00:00.000Z');
  });
});

describe('kstDateString — daily_suggestions date 키 정본', () => {
  it('UTC 15시(=KST 자정) 이후는 KST 다음날 — 수집 크론 시각의 핵심 경계', () => {
    // 2024-01-01T15:00Z = KST 2024-01-02 00:00 → 크론이 이 시각에 돌며 '01-02'로 저장해야 한다
    expect(kstDateString(Date.UTC(2024, 0, 1, 15, 0, 0))).toBe('2024-01-02');
    expect(kstDateString(Date.UTC(2024, 0, 1, 14, 59, 59))).toBe('2024-01-01');
  });

  it('KST 아침(UTC 새 날짜 직후)에도 KST 오늘을 돌려준다 — 빈 카드 결함의 재발 방지', () => {
    // 2024-01-02T01:00Z = KST 01-02 10:00 → '01-02' (UTC 날짜와 우연히 같지만 KST 산식이어야 함)
    expect(kstDateString(Date.UTC(2024, 0, 2, 1, 0, 0))).toBe('2024-01-02');
  });

  it('배선 계약 — 수집 크론과 조회 라우트가 같은 함수를 쓴다(UTC toISOString 부활 금지)', async () => {
    const fs = await import('node:fs');
    const cron = fs.readFileSync('src/app/api/cron/fetch-suggestions/route.js', 'utf8');
    const today = fs.readFileSync('src/app/api/suggestions/today/route.js', 'utf8');
    for (const src of [cron, today]) {
      expect(src).toContain('kstDateString()');
      expect(src).not.toContain("new Date().toISOString().split('T')[0]");
    }
  });
});

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

/**
 * 단어 단계 — 부채 ② (「기억 통계 이중 진실」, 2026-09-01).
 *
 * 실측하니 「이중 진실」의 대부분은 이 모듈이 생기면서 **이미 해소**돼 있었다(주간 기억
 * 수치는 세션 화면도 주간 리포트도 `review_events`에서 센다). 남아 있던 하나가 이것이다:
 * `VocabDetailCard`가 단계 경계 `7`을 **`KNOWN_WORD_MIN_INTERVAL`을 import하지 않고
 * 리터럴로** 쓰고 있었다. 값이 같아 증상이 없었을 뿐, 상수를 바꾸면 **카드는 「학습 중」인데
 * 카운터는 「아는 단어」가 아닌** 상태가 생긴다.
 */
describe('단어 단계(wordStage) — 경계가 한 곳에서만 산다', () => {
  const row = (interval, reviewed = '2026-09-01T00:00:00Z') => ({ interval, last_reviewed_at: reviewed });

  it('복습한 적 없으면 신규 — interval이 커도 그렇다', () => {
    expect(wordStage({ interval: 999, last_reviewed_at: null })).toEqual({ key: 'new', label: '신규' });
    expect(wordStage({})).toEqual({ key: 'new', label: '신규' });
  });

  it('경계는 아는 단어 기준과 **같은 상수**를 쓴다', () => {
    expect(wordStage(row(KNOWN_WORD_MIN_INTERVAL))).toMatchObject({ key: 'learning' });
    expect(wordStage(row(KNOWN_WORD_MIN_INTERVAL - 1))).toMatchObject({ key: 'early' });
    // 이 동치가 부채의 본체다 — 「학습 중 이상」과 「아는 단어」는 같은 선이어야 한다.
    for (const n of [0, 1, 6, 7, 8, 29, 30, 100]) {
      const stage = wordStage(row(n));
      expect(isKnownWord({ interval: n }), `interval ${n}`).toBe(stage.key === 'learning' || stage.key === 'mastered');
    }
  });

  it('숙련 경계는 이 모듈 자기 상수다', () => {
    expect(wordStage(row(MASTERED_MIN_INTERVAL))).toEqual({ key: 'mastered', label: '숙련' });
    expect(wordStage(row(MASTERED_MIN_INTERVAL - 1))).toMatchObject({ key: 'learning' });
  });

  it('카드가 판정을 다시 하지 않는다 — 경계값이 화면에 되살아나지 않게', () => {
    const card = fs.readFileSync(path.join(process.cwd(), 'src/views/VocabDetailCard.jsx'), 'utf8');
    expect(card).toContain("import { wordStage } from '../lib/growthStats'");
    expect(card, '단계 경계가 화면으로 되돌아왔다').not.toMatch(/interval >= \d+/);
    // 색도 표현으로 내려갔다 — 판정과 표현이 같은 삼항에 얽혀 있으면 한쪽만 낡는다.
    expect(card).toContain('badge--stage-${stage.key}');
  });
});
