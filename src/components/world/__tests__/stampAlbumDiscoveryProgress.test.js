import { describe, expect, it, vi } from 'vitest';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse.js';
import { CITY_DATA } from '../cities/index.js';
import { routeDiscoveryStorageKey } from '../routeDiscoveries.js';
import {
  STAMP_ALBUM_DISCOVERY_CITY_IDS,
  stampAlbumDiscoveryProgress,
} from '../stampAlbumDiscoveryProgress.js';

function storageWith(value) {
  return {
    getItem: vi.fn(() => value),
  };
}

function albumNode(id) {
  return STAMP_ALBUM_NODES.find((node) => node.id === id);
}

describe('여행 수첩 — 주동선 발견 수집률', () => {
  it('mainRoute 발견 정본이 있는 4도시만 발견 n/m을 만든다', () => {
    const storage = storageWith(null);
    const presentations = STAMP_ALBUM_NODES
      .map((node) => stampAlbumDiscoveryProgress(node, CITY_DATA, storage))
      .filter(Boolean);

    expect(presentations).toEqual([
      { cityId: 'tokyo', got: 0, total: 8, label: '발견 0/8' },
      { cityId: 'lyon', got: 0, total: 8, label: '발견 0/8' },
      { cityId: 'bordeaux', got: 0, total: 8, label: '발견 0/8' },
      { cityId: 'strasbourg', got: 0, total: 7, label: '발견 0/7' },
    ]);
    expect(STAMP_ALBUM_DISCOVERY_CITY_IDS).toEqual(['tokyo', 'lyon', 'bordeaux', 'strasbourg']);
    expect(Object.isFrozen(STAMP_ALBUM_DISCOVERY_CITY_IDS)).toBe(true);
    expect(storage.getItem.mock.calls.map(([key]) => key)).toEqual([
      routeDiscoveryStorageKey('tokyo'),
      routeDiscoveryStorageKey('lyon'),
      routeDiscoveryStorageKey('bordeaux'),
      routeDiscoveryStorageKey('strasbourg'),
    ]);
  });

  it('정본 ID와 저장 배열의 교집합만 세고 미지 ID와 다른 도시 ID는 무시한다', () => {
    const storage = storageWith(JSON.stringify([
      'lyon-d1',
      'lyon-d8',
      'lyon-d999',
      'bordeaux-d1',
      7,
      null,
    ]));

    expect(stampAlbumDiscoveryProgress(albumNode('lyon'), CITY_DATA, storage)).toEqual({
      cityId: 'lyon',
      got: 2,
      total: 8,
      label: '발견 2/8',
    });
  });

  it('깨진 JSON과 배열이 아닌 저장 값은 0으로 fail-closed 처리한다', () => {
    for (const value of ['{broken', '{"lyon-d1":true}', 'null']) {
      expect(stampAlbumDiscoveryProgress(
        albumNode('lyon'),
        CITY_DATA,
        storageWith(value),
      )).toEqual({
        cityId: 'lyon',
        got: 0,
        total: 8,
        label: '발견 0/8',
      });
    }
  });

  it('비도시·발견 미정의 도시는 저장소를 읽지 않고 기존 카드를 유지한다', () => {
    const storage = storageWith('["unknown"]');

    expect(stampAlbumDiscoveryProgress(albumNode('seoul'), CITY_DATA, storage)).toBeNull();
    expect(stampAlbumDiscoveryProgress(
      STAMP_ALBUM_NODES.find((node) => node.kind === 'landmark'),
      CITY_DATA,
      storage,
    )).toBeNull();
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('동일 입력은 동결된 byte-identical presentation을 만든다', () => {
    const storage = storageWith('["strasbourg-d1","strasbourg-d7"]');
    const first = stampAlbumDiscoveryProgress(albumNode('strasbourg'), CITY_DATA, storage);
    const second = stampAlbumDiscoveryProgress(albumNode('strasbourg'), CITY_DATA, storage);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
  });
});
