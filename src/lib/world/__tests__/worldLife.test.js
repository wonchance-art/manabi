import { describe, expect, it } from 'vitest';
import { cityWeatherAt, isOpenAt, nodeLifeAt, worldEventAt } from '../worldLife.js';

describe('세계 생활 주기', () => {
  it('자정을 넘기는 영업시간을 처리한다', () => {
    expect(isOpenAt([17 * 60, 2 * 60], 23 * 60)).toBe(true);
    expect(isOpenAt([17 * 60, 2 * 60], 60)).toBe(true);
    expect(isOpenAt([17 * 60, 2 * 60], 10 * 60)).toBe(false);
  });

  it('날씨·이벤트·NPC 상태는 도시/세계시에 대해 결정적이다', () => {
    const snapshot = { day: 12, minuteOfDay: 20 * 60 };
    expect(cityWeatherAt('fukuoka', snapshot)).toEqual(cityWeatherAt('fukuoka', snapshot));
    expect(worldEventAt('fukuoka', snapshot).label).toContain('나카스');
    expect(nodeLifeAt({ npc: 'izakaya' }, snapshot).open).toBe(true);
    expect(nodeLifeAt({ npc: 'izakaya' }, { ...snapshot, minuteOfDay: 10 * 60 }).open).toBe(false);
  });
});
