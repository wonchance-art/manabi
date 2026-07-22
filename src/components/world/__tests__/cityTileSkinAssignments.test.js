import { describe, expect, it } from 'vitest';
import { CITY_MAPS } from '../cities/index.js';
import {
  cityBuildingSkinAt,
  cityBuildingTextureKey,
  cityWaterTextureKey,
} from '../cityTileSkins.js';

// 🎨 R4 지역 색감 — 도시별 tileSkins 배정표 회귀 고정(Claude 배선 라운드).
// 미지정 도시는 기본 텍스처 키 불변(무회귀 계약)임을 함께 고정한다.

const EXPECTED_SKINS = {
  'grand-paris': { building: 'zinc' },
  'cote-dazur': { building: 'terracotta', water: 'emerald' },
  marseille: { building: 'terracotta', water: 'emerald' },
  brisbane: { building: 'terracotta' },
  sydney: { building: 'terracotta' },
  canberra: { building: 'terracotta' },
  kyoto: { building: 'kawara' },
  kawaguchiko: { building: 'kawara' },
  beijing: { building: 'hutong' },
  london: { building: 'brick' },
  brussels: { building: 'brick' },
  // R4B — 빙하수 청록(레만호 공유 표현), 건물은 기본 유지.
  geneva: { water: 'glacial' },
  lyon: { building: 'terracotta' },
  'leman-riviera': { water: 'glacial' },
};

describe('R4 지역 색감 배정표', () => {
  it('배정 도시의 tileSkins 와 텍스처 키 전환', () => {
    for (const [cityId, skins] of Object.entries(EXPECTED_SKINS)) {
      const city = CITY_MAPS.find((c) => c.id === cityId);
      expect(city, cityId).toBeTruthy();
      if (skins.building) {
        expect(city.tileSkins?.building, cityId).toBe(skins.building);
        expect(cityBuildingTextureKey(city, 5)).toBe(`ct_bldg_${skins.building}_5`);
      } else {
        expect(city.tileSkins?.building, cityId).toBeUndefined();
        expect(cityBuildingTextureKey(city, 5)).toBe('ct_bldg_5');
      }
      if (skins.water) {
        expect(city.tileSkins?.water, cityId).toBe(skins.water);
        expect(cityWaterTextureKey(city, 1)).toBe(`ct_water_${skins.water}1`);
      } else {
        expect(cityWaterTextureKey(city, 1)).toBe('ct_water1');
      }
    }
  });

  it('미배정 도시는 기본 키 불변(무회귀) — 현대 도심·한국 도시 등', () => {
    const assigned = new Set(Object.keys(EXPECTED_SKINS));
    for (const city of CITY_MAPS.filter((c) => !assigned.has(c.id))) {
      expect(city.tileSkins?.building, city.id).toBeUndefined();
      expect(city.tileSkins?.water, city.id).toBeUndefined();
      expect(cityBuildingTextureKey(city, 5)).toBe('ct_bldg_5');
      expect(cityWaterTextureKey(city, 0)).toBe('ct_water0');
    }
  });

  it('부산 감천 BUILDING만 확정 사각형 안에서 4색을 결정적으로 분산한다', () => {
    const busan = CITY_MAPS.find((city) => city.id === 'busan');
    const zone = busan.zoneSkins?.[0];
    expect(zone).toEqual({
      id: 'gamcheon-pastel',
      bounds: [520, 750, 590, 830],
      building: ['pastel-coral', 'pastel-apricot', 'pastel-mint', 'pastel-sky'],
    });
    expect(Object.isFrozen(zone)).toBe(true);
    expect(Object.isFrozen(zone.bounds)).toBe(true);
    expect(Object.isFrozen(zone.building)).toBe(true);

    const expected = new Map([
      ['526,750', 'pastel-coral'],
      ['555,750', 'pastel-apricot'],
      ['556,750', 'pastel-mint'],
      ['557,750', 'pastel-sky'],
    ]);
    const grid = busan.buildGrid();
    for (const [coordinate, skin] of expected) {
      const [x, y] = coordinate.split(',').map(Number);
      expect(grid[y * busan.cols + x]).toBe(busan.CITY_TILE.BUILDING);
      expect(cityBuildingSkinAt(busan, x, y)).toBe(skin);
    }

    const buildManifest = () => {
      const manifest = [];
      for (let y = zone.bounds[1]; y <= zone.bounds[3]; y += 1) {
        for (let x = zone.bounds[0]; x <= zone.bounds[2]; x += 1) {
          if (grid[y * busan.cols + x] !== busan.CITY_TILE.BUILDING) continue;
          const open = (nx, ny) => grid[ny * busan.cols + nx] !== busan.CITY_TILE.BUILDING;
          const mask = Number(open(x, y - 1))
            | (Number(open(x + 1, y)) << 1)
            | (Number(open(x, y + 1)) << 2)
            | (Number(open(x - 1, y)) << 3);
          manifest.push(`${x},${y}:${cityBuildingTextureKey(busan, mask, x, y)}`);
        }
      }
      return Buffer.from(JSON.stringify(manifest));
    };

    const firstBake = buildManifest();
    const secondBake = buildManifest();
    expect(firstBake).toEqual(secondBake);
    expect(JSON.parse(firstBake.toString())).toHaveLength(476);
    expect(new Set(JSON.parse(firstBake.toString()).map((entry) => entry.split(':')[1].split('_')[2])))
      .toEqual(new Set(zone.building));
  });
});
