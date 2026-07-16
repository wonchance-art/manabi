import { describe, expect, it } from 'vitest';
import { WORLD_NODES } from '../../../components/world/worldNodes.js';
import {
  nearestOverworldRegionWorldNode,
  overworldRegionWorldNodes,
} from '../overworldRegionWorldNodes.js';
import { overworldRegionById } from '../overworldRegions.js';

const APAC = overworldRegionById('asia-pacific');

describe('APAC 월드 노드 런타임 인덱스', () => {
  it('도시 소속 노드를 제외하고 새 좌표를 id 순으로 고정한다', () => {
    const entries = overworldRegionWorldNodes(APAC, WORLD_NODES);
    const expected = WORLD_NODES.filter((node) => !node.city && node.regionId === APAC.id);

    expect(entries).toHaveLength(expected.length);
    expect(entries.map(({ node }) => node.id)).toEqual(
      [...expected.map(({ id }) => id)].sort((a, b) => a.localeCompare(b, 'en')),
    );
    for (const entry of entries) {
      expect(entry.tile).toEqual(entry.node.overworldTile);
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.tile)).toBe(true);
    }
  });

  it('지역 밖·잘못된 좌표는 fail-closed로 제외한다', () => {
    const nodes = [
      { id: 'ok', regionId: APAC.id, overworldTile: [1, 2] },
      { id: 'other', regionId: 'emea', overworldTile: [1, 2] },
      { id: 'float', regionId: APAC.id, overworldTile: [1.5, 2] },
      { id: 'outside', regionId: APAC.id, overworldTile: [APAC.width, 2] },
    ];
    expect(overworldRegionWorldNodes(APAC, nodes).map(({ node }) => node.id)).toEqual(['ok']);
  });

  it('설명 노드만 근접 상호작용 대상으로 삼고 게이트는 다음 단계까지 닫는다', () => {
    const entries = overworldRegionWorldNodes(APAC, [
      { id: 'landmark', regionId: APAC.id, overworldTile: [10, 10] },
      { id: 'gate', regionId: APAC.id, overworldTile: [11, 10], gate: { type: 'city' } },
    ]);

    expect(nearestOverworldRegionWorldNode(entries, 10, 10)).toMatchObject({ id: 'landmark' });
    expect(nearestOverworldRegionWorldNode(entries, 11, 10, 0)).toBeNull();
  });
});
