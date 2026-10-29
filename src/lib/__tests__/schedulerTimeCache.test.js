import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { schedulerTime } from '../fsrsScheduler.js';

/**
 * 계약(TAP-INP-SCHED-001): schedulerTime은 같은 문자열을 한 번만 푼다 — 결과 · 오류는 예전과 같다.
 * 복습 채점 · 정답 확인 탭마다 복습 줄과 범위별 개수를 다시 계산하며 표현마다 이 함수를 여러 번 불렀다(390 CPU×4 실측: 채점 탭의
 * 시각 풀이 자기 시간 약 76ms / 표현 412개). 저장은 성공한 문자열만, 크기는 묶어 둔다.
 */
describe('schedulerTime 문자열 저장(TAP-INP-SCHED-001)', () => {
  it('같은 문자열은 처음과 같은 밀리초 — 다른 표기(Z · 오프셋 · 소수)도 각자 정확하다', () => {
    const cases = {
      '2026-10-23T03:04:05Z': Date.UTC(2026, 9, 23, 3, 4, 5),
      '2026-10-23T12:04:05.120+09:00': Date.UTC(2026, 9, 23, 3, 4, 5, 120),
      '2026-10-23T03:04:05.5Z': Date.UTC(2026, 9, 23, 3, 4, 5, 500),
      '0099-01-01T00:00:00Z': -59042995200000,
    };
    for (const [text, ms] of Object.entries(cases)) {
      expect(schedulerTime(text)).toBe(ms);
      expect(schedulerTime(text)).toBe(ms); // 두 번째는 저장값
    }
  });

  it('잘못된 문자열은 저장하지 않고 매번 같은 오류로 던진다', () => {
    for (const bad of ['2026-02-30T00:00:00Z', '2026-10-23 03:04:05Z', '2026-10-23T03:04:05.1234Z', '-000000-01-01T00:00:00Z', '']) {
      expect(() => schedulerTime(bad)).toThrow('invalid_scheduler_time');
      expect(() => schedulerTime(bad)).toThrow('invalid_scheduler_time');
    }
  });

  it('Date · 숫자 입력은 예전 그대로(저장 없이) 검사한다', () => {
    const at = new Date(Date.UTC(2026, 0, 1));
    expect(schedulerTime(at)).toBe(at.getTime());
    expect(schedulerTime(at.getTime())).toBe(at.getTime());
    expect(() => schedulerTime(new Date(NaN))).toThrow('invalid_scheduler_time');
    expect(() => schedulerTime(1.5)).toThrow('invalid_scheduler_time');
  });

  it('서로 다른 문자열이 상한(16384)을 넘어도 값이 맞다 — 가득 차면 비우고 다시 쌓는다', () => {
    const base = Date.UTC(2020, 0, 1);
    for (let i = 0; i < 17000; i++) {
      const ms = base + i * 1000;
      expect(schedulerTime(new Date(ms).toISOString())).toBe(ms);
    }
    expect(schedulerTime(new Date(base).toISOString())).toBe(base);
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/fsrsScheduler.js'), 'utf8');
    // 단어 3,000개 계정의 서로 다른 시각 문자열 8,244개가 다 들어가는 크기(VOCAB-TBT-001).
    expect(src).toContain('const PARSED_TIMES_MAX = 16384;');
    expect(src).toContain('if (PARSED_TIMES.size >= PARSED_TIMES_MAX) PARSED_TIMES.clear();');
  });
});
