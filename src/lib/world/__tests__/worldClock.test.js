import { describe, expect, it } from 'vitest';
import {
  WORLD_EPOCH_GAME_MINUTE,
  WORLD_EPOCH_REAL_MS,
  WORLD_TIME_SCALE,
  formatWorldTime,
  realMsUntilGameMinutes,
  worldTimeAt,
} from '../worldClock.js';

describe('GlobalWorldClock', () => {
  it('고정 epoch에서 모든 플레이어가 같은 1일차 07:00을 본다', () => {
    expect(worldTimeAt(WORLD_EPOCH_REAL_MS)).toMatchObject({ day: 0, hour: 7, minute: 0, phase: 'morning' });
  });

  it('현실 1분은 게임 10.25분이며 같은 현실 시각은 하루마다 6시간 이동한다', () => {
    const oneMinute = worldTimeAt(WORLD_EPOCH_REAL_MS + 60_000);
    expect(oneMinute.totalGameMinutes - WORLD_EPOCH_GAME_MINUTE).toBeCloseTo(WORLD_TIME_SCALE);
    const oneRealDay = worldTimeAt(WORLD_EPOCH_REAL_MS + 24 * 60 * 60_000);
    expect(oneRealDay.minuteOfDay).toBe(13 * 60);
  });

  it('한 게임일은 현실 약 2시간 20분이며 포맷은 결정적이다', () => {
    expect(realMsUntilGameMinutes(24 * 60)).toBeCloseTo(8_429_268.2927);
    expect(formatWorldTime(worldTimeAt(WORLD_EPOCH_REAL_MS))).toBe('1일 07:00');
  });
});
