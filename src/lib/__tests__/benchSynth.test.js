import { describe, expect, it } from 'vitest';
import { synthProcessedJson } from '../../../scripts/bench/synth.mjs';

describe('bench synth — 결정적 대형 processed_json fixture', () => {
  it('같은 seed는 byte-identical이고 크기 계약을 지킨다', () => {
    const first = synthProcessedJson(5000, 20260824);
    const second = synthProcessedJson(5000, 20260824);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.sequence).toHaveLength(5000);
    expect(Object.keys(first.dictionary)).toHaveLength(5000);
    expect(first.lines).toHaveLength(500);
  });

  it('seed가 달라지면 합성 내용이 달라지고 잘못된 크기는 거부한다', () => {
    expect(synthProcessedJson(8, 1)).not.toEqual(synthProcessedJson(8, 2));
    expect(() => synthProcessedJson(-1)).toThrow(RangeError);
  });
});

