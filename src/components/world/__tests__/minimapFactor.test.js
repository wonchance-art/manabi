import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { CITY_MINI_SCALE, cityMinimapLayout } from '../cityMinimap.js';

const GAME_CANVAS_SOURCE = readFileSync(new URL('../GameCanvas.jsx', import.meta.url), 'utf8');
const POLICY_SOURCE = GAME_CANVAS_SOURCE.match(
  /export const cityMinimapLayoutForCity = ([\s\S]*?\n};)/,
)?.[1];

if (!POLICY_SOURCE) throw new Error('GameCanvas cityMinimapLayoutForCity policy not found');

// GameCanvas는 Phaser/React 통합 모듈이라 node 단위 테스트에서 직접 import하지 않는다.
// 대신 체크인된 순수 정책 함수 본문을 같은 두 의존성으로 실행해 제품 배선을 검증한다.
const cityMinimapLayoutForCity = vm.runInNewContext(`(${POLICY_SOURCE.replace(/;$/, '')})`, {
  CITY_MINI_SCALE,
  cityMinimapLayout,
});

function memoryEstimate(cols, rows, layout) {
  const cells = cols * rows;
  const sourceCells = layout.sourceWidth * layout.sourceHeight;
  const sourceCanvasBytes = sourceCells * 4;
  const contractBytes = cells * 3 + sourceCanvasBytes * 2 + layout.backingBytes;
  const runtimeBytes = contractBytes + cells + (layout.factor > 1 ? sourceCells * 2 : 0);
  return { contractBytes, runtimeBytes };
}

describe('도시별 미니맵 factor 복귀 정책', () => {
  it('도쿄 factor 2로 13.23 MiB 런타임 하한을 복구한다', () => {
    const layout = cityMinimapLayoutForCity('tokyo', 824, 1086);
    const estimate = memoryEstimate(824, 1086, layout);

    expect(layout).toEqual({
      factor: 2,
      sourceWidth: 412,
      sourceHeight: 543,
      width: 1236,
      height: 1629,
      backingBytes: 8_053_776,
    });
    expect(estimate).toEqual({ contractBytes: 12_528_096, runtimeBytes: 13_870_392 });
    expect(estimate.runtimeBytes / (1024 * 1024)).toBeCloseTo(13.23, 2);
    expect(estimate.runtimeBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('코트다쥐르 factor 3으로 15.97 MiB 런타임 하한을 복구한다', () => {
    const layout = cityMinimapLayoutForCity('cote-dazur', 1571, 1169);
    const estimate = memoryEstimate(1571, 1169, layout);

    expect(layout).toEqual({
      factor: 3,
      sourceWidth: 524,
      sourceHeight: 390,
      width: 1572,
      height: 1170,
      backingBytes: 7_356_960,
    });
    expect(estimate).toEqual({ contractBytes: 14_501_337, runtimeBytes: 16_746_556 });
    expect(estimate.runtimeBytes / (1024 * 1024)).toBeCloseTo(15.97, 2);
    expect(estimate.runtimeBytes).toBeLessThan(24 * 1024 * 1024);
  });

  it('다른 도시의 적응형 factor와 GameCanvas 소비 배선을 보존한다', () => {
    expect(cityMinimapLayoutForCity('busan', 1320, 1114))
      .toEqual(cityMinimapLayout(1320, 1114));
    expect(cityMinimapLayoutForCity('seoul', 1721, 1448))
      .toEqual(cityMinimapLayout(1721, 1448));
    expect(GAME_CANVAS_SOURCE)
      .toContain('const layout = cityMinimapLayoutForCity(city.id, w, h);');
  });
});
