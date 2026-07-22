import { describe, expect, it } from 'vitest';
import { worldNodeReturnSpawn } from '../../../lib/world/worldNodeGeo.js';
import { CITY_DATA, CITY_MAPS } from '../cities/index.js';
import { getNode } from '../worldNodes.js';

describe('도시 정밀맵 레지스트리', () => {
  it('현재 플레이 가능한 도시를 전체 맵 뷰어와 같은 순서로 노출한다', () => {
    expect(CITY_MAPS.map((city) => city.id)).toEqual([
      'fukuoka', 'tokyo', 'osaka', 'kyoto', 'busan', 'seoul', 'grand-paris', 'mont-saint-michel', 'cote-dazur',
      'brussels', 'taipei', 'hong-kong', 'london', 'shanghai', 'beijing', 'brisbane', 'sydney', 'canberra', 'melbourne',
      'marseille', 'kawaguchiko', 'geneva', 'leman-riviera',
    ]);
    expect(Object.keys(CITY_DATA)).toEqual(CITY_MAPS.map((city) => city.id));
  });

  it('모든 도시가 뷰어에서 그릴 수 있는 격자 계약을 지킨다', () => {
    for (const city of CITY_MAPS) {
      const grid = city.buildGrid();
      expect(city.name).toBeTruthy();
      expect(city.cols).toBeGreaterThan(0);
      expect(city.rows).toBeGreaterThan(0);
      expect(grid).toBeInstanceOf(Uint8Array);
      expect(grid).toHaveLength(city.cols * city.rows);
      expect(CITY_DATA[city.id]).toBe(city);
    }
  });

  it('그랑파리 게이트와 EXIT가 EMEA 파리 노드의 같은 타일로 왕복한다', () => {
    const paris = getNode('paris');
    expect(paris).toMatchObject({
      regionId: 'emea',
      overworldTile: [213, 424],
      gate: { type: 'city', to: 'grand-paris' },
    });
    expect(CITY_DATA[paris.gate.to].returnNode).toBe(paris.id);
    expect(worldNodeReturnSpawn(paris)).toEqual({
      scene: 'overworld:emea', x: 213, y: 424,
    });
  });

  it('몽생미셸 게이트와 EXIT가 EMEA 노르망디 노드의 같은 타일로 왕복한다', () => {
    const montSaintMichel = getNode('mont-saint-michel');
    expect(montSaintMichel).toMatchObject({
      regionId: 'emea',
      overworldTile: [150, 429],
      gate: { type: 'city', to: 'mont-saint-michel' },
    });
    expect(CITY_DATA[montSaintMichel.gate.to].returnNode).toBe(montSaintMichel.id);
    expect(worldNodeReturnSpawn(montSaintMichel)).toEqual({
      scene: 'overworld:emea', x: 150, y: 429,
    });
  });

  it('코트다쥐르 게이트와 EXIT가 EMEA 니스 노드의 같은 타일로 왕복한다', () => {
    const nice = getNode('nice');
    expect(nice).toMatchObject({
      regionId: 'emea',
      overworldTile: [289, 550],
      gate: { type: 'city', to: 'cote-dazur' },
    });
    expect(CITY_DATA[nice.gate.to].returnNode).toBe(nice.id);
    expect(worldNodeReturnSpawn(nice)).toEqual({
      scene: 'overworld:emea', x: 289, y: 550,
    });
  });

  it.each([
    ['hong-kong', 'hong-kong', [1187, 956]],
    ['taipei', 'taipei', [1348, 888]],
    ['shanghai', 'shanghai', [1347, 736]],
    ['beijing', 'beijing', [1236, 521]],
    ['brisbane', 'brisbane', [2039, 2186]],
    ['sydney', 'sydney', [1999, 2345]],
    ['canberra', 'canberra', [1954, 2380]],
    ['melbourne', 'melbourne', [1862, 2442]],
  ])('%s 게이트와 EXIT가 APAC 오버월드의 같은 타일로 왕복한다', (nodeId, cityId, tile) => {
    const node = getNode(nodeId);
    expect(node).toMatchObject({
      regionId: 'asia-pacific',
      overworldTile: tile,
      gate: { type: 'city', to: cityId },
    });
    expect(CITY_DATA[node.gate.to].returnNode).toBe(node.id);
    expect(worldNodeReturnSpawn(node)).toEqual({
      scene: 'overworld:asia-pacific', x: tile[0], y: tile[1],
    });
  });

  it('브뤼셀 게이트와 EXIT가 EMEA 미디 노드의 같은 타일로 왕복한다', () => {
    const brussels = getNode('brussels');
    expect(brussels).toMatchObject({
      regionId: 'emea',
      overworldTile: [242, 375],
      gate: { type: 'city', to: 'brussels' },
    });
    expect(CITY_DATA[brussels.gate.to].returnNode).toBe(brussels.id);
    expect(worldNodeReturnSpawn(brussels)).toEqual({
      scene: 'overworld:emea', x: 242, y: 375,
    });
  });

  it('런던 게이트와 EXIT가 EMEA 세인트판크라스 노드의 같은 타일로 왕복한다', () => {
    const london = getNode('london');
    expect(london).toMatchObject({
      regionId: 'emea',
      overworldTile: [172, 356],
      gate: { type: 'city', to: 'london' },
    });
    expect(CITY_DATA[london.gate.to].returnNode).toBe(london.id);
    expect(worldNodeReturnSpawn(london)).toEqual({
      scene: 'overworld:emea', x: 172, y: 356,
    });
  });

  it('마르세유 게이트와 EXIT가 EMEA 생샤를역 노드의 같은 타일로 왕복한다', () => {
    const marseille = getNode('marseille');
    expect(marseille).toMatchObject({
      regionId: 'emea',
      overworldTile: [259, 561],
      gate: { type: 'city', to: 'marseille' },
    });
    expect(CITY_DATA[marseille.gate.to].returnNode).toBe(marseille.id);
    expect(worldNodeReturnSpawn(marseille)).toEqual({
      scene: 'overworld:emea', x: 259, y: 561,
    });
  });

  it('제네바 게이트와 EXIT가 EMEA 코르나뱅역 노드의 같은 타일로 왕복한다', () => {
    const geneva = getNode('geneva');
    expect(geneva).toMatchObject({
      regionId: 'emea',
      overworldTile: [271, 489],
      gate: { type: 'city', to: 'geneva' },
    });
    expect(CITY_DATA[geneva.gate.to].returnNode).toBe(geneva.id);
    expect(worldNodeReturnSpawn(geneva)).toEqual({
      scene: 'overworld:emea', x: 271, y: 489,
    });
  });

  it('레만호 게이트와 EXIT가 EMEA 로잔역 노드의 같은 타일로 왕복한다', () => {
    const leman = getNode('leman-riviera');
    expect(leman).toMatchObject({
      regionId: 'emea',
      overworldTile: [279, 481],
      gate: { type: 'city', to: 'leman-riviera' },
    });
    expect(CITY_DATA[leman.gate.to].returnNode).toBe(leman.id);
    expect(worldNodeReturnSpawn(leman)).toEqual({
      scene: 'overworld:emea', x: 279, y: 481,
    });
  });

  it('가와구치코 게이트와 EXIT가 전국맵 가와구치코역 노드의 같은 타일로 왕복한다', () => {
    const kawaguchiko = getNode('kawaguchiko');
    expect(kawaguchiko).toMatchObject({
      legacyTile: [298, 259],
      gate: { type: 'city', to: 'kawaguchiko' },
    });
    expect(CITY_DATA[kawaguchiko.gate.to].returnNode).toBe(kawaguchiko.id);
    expect(worldNodeReturnSpawn(kawaguchiko)).toEqual({
      scene: 'plaza', x: 298, y: 259,
    });
  });

  it('기존 APAC 도시 EXIT는 plaza의 기존 도시 노드 타일로 그대로 복귀한다', () => {
    for (const city of CITY_MAPS.filter(({ returnNode }) => getNode(returnNode)?.legacyTile)) {
      const node = getNode(city.returnNode);
      expect(node, city.id).toBeTruthy();
      expect(worldNodeReturnSpawn(node), city.id).toEqual({
        scene: 'plaza', x: node.tile[0], y: node.tile[1],
      });
    }
  });
});
