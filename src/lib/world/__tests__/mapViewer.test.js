import { describe, expect, it } from 'vitest';
import { cityMapMarkers, overworldRegionMarkers, worldMapMarkers } from '../mapViewer.js';

describe('전체 맵 뷰어 마커', () => {
  it('전국 지도에는 전국 노드만 남기고 잘못된 좌표를 제외한다', () => {
    expect(worldMapMarkers([
      { id: 'seoul', name: '서울', tile: [10, 20] },
      { id: 'tokyo-city', name: '도쿄 시내', tile: [30, 40], city: 'tokyo' },
      { id: 'broken', name: '잘못된 노드', tile: [Number.NaN, 1] },
    ])).toEqual([
      { id: 'world:seoul', source: 'world', name: '서울', x: 10, y: 20 },
    ]);
  });

  it('도시 노드·역·교통 지점을 합치고 같은 지점은 한 번만 표시한다', () => {
    const shared = { id: 'station', nameJa: '中央駅', tile: [8, 9] };
    expect(cityMapMarkers({
      nodes: [{ id: 'shop', name: '상점', tile: [2, 3] }],
      stations: [shared],
      transitPoints: [shared, { id: 'ferry', label: '부두', tile: [12, 13] }],
    })).toEqual([
      { id: 'node:shop', source: 'node', name: '상점', x: 2, y: 3 },
      { id: 'station:station', source: 'station', name: '中央駅', x: 8, y: 9 },
      { id: 'transit:ferry', source: 'transit', name: '부두', x: 12, y: 13 },
    ]);
  });

  it('도시 데이터가 아직 없으면 빈 목록을 반환한다', () => {
    expect(cityMapMarkers(null)).toEqual([]);
  });

  it('신규 오버월드 지역은 연결 게이트를 핀으로 표시한다', () => {
    expect(overworldRegionMarkers({
      gate: { id: 'moscow', label: '모스크바 횡단열차역', tile: { x: 768, y: 253 } },
      airGate: { id: 'paris-cdg', label: '파리 샤를 드골 공항', tile: { x: 214, y: 420 } },
    })).toEqual([
      {
        id: 'gate:moscow',
        source: 'gate',
        name: '모스크바 횡단열차역',
        x: 768,
        y: 253,
      },
      {
        id: 'gate:paris-cdg',
        source: 'gate',
        name: '파리 샤를 드골 공항',
        x: 214,
        y: 420,
      },
    ]);
    expect(overworldRegionMarkers({
      gate: { id: 'valid', tile: { x: 1, y: 2 } },
      airGate: { id: 'broken', tile: { x: Number.NaN, y: 2 } },
    })).toHaveLength(1);
    expect(overworldRegionMarkers(null)).toEqual([]);
  });

  it('기존 월드 노드는 같은 지역의 새 오버월드 타일로 비교 표시한다', () => {
    const region = {
      id: 'asia-pacific',
      gate: { id: 'vladivostok', label: '블라디보스토크역', tile: { x: 100, y: 200 } },
    };
    expect(overworldRegionMarkers(region, [
      { id: 'seoul', name: '서울', regionId: 'asia-pacific', overworldTile: [10, 20] },
      { id: 'fukuoka-npc', name: '후쿠오카 NPC', regionId: 'asia-pacific', overworldTile: [11, 21], city: 'fukuoka' },
      { id: 'paris', name: '파리', regionId: 'emea', overworldTile: [30, 40] },
      { id: 'broken', name: '잘못된 노드', regionId: 'asia-pacific', overworldTile: [Number.NaN, 1] },
    ])).toEqual([
      { id: 'gate:vladivostok', source: 'gate', name: '블라디보스토크역', x: 100, y: 200 },
      { id: 'world-node:seoul', source: 'world-node', name: '서울', x: 10, y: 20 },
    ]);
  });

  it('유럽 철도 허브를 별도 핀으로 모두 표시한다', () => {
    const region = {
      id: 'emea',
      gate: { id: 'moscow', label: '모스크바 횡단열차역', tile: { x: 768, y: 253 } },
      airGate: { id: 'paris-cdg', label: '파리 샤를 드골 공항', tile: { x: 214, y: 420 } },
    };
    expect(overworldRegionMarkers(region, [], [
      { id: 'paris-rail-hub', label: '파리 철도 허브', tile: [211, 424] },
      { id: 'berlin-rail-hub', label: '베를린 철도 허브', tile: [386, 333] },
    ])).toEqual([
      { id: 'gate:moscow', source: 'gate', name: '모스크바 횡단열차역', x: 768, y: 253 },
      { id: 'gate:paris-cdg', source: 'gate', name: '파리 샤를 드골 공항', x: 214, y: 420 },
      { id: 'transport:paris-rail-hub', source: 'transport', name: '파리 철도 허브', x: 211, y: 424 },
      { id: 'transport:berlin-rail-hub', source: 'transport', name: '베를린 철도 허브', x: 386, y: 333 },
    ]);
  });
});
