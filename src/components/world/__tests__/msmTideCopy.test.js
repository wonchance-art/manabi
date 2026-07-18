import { describe, expect, it } from 'vitest';
import { MSM_TIDE_COPY, msmTideCopyFor } from '../msmTideCopy.js';
import { MONT_SAINT_MICHEL_TIDE_CONTRACT, montSaintMichelTideAt } from '../montSaintMichelTide.js';

describe('몽생미셸 조수 카피 계약', () => {
  it('조수 계약의 4개 phase 전부에 완결된 카피가 있다', () => {
    expect(Object.keys(MSM_TIDE_COPY).sort())
      .toEqual([...MONT_SAINT_MICHEL_TIDE_CONTRACT.phaseOrder].sort());
    for (const [phase, copy] of Object.entries(MSM_TIDE_COPY)) {
      expect(copy.ko.length, phase).toBeGreaterThan(10);
      expect(copy.fr, phase).toMatch(/^La m.+\.$/); // A2 한 문장(조수 표현) + 마침표
      expect(copy.reading.length, phase).toBeGreaterThan(0);
      expect(copy.gloss.length, phase).toBeGreaterThan(0);
    }
  });

  it('시계가 뱉는 모든 phase가 카피로 해석되고, 미지 키는 null이다', () => {
    // 한 주기를 1분 간격 전수 스캔 — 시계 출력과 카피 키가 전 구간에서 닫혀 있다.
    for (let m = 0; m < MONT_SAINT_MICHEL_TIDE_CONTRACT.periodGameMinutes; m += 1) {
      const state = montSaintMichelTideAt(m);
      expect(msmTideCopyFor(state.phase), `minute ${m}`).toBe(MSM_TIDE_COPY[state.phase]);
    }
    expect(msmTideCopyFor('storm')).toBeNull();
    expect(msmTideCopyFor(null)).toBeNull();
    expect(msmTideCopyFor(undefined)).toBeNull();
  });
});
