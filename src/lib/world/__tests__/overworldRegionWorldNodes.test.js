import { describe, expect, it } from 'vitest';
import { WORLD_NODES } from '../../../components/world/worldNodes.js';
import {
  nearestOverworldRegionWorldNode,
  overworldRegionWorldNodeMode,
  overworldRegionWorldNodes,
  resolveOverworldRegionFerry,
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

  it('설명·도시·페리·공항은 열고 알 수 없는 스토리 게이트는 닫는다', () => {
    const entries = overworldRegionWorldNodes(APAC, [
      { id: 'landmark', regionId: APAC.id, overworldTile: [10, 10] },
      { id: 'city', regionId: APAC.id, overworldTile: [11, 10], gate: { type: 'city' } },
      { id: 'airport', regionId: APAC.id, overworldTile: [12, 10], gate: { type: 'story-scene', scene: 'airport' } },
      { id: 'unknown', regionId: APAC.id, overworldTile: [13, 10], gate: { type: 'story-scene', scene: 'unknown' } },
    ]);

    expect(nearestOverworldRegionWorldNode(entries, 10, 10)).toMatchObject({ id: 'landmark' });
    expect(nearestOverworldRegionWorldNode(entries, 11, 10, 0)).toMatchObject({ id: 'city' });
    expect(nearestOverworldRegionWorldNode(entries, 12, 10, 0)).toMatchObject({ id: 'airport' });
    expect(nearestOverworldRegionWorldNode(entries, 13, 10, 0)).toBeNull();
    expect(overworldRegionWorldNodeMode({ gate: { type: 'ferry' } })).toBe('ferry');
    expect(overworldRegionWorldNodeMode({ gate: { type: 'story-scene', scene: 'airport' } })).toBe('airport');
    expect(overworldRegionWorldNodeMode({ gate: { type: 'story-scene', scene: 'unknown' } })).toBe('blocked');
  });

  it('페리는 같은 지역의 상호 왕복 게이트와 새 도착 좌표만 허용한다', () => {
    const source = {
      id: 'source', regionId: APAC.id, overworldTile: [20, 20],
      gate: { type: 'ferry', to: 'destination' },
    };
    const destination = {
      id: 'destination', regionId: APAC.id, overworldTile: [30, 30],
      gate: { type: 'ferry', to: 'source' },
    };
    const entries = overworldRegionWorldNodes(APAC, [source, destination]);

    expect(resolveOverworldRegionFerry(entries, source, destination.id, APAC.sceneId)).toMatchObject({
      source,
      destination,
      spawn: { scene: APAC.sceneId, x: 30, y: 30 },
    });
    expect(resolveOverworldRegionFerry(entries, source, 'other', APAC.sceneId)).toBeNull();
    expect(resolveOverworldRegionFerry(entries, source, destination.id, '')).toBeNull();
    expect(resolveOverworldRegionFerry(
      overworldRegionWorldNodes(APAC, [source, { ...destination, gate: { type: 'ferry', to: 'other' } }]),
      source,
      destination.id,
      APAC.sceneId,
    )).toBeNull();
  });
});
