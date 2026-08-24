import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { materialFit, FIT_MIN_TYPES } from '../../lib/materialFit.js';
import { mergeKnownIntoIndex } from '../../lib/knownWords.js';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/**
 * 계약: 뷰어 커버리지 배지(#1077-2)는 서재 맞춤도와 **같은 엔진·같은 인덱스**를 쓴다.
 * 두 화면이 다른 수를 보이면 서로를 반증한다 — 배지의 신뢰가 곧 계산 동일성이다.
 */
describe('커버리지 배지 — 서재와 계산 동일성', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  const materials = read('src/views/MaterialsPage.jsx');

  it('뷰어가 서재와 같은 엔진(materialFit)·같은 합집합(mergeKnownIntoIndex)을 쓴다', () => {
    for (const src of [viewer, materials]) {
      expect(src).toContain('materialFit(');
      expect(src).toContain('mergeKnownIntoIndex');
    }
  });

  it('표본 미달은 무표기 — FIT_MIN_TYPES 게이트를 통과해야 배지가 산다', () => {
    expect(viewer).toContain('FIT_MIN_TYPES');
    expect(viewer).toContain('아는 단어');
    expect(viewer).toContain('새 단어');
  });

  it('게스트·미분석 자료는 배지 없음(0% 오표기 금지)', () => {
    expect(viewer).toContain('if (!user || !material?.processed_json) return null;');
  });
});

// 엔진 수준 계약: 배지가 보여 줄 두 수(퍼센트·새 단어 수)가 합집합에 실제로 반응한다.
describe('커버리지 배지 — 합집합이 수치를 움직인다', () => {
  const processedJson = {
    sequence: Array.from({ length: 25 }, (_, i) => `id_0_${i}`),
    dictionary: Object.fromEntries(
      Array.from({ length: 25 }, (_, i) => [`id_0_${i}`, { text: `w${i}`, base_form: `w${i}`, pos: '명사' }])
    ),
  };

  it("'이미 앎'을 더하면 아는 비율이 오르고 새 단어가 준다", () => {
    const saved = { surfaces: new Set(['w0', 'w1']), bases: new Set(['w0', 'w1']) };
    const before = materialFit(processedJson, saved);
    const after = materialFit(processedJson, mergeKnownIntoIndex(saved, [{ word_text: 'w2' }, { word_text: 'w3' }]));

    expect(before.total).toBe(25);
    expect(before.total).toBeGreaterThanOrEqual(FIT_MIN_TYPES); // 배지가 뜨는 표본
    expect(after.known).toBe(before.known + 2);
    expect(after.unknown).toBe(before.unknown - 2);
    expect(after.coverage).toBeGreaterThan(before.coverage);
  });

  it('표본이 FIT_MIN_TYPES 미만이면 배지 게이트가 막는다', () => {
    const tiny = {
      sequence: ['id_0_0', 'id_0_1'],
      dictionary: { id_0_0: { text: 'a', pos: '명사' }, id_0_1: { text: 'b', pos: '명사' } },
    };
    expect(materialFit(tiny, { surfaces: new Set(), bases: new Set() }).total).toBeLessThan(FIT_MIN_TYPES);
  });
});
