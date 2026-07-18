import { describe, expect, it } from 'vitest';
import { CITY_MAPS } from '../cities/index.js';
import { cityBuildingTextureKey, cityWaterTextureKey } from '../cityTileSkins.js';

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
};

describe('R4 지역 색감 배정표', () => {
  it('배정 도시의 tileSkins 와 텍스처 키 전환', () => {
    for (const [cityId, skins] of Object.entries(EXPECTED_SKINS)) {
      const city = CITY_MAPS.find((c) => c.id === cityId);
      expect(city, cityId).toBeTruthy();
      expect(city.tileSkins?.building, cityId).toBe(skins.building);
      expect(cityBuildingTextureKey(city, 5)).toBe(`ct_bldg_${skins.building}_5`);
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
});
