import { describe, expect, it } from 'vitest';
import {
  WORLD_NODES,
  getNode,
} from '../../../components/world/worldNodes.js';
import {
  MAP_W,
  decodeMap,
  isBlocked,
  project,
} from '../../../components/world/mapData.js';

const GRID = decodeMap();

function interactionDistance(left, right) {
  return Math.max(Math.abs(left[0] - right[0]), Math.abs(left[1] - right[1]));
}

describe('가와구치코 전국맵 도시 게이트', () => {
  it('가와구치코역 실좌표를 결정적으로 투영한 보행 가능 타일에 등록한다', () => {
    const node = getNode('kawaguchiko');
    const projected = project(node.lon, node.lat);
    const code = GRID[projected.y * MAP_W + projected.x];

    expect(node).toMatchObject({
      kind: 'city',
      lon: 138.7645,
      lat: 35.4986,
      tile: [298, 259],
      legacyTile: [298, 259],
      arrivalOffset: [0, 0],
      gate: { type: 'city', to: 'kawaguchiko' },
    });
    expect(projected).toEqual({ x: 298, y: 259 });
    expect(isBlocked(code)).toBe(false);
  });

  it('기존 일본 도시와 후지산 랜드마크의 상호작용 반경을 침범하지 않는다', () => {
    const node = getNode('kawaguchiko');
    for (const id of ['tokyo', 'osaka', 'kyoto', 'fukuoka', 'fuji']) {
      expect(interactionDistance(node.tile, getNode(id).tile), id).toBeGreaterThan(1);
    }
  });

  it('기존 후지산 설산 랜드마크는 게이트 없이 그대로 유지한다', () => {
    const fuji = getNode('fuji');
    expect(fuji).toMatchObject({
      id: 'fuji',
      kind: 'landmark',
      peak: 'fuji',
    });
    expect(fuji.gate).toBeUndefined();
    expect(WORLD_NODES.filter(({ id }) => id === 'fuji')).toHaveLength(1);
  });
});
