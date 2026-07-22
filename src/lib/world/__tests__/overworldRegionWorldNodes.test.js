import { describe, expect, it } from 'vitest';
import {
  ALL_WORLD_NODES,
  WORLD_NODES,
  getNode,
} from '../../../components/world/worldNodes.js';
import {
  nearestOverworldRegionWorldNode,
  overworldRegionWorldNodeMode,
  overworldRegionWorldNodes,
  resolveOverworldRegionFerry,
} from '../overworldRegionWorldNodes.js';
import { EMEA_RAIL_NETWORK } from '../emeaRail.js';
import { overworldRegionById } from '../overworldRegions.js';

const APAC = overworldRegionById('asia-pacific');
const EMEA = overworldRegionById('emea');

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

  it('APAC 지역 도시 노드를 좌표로 색인하고 도시 게이트를 연다', () => {
    const entries = overworldRegionWorldNodes(APAC, ALL_WORLD_NODES);
    const expected = [
      ['hong-kong', [1187, 956], 'zh'],
      ['taipei', [1348, 888], 'zh'],
      ['shanghai', [1347, 736], 'zh'],
      ['beijing', [1236, 521], 'zh'],
      ['brisbane', [2039, 2186], 'en'],
      ['sydney', [1999, 2345], 'en'],
      ['canberra', [1954, 2380], 'en'],
      ['melbourne', [1862, 2442], 'en'],
    ];

    for (const [id, tile, contentLocale] of expected) {
      const node = getNode(id);
      expect(node).toMatchObject({
        regionId: APAC.id,
        contentLocale,
        overworldTile: tile,
        gate: { type: 'city', to: id },
      });
      expect(entries.map(({ node: entry }) => entry.id)).toContain(id);
      expect(nearestOverworldRegionWorldNode(entries, tile[0], tile[1], 0)).toBe(node);
      expect(overworldRegionWorldNodeMode(node)).toBe('city');
    }
  });
});

describe('EMEA 도시 게이트 런타임 인덱스', () => {
  it('파리·몽생미셸·니스·브뤼셀·런던·마르세유·제네바·레만호·리옹·보르도 노드를 지역 좌표로 색인하고 도시 게이트를 연다', () => {
    const paris = getNode('paris');
    const montSaintMichel = getNode('mont-saint-michel');
    const nice = getNode('nice');
    const brussels = getNode('brussels');
    const london = getNode('london');
    const marseille = getNode('marseille');
    const geneva = getNode('geneva');
    const leman = getNode('leman-riviera');
    const lyon = getNode('lyon');
    const bordeaux = getNode('bordeaux');
    const entries = overworldRegionWorldNodes(EMEA, ALL_WORLD_NODES);

    expect(paris).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'fr',
      overworldTile: [213, 424],
      gate: { type: 'city', to: 'grand-paris' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(paris.id);
    expect(nearestOverworldRegionWorldNode(entries, 213, 424, 0)).toBe(paris);
    expect(overworldRegionWorldNodeMode(paris)).toBe('city');
    expect(montSaintMichel).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'fr',
      overworldTile: [150, 429],
      gate: { type: 'city', to: 'mont-saint-michel' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(montSaintMichel.id);
    expect(nearestOverworldRegionWorldNode(entries, 150, 429, 0)).toBe(montSaintMichel);
    expect(overworldRegionWorldNodeMode(montSaintMichel)).toBe('city');
    expect(nice).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'fr',
      arrivalOffset: [0, -1],
      overworldTile: [289, 550],
      gate: { type: 'city', to: 'cote-dazur' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(nice.id);
    expect(nearestOverworldRegionWorldNode(entries, 289, 550, 0)).toBe(nice);
    expect(overworldRegionWorldNodeMode(nice)).toBe('city');
    expect(brussels).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'fr',
      overworldTile: [242, 375],
      gate: { type: 'city', to: 'brussels' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(brussels.id);
    expect(nearestOverworldRegionWorldNode(entries, 242, 375, 0)).toBe(brussels);
    expect(overworldRegionWorldNodeMode(brussels)).toBe('city');
    expect(london).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'en',
      arrivalOffset: [0, -2],
      overworldTile: [172, 356],
      gate: { type: 'city', to: 'london' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(london.id);
    expect(nearestOverworldRegionWorldNode(entries, 172, 356, 0)).toBe(london);
    expect(overworldRegionWorldNodeMode(london)).toBe('city');
    expect(marseille).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'fr',
      arrivalOffset: [0, 0],
      overworldTile: [259, 561],
      gate: { type: 'city', to: 'marseille' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(marseille.id);
    expect(nearestOverworldRegionWorldNode(entries, 259, 561, 0)).toBe(marseille);
    expect(overworldRegionWorldNodeMode(marseille)).toBe('city');
    expect(geneva).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'fr',
      arrivalOffset: [0, 0],
      overworldTile: [271, 489],
      gate: { type: 'city', to: 'geneva' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(geneva.id);
    expect(nearestOverworldRegionWorldNode(entries, 271, 489, 0)).toBe(geneva);
    expect(overworldRegionWorldNodeMode(geneva)).toBe('city');
    expect(leman).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'fr',
      arrivalOffset: [0, 0],
      overworldTile: [279, 481],
      gate: { type: 'city', to: 'leman-riviera' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(leman.id);
    expect(nearestOverworldRegionWorldNode(entries, 279, 481, 0)).toBe(leman);
    expect(overworldRegionWorldNodeMode(leman)).toBe('city');
    expect(lyon).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'fr',
      arrivalOffset: [0, 0],
      overworldTile: [251, 500],
      gate: { type: 'city', to: 'lyon' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(lyon.id);
    expect(nearestOverworldRegionWorldNode(entries, 251, 500, 0)).toBe(lyon);
    expect(overworldRegionWorldNodeMode(lyon)).toBe('city');
    expect(bordeaux).toMatchObject({
      regionId: EMEA.id,
      contentLocale: 'fr',
      arrivalOffset: [0, 0],
      overworldTile: [165, 523],
      gate: { type: 'city', to: 'bordeaux' },
    });
    expect(entries.map(({ node }) => node.id)).toContain(bordeaux.id);
    expect(nearestOverworldRegionWorldNode(entries, 165, 523, 0)).toBe(bordeaux);
    expect(overworldRegionWorldNodeMode(bordeaux)).toBe('city');
    const railHub = EMEA_RAIL_NETWORK.hubs.find(({ id }) => id === 'paris-rail-hub');
    expect(Math.max(
      Math.abs(paris.overworldTile[0] - railHub.tile[0]),
      Math.abs(paris.overworldTile[1] - railHub.tile[1]),
    )).toBeGreaterThan(1);
  });
});
