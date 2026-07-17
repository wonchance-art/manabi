import { describe, expect, it } from 'vitest';
import { worldNodeReturnSpawn } from '../../../lib/world/worldNodeGeo.js';
import { CITY_DATA, CITY_MAPS } from '../cities/index.js';
import { ALL_WORLD_NODES, getNode } from '../worldNodes.js';

describe('도시 정밀맵 레지스트리', () => {
  it('현재 플레이 가능한 도시를 전체 맵 뷰어와 같은 순서로 노출한다', () => {
    expect(CITY_MAPS.map((city) => city.id)).toEqual([
      'fukuoka', 'tokyo', 'osaka', 'kyoto', 'busan', 'seoul', 'grand-paris', 'mont-saint-michel', 'cote-dazur',
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

  it('모든 city gate가 등록 도시의 returnNode로 왕복한다', () => {
    for (const node of ALL_WORLD_NODES.filter(({ gate }) => gate?.type === 'city')) {
      const city = CITY_DATA[node.gate.to];
      expect(city, `${node.id} → ${node.gate.to}`).toBeTruthy();
      expect(city.returnNode, node.id).toBe(node.id);
      expect(worldNodeReturnSpawn(node), node.id).toEqual(
        node.regionId === 'asia-pacific'
          ? { scene: 'plaza', x: node.tile[0], y: node.tile[1] }
          : { scene: `overworld:${node.regionId}`, x: node.overworldTile[0], y: node.overworldTile[1] },
      );
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

  it('기존 APAC 도시 EXIT는 plaza의 기존 도시 노드 타일로 그대로 복귀한다', () => {
    for (const city of CITY_MAPS.filter(({ returnNode }) => getNode(returnNode)?.regionId === 'asia-pacific')) {
      const node = getNode(city.returnNode);
      expect(node, city.id).toBeTruthy();
      expect(worldNodeReturnSpawn(node), city.id).toEqual({
        scene: 'plaza', x: node.tile[0], y: node.tile[1],
      });
    }
  });
});
