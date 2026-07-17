import { describe, expect, it } from 'vitest';
import { cityBeachTextureKey } from '../cityTileSkins.js';

describe('CityScene 도시별 타일 스킨', () => {
  it('미지정 도시는 기존 모래 키, mudflat 도시는 갯벌 키를 선택한다', () => {
    expect(cityBeachTextureKey({})).toBe('ct_beach');
    expect(cityBeachTextureKey({ tileSkins: {} })).toBe('ct_beach');
    expect(cityBeachTextureKey({ tileSkins: { beach: 'mudflat' } })).toBe('ct_beach_mudflat');
  });
});
