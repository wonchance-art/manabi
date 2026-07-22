import { describe, expect, it } from 'vitest';
import {
  cityBeachTextureKey,
  cityBuildingTextureKey,
  cityWaterTextureKey,
} from '../cityTileSkins.js';

describe('CityScene 도시별 타일 스킨', () => {
  it('미지정 도시는 기존 모래 키, mudflat 도시는 갯벌 키를 선택한다', () => {
    expect(cityBeachTextureKey({})).toBe('ct_beach');
    expect(cityBeachTextureKey({ tileSkins: {} })).toBe('ct_beach');
    expect(cityBeachTextureKey({ tileSkins: { beach: 'mudflat' } })).toBe('ct_beach_mudflat');
  });

  it('미지정 도시의 건물·수면 텍스처 키를 기존 계약 그대로 유지한다', () => {
    expect(cityBuildingTextureKey(undefined, 0)).toBe('ct_bldg_0');
    expect(cityBuildingTextureKey({ tileSkins: {} }, 15)).toBe('ct_bldg_15');
    expect([0, 1, 2].map((frame) => cityWaterTextureKey({}, frame))).toEqual([
      'ct_water0',
      'ct_water1',
      'ct_water2',
    ]);
  });

  it('지역 스킨을 지정하면 건물 마스크와 수면 프레임을 스킨 키로 전환한다', () => {
    expect(cityBuildingTextureKey({ tileSkins: { building: 'zinc' } }, 7))
      .toBe('ct_bldg_zinc_7');
    expect(cityBuildingTextureKey({ tileSkins: { building: 'terracotta' } }, 12))
      .toBe('ct_bldg_terracotta_12');
    expect(cityWaterTextureKey({ tileSkins: { water: 'emerald' } }, 2))
      .toBe('ct_water_emerald2');
    expect(cityWaterTextureKey({ tileSkins: { water: 'glacial' } }, 1))
      .toBe('ct_water_glacial1');
  });
});
