import { describe, expect, it } from 'vitest';
import {
  cityBeachTextureKey,
  cityBuildingSkinAt,
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

  it('포함 경계의 첫 zoneSkins 건물 스킨을 좌표 해시로 결정한다', () => {
    const city = {
      tileSkins: { building: 'brick' },
      zoneSkins: [
        { bounds: [520, 750, 590, 830], building: ['pastel-coral'] },
        { bounds: [540, 760, 600, 840], building: ['pastel-sky'] },
      ],
    };

    expect(cityBuildingSkinAt(city, 520, 750)).toBe('pastel-coral');
    expect(cityBuildingSkinAt(city, 590, 830)).toBe('pastel-coral');
    expect(cityBuildingSkinAt(city, 550, 780)).toBe('pastel-coral');
    expect(cityBuildingTextureKey(city, 6, 550, 780)).toBe('ct_bldg_pastel-coral_6');
  });

  it('구역 밖·잘못된 구역은 전역 건물 스킨과 기존 기본 키로 폴백한다', () => {
    const city = {
      tileSkins: { building: 'brick' },
      zoneSkins: [{ bounds: [10, 10, 20, 20], building: [] }],
    };

    expect(cityBuildingSkinAt(city, 9, 10)).toBe('brick');
    expect(cityBuildingSkinAt(city, 10, 10)).toBe('brick');
    expect(cityBuildingTextureKey(city, 3, 21, 20)).toBe('ct_bldg_brick_3');
    expect(cityBuildingTextureKey({ zoneSkins: [] }, 3, 10, 10)).toBe('ct_bldg_3');
  });
});
