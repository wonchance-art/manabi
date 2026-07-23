import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { worldNodeReturnSpawn } from '../../../lib/world/worldNodeGeo.js';
import { buildCityScene } from '../CityScene.js';
import { CITY_MANIFEST, loadAllCities } from '../cities/manifest.js';
import { getNode } from '../worldNodes.js';

vi.mock('../QuestReview', () => ({
  GBC: { cream: '#f6edcf', ink: '#2a2118', font: 'monospace' },
}));

const HEAVY = { timeout: 60000 };
let cities;

const gridSha = (city) => createHash('sha256').update(city.buildGrid()).digest('hex');

describe('26도시 lazy 진입·리턴 스모크', () => {
  beforeAll(async () => {
    cities = await loadAllCities();
  }, 60000);

  it('manifest 순서와 payload metadata가 26/26 exact 일치한다', () => {
    expect(cities.map(({ id }) => id)).toEqual(CITY_MANIFEST.map(({ id }) => id));
    for (let index = 0; index < cities.length; index += 1) {
      const { id, name, cols, rows } = CITY_MANIFEST[index];
      expect(cities[index]).toMatchObject({ id, name, cols, rows });
    }
  });

  it('26도시 scene key와 gate→return spawn 왕복을 전수 확인한다', HEAVY, () => {
    class FakeScene {
      constructor(key) { this.sceneKey = key; }
    }
    for (const city of cities) {
      const Scene = buildCityScene({ Scene: FakeScene }, city, {});
      expect(new Scene().sceneKey, city.id).toBe(`city:${city.id}`);
      const returnNode = getNode(city.returnNode);
      expect(returnNode?.gate, city.id).toMatchObject({ type: 'city', to: city.id });
      expect(worldNodeReturnSpawn(returnNode), city.id).toMatchObject({
        scene: expect.stringMatching(/^(plaza|overworld:)/),
        x: expect.any(Number),
        y: expect.any(Number),
      });
    }
  });

  it('26개 buildGrid는 같은 프로세스 2회 byte-identical이다', HEAVY, () => {
    const first = cities.map((city) => `${city.id}:${gridSha(city)}`);
    const second = cities.map((city) => `${city.id}:${gridSha(city)}`);
    expect(second).toEqual(first);
  });

  it('GameCanvas는 load→scene.add→transition 순서와 unmount 가드를 고정한다', () => {
    const source = readFileSync(new URL('../GameCanvas.jsx', import.meta.url), 'utf8');
    const awaitLoad = source.indexOf('const cityData = await ensureCityScene(id)');
    const sceneAdd = source.indexOf("game.scene.add(`city:${id}`");
    const transition = source.indexOf('sourceScene.enterCity?.(id)');
    expect(sceneAdd).toBeGreaterThan(-1);
    expect(awaitLoad).toBeGreaterThan(sceneAdd);
    expect(transition).toBeGreaterThan(awaitLoad);
    expect(source).toContain('destroyed || gameRef.current !== game');
    expect(source).toContain("message: '도시를 불러오지 못했어요. 연결을 확인해 주세요.'");
  });
});
