import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  IDLE_MS, MIN_CHARS, READING_METRIC_VERSION,
  buildReadingMetric, computeCpm, countReadableChars, formatDuration, shouldRecordReading,
} from '../readingTimer.js';

/**
 * 계약: v2-I R1a 유창성 측정 (#1077 설계, 오너 착수 승인 2026-08-30 "I ㄱㄱ").
 * 설계 §10 중 I-a 해당분: ① 순수 시간 정의(일시정지 3종) ② 완독 시에만·200자 미만
 * 무기록 ③ detail.v 버전 기록 ④ **이벤트 개수 불변**(기존 집계 무오염) ⑧ paced 필드.
 * (페이서 계약 5·6·7·9·10은 I-b 라운드 몫.)
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('① 정의 — 무엇을 시간·양으로 세는가', () => {
  it('CPM = 글자수 ÷ 분. 시간이나 글자수가 없으면 null', () => {
    expect(computeCpm({ ms: 60000, chars: 90 })).toBe(90);
    expect(computeCpm({ ms: 252000, chars: 320 })).toBe(76.2);   // 설계 목업의 4분 12초·320자
    expect(computeCpm({ ms: 0, chars: 100 })).toBeNull();
    expect(computeCpm({ ms: 1000, chars: 0 })).toBeNull();
  });

  it('글자수는 공백·개행을 세지 않는다 — 재독해도 분자가 흔들리지 않게', () => {
    expect(countReadableChars('我把书\n放在 桌子上。')).toBe(9);
    expect(countReadableChars('')).toBe(0);
    expect(countReadableChars(null)).toBe(0);
  });

  it('시간 표기 — 분·초', () => {
    expect(formatDuration(252000)).toBe('4분 12초');
    expect(formatDuration(45000)).toBe('45초');
    expect(formatDuration(0)).toBeNull();
  });
});

describe('② 노이즈 게이트 — 완독 시에만, 200자 미만은 침묵', () => {
  it('200자 미만·시간 0은 기록하지 않는다', () => {
    expect(shouldRecordReading({ ms: 60000, chars: MIN_CHARS - 1 })).toBe(false);
    expect(shouldRecordReading({ ms: 0, chars: 500 })).toBe(false);
    expect(shouldRecordReading({ ms: 60000, chars: MIN_CHARS })).toBe(true);
    expect(MIN_CHARS).toBe(200);
  });

  it('기록 대상이 아니면 metric 자체가 null — detail이 예전 모양 그대로 남는다', () => {
    expect(buildReadingMetric({ ms: 60000, chars: 10 })).toBeNull();
    expect(buildReadingMetric({ ms: 0, chars: 900 })).toBeNull();
  });
});

describe('③⑧ detail 조각 — 버전과 paced', () => {
  it('ms·chars·cpm·v·paced를 담는다', () => {
    const m = buildReadingMetric({ ms: 252000, chars: 320 });
    expect(m).toEqual({ ms: 252000, chars: 320, cpm: 76.2, v: READING_METRIC_VERSION, paced: false });
    expect(READING_METRIC_VERSION).toBe(1);
  });

  it('⑧ 페이서로 읽은 완독은 paced:true — 자기 설정값이 지표를 되비추지 않게', () => {
    expect(buildReadingMetric({ ms: 252000, chars: 320, paced: true }).paced).toBe(true);
  });
});

describe('④ 이벤트 개수 불변 — 기존 집계를 오염시키지 않는다', () => {
  const hook = read('src/lib/useReadingCompletion.js');

  it('새 이벤트를 만들지 않고 기존 완독 이벤트의 detail만 넓힌다', () => {
    // logReviewEvents 호출은 예전처럼 딱 한 번뿐이어야 한다
    expect(hook.match(/logReviewEvents\(/g)).toHaveLength(1);
    expect(hook).toContain("detail: { qtype: 'read', mode: 'viewer', ...(metric || {}) },");
    // 새 테이블·새 소스 신설 금지
    expect(hook).not.toMatch(/from\('reading_speed|source: 'fluency'/);
  });

  it('측정 실패가 완독을 막지 않는다 — try/catch로 격리', () => {
    const block = sliceBetween(hook, 'let metric = null;', 'if (eventLang');
    expect(block).toContain('catch');
  });

  it('isGradedReviewEvent(주간 집계 판정)는 건드리지 않는다', () => {
    const weekly = read('src/lib/weeklyReport.js');
    expect(weekly).not.toContain('cpm');
    expect(weekly).not.toContain('paced');
  });
});

describe('일시정지 3종 배선', () => {
  const timer = read('src/lib/useReadingTimer.js');
  const viewer = read('src/views/ViewerPage.jsx');

  it('① 탭 숨김 ③ 30초 무동작이 훅에 배선돼 있다', () => {
    expect(timer).toContain("document.addEventListener('visibilitychange'");
    expect(timer).toContain('document.hidden');
    expect(timer).toContain('lastActRef.current + IDLE_MS');
    expect(IDLE_MS).toBe(30_000);
  });

  it('② 카드·시트 열림이 측정을 멈춘다 — 찾아보기 시간은 읽기가 아니다', () => {
    expect(viewer).toContain('paused: isSheetOpen || !!selectedToken,');
  });

  it('배경 탭에서 타이머가 새지 않는다 — setInterval 누적 금지(구간 차이 방식)', () => {
    expect(codeOf(timer)).not.toMatch(/setInterval/);
  });
});

describe('완독 화면 — 조용한 1회 표시', () => {
  it('측정이 있을 때만 한 줄, 경쟁 요소 없음', () => {
    const modal = read('src/views/ViewerQuizModal.jsx');
    expect(modal).toContain('{completionModal.reading && (');
    expect(modal).toContain('자/분');
    expect(codeOf(modal)).not.toMatch(/랭킹|순위|leaderboard/i);
  });
});
