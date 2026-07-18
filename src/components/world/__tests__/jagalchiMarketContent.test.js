import { describe, expect, it } from 'vitest';
import { JAGALCHI_ACT_COPY, jagalchiActCopy } from '../jagalchiMarketContent.js';
import { JAGALCHI_MARKET_ACTS, JAGALCHI_MARKET_SCENE_KEY } from '../jagalchiMarketScene.js';

// 자갈치 액트 카피 — 씬 골격 act id 와 1:1, [ko/local/gloss] 축 계약(발음 축 없음 — 한국어권 도시).

describe('자갈치 액트 카피 — 씬 계약', () => {
  it('4막 카피가 씬 골격 act id 와 1:1 로 존재한다', () => {
    const actIds = JAGALCHI_MARKET_ACTS.map((act) => act.id);
    expect(Object.keys(JAGALCHI_ACT_COPY).sort()).toEqual([...actIds].sort());
    for (const actId of actIds) {
      const copy = jagalchiActCopy(actId);
      expect(copy.title?.length).toBeGreaterThan(0);
      expect(copy.ko?.length).toBeGreaterThan(0);
      expect(copy.local?.length).toBeGreaterThan(0);
      expect(copy.gloss?.length).toBeGreaterThan(0);
      expect(copy.reading).toBeUndefined(); // 사투리=현지어 축 — 발음 축 없음(MSM 과의 의도적 차이)
    }
    expect(jagalchiActCopy('no-such-act')).toBeNull();
  });
});

describe('부산 자갈치 게이트 — 도시 배선', () => {
  it('jagalchi 노드가 씬 게이트를 싣고 보행 타일 위에 있다', async () => {
    const { BUSAN } = await import('../cities/busan.js');
    const { isCityWalkable } = await import('../cities/terrain.js');
    const node = BUSAN.nodes.find((entry) => entry.id === 'jagalchi');
    expect(node?.gate).toEqual({ type: 'story-scene', scene: JAGALCHI_MARKET_SCENE_KEY });
    const grid = BUSAN.buildGrid();
    const [x, y] = node.tile;
    expect(isCityWalkable(grid[y * BUSAN.cols + x]), `jagalchi @${x},${y}`).toBe(true);
  });
});
