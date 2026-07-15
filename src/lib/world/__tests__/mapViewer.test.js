import { describe, expect, it } from 'vitest';
import { cityMapMarkers, worldMapMarkers } from '../mapViewer.js';

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
});
