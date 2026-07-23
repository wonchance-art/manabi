import { describe, expect, it, vi } from 'vitest';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse.js';
import { CITY_DATA } from '../cities/index.js';
import { npcMeetingStorageKey } from '../npcMeetings.js';
import {
  STAMP_ALBUM_NPC_MEETING_CITY_IDS,
  stampAlbumNpcMeetingProgress,
} from '../stampAlbumNpcMeetingProgress.js';

function storageWith(value) {
  return {
    getItem: vi.fn(() => value),
  };
}

function albumNode(id) {
  return STAMP_ALBUM_NODES.find((node) => node.id === id);
}

describe('S13 여행 수첩 — 만난 사람 수집률', () => {
  it('대화 가능한 NPC가 있는 정본 3도시만 만난 사람 n/m을 만든다', () => {
    const storage = storageWith(null);
    const presentations = STAMP_ALBUM_NODES
      .map((node) => stampAlbumNpcMeetingProgress(node, CITY_DATA, storage))
      .filter(Boolean);

    expect(presentations).toEqual([
      { cityId: 'lyon', got: 0, total: 3, label: '만난 사람 0/3' },
      { cityId: 'bordeaux', got: 0, total: 1, label: '만난 사람 0/1' },
      { cityId: 'strasbourg', got: 0, total: 1, label: '만난 사람 0/1' },
    ]);
    expect(STAMP_ALBUM_NPC_MEETING_CITY_IDS)
      .toEqual(['lyon', 'bordeaux', 'strasbourg']);
    expect(Object.isFrozen(STAMP_ALBUM_NPC_MEETING_CITY_IDS)).toBe(true);
    expect(storage.getItem.mock.calls.map(([key]) => key)).toEqual([
      npcMeetingStorageKey('lyon'),
      npcMeetingStorageKey('bordeaux'),
      npcMeetingStorageKey('strasbourg'),
    ]);
  });

  it('도시 nodes 정본과 저장 배열의 교집합만 세고 유령·타 도시 ID를 무시한다', () => {
    const storage = storageWith(JSON.stringify([
      'lyon-presquile-confluence-cafe',
      'lyon-vieux-lyon-fourviere-traboule',
      'lyon-ghost',
      'bordeaux-gare-accueil',
      7,
      null,
    ]));

    expect(stampAlbumNpcMeetingProgress(albumNode('lyon'), CITY_DATA, storage)).toEqual({
      cityId: 'lyon',
      got: 2,
      total: 3,
      label: '만난 사람 2/3',
    });
  });

  it('스탬프 가능한 NPC와 대화 스크립트 없는 노드는 noStamp 만남 분모에 섞지 않는다', () => {
    const node = { gate: { type: 'city', to: 'lyon' } };
    const cityData = {
      lyon: {
        nodes: [
          { id: 'met', kind: 'npc', npc: 'script', noStamp: true },
          { id: 'stamped', kind: 'npc', npc: 'script', noStamp: false },
          { id: 'no-script', kind: 'npc', noStamp: true },
          { id: 'spot', kind: 'spot', noStamp: true },
        ],
      },
    };

    expect(stampAlbumNpcMeetingProgress(
      node,
      cityData,
      storageWith('["met","stamped","no-script","spot"]'),
    )).toEqual({
      cityId: 'lyon',
      got: 1,
      total: 1,
      label: '만난 사람 1/1',
    });
  });

  it('깨진 JSON과 배열이 아닌 저장 값은 0으로 fail-closed 처리한다', () => {
    for (const value of ['{broken', '{"npc":true}', 'null']) {
      expect(stampAlbumNpcMeetingProgress(
        albumNode('bordeaux'),
        CITY_DATA,
        storageWith(value),
      )).toEqual({
        cityId: 'bordeaux',
        got: 0,
        total: 1,
        label: '만난 사람 0/1',
      });
    }
  });

  it('비도시·대상 밖 도시는 저장소를 읽지 않고 기존 카드를 유지한다', () => {
    const storage = storageWith('["unknown"]');

    expect(stampAlbumNpcMeetingProgress(albumNode('seoul'), CITY_DATA, storage)).toBeNull();
    expect(stampAlbumNpcMeetingProgress(
      STAMP_ALBUM_NODES.find((node) => node.kind === 'landmark'),
      CITY_DATA,
      storage,
    )).toBeNull();
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('동일 입력은 동결된 byte-identical presentation을 만든다', () => {
    const storage = storageWith('["strasbourg-gare-bretzel"]');
    const first = stampAlbumNpcMeetingProgress(
      albumNode('strasbourg'),
      CITY_DATA,
      storage,
    );
    const second = stampAlbumNpcMeetingProgress(
      albumNode('strasbourg'),
      CITY_DATA,
      storage,
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
  });
});
