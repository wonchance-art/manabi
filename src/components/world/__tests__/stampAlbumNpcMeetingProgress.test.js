import { describe, expect, it, vi } from 'vitest';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse.js';
import { CITY_DATA } from '../cities/index.js';
import {
  isNpcMeetingCandidate,
  npcMeetingStorageKey,
} from '../npcMeetings.js';
import { stampAlbumNpcMeetingProgress } from '../stampAlbumNpcMeetingProgress.js';

function storageWith(value) {
  return {
    getItem: vi.fn(() => value),
  };
}

function albumNode(id) {
  return STAMP_ALBUM_NODES.find((node) => node.id === id);
}

describe('S13 여행 수첩 — 만난 사람 수집률', () => {
  it('로드된 도시 nodes를 동적 스캔해 프랑스 3도시와 일본 신규 NPC 4종을 포섭한다', () => {
    const storage = storageWith(null);
    expect(CITY_DATA.tokyo.nodes
      .filter(isNpcMeetingCandidate)
      .map(({ id }) => id)).toEqual([
      'tokyo-yamanote-west-cafe',
      'tokyo-central-east-bookstore',
    ]);
    expect(CITY_DATA.osaka.nodes
      .filter(isNpcMeetingCandidate)
      .map(({ id }) => id)).toEqual([
      'osaka-north-hubs-transfer',
      'osaka-castle-east-guide',
    ]);

    const presentations = STAMP_ALBUM_NODES
      .map((node) => stampAlbumNpcMeetingProgress(node, CITY_DATA, storage))
      .filter(Boolean);

    expect(presentations).toEqual([
      { cityId: 'tokyo', got: 0, total: 2, label: '만난 사람 0/2' },
      { cityId: 'osaka', got: 0, total: 2, label: '만난 사람 0/2' },
      { cityId: 'lyon', got: 0, total: 5, label: '만난 사람 0/5' },
      { cityId: 'bordeaux', got: 0, total: 3, label: '만난 사람 0/3' },
      { cityId: 'strasbourg', got: 0, total: 3, label: '만난 사람 0/3' },
    ]);
    expect(storage.getItem.mock.calls.map(([key]) => key)).toEqual([
      npcMeetingStorageKey('tokyo'),
      npcMeetingStorageKey('osaka'),
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
      total: 5,
      label: '만난 사람 2/5',
    });
  });

  it('noStamp·유효 ID/스크립트와 직접 대화/전용 채움 규칙을 만족한 NPC만 분모에 넣는다', () => {
    const node = { gate: { type: 'city', to: 'lyon' } };
    const cityData = {
      lyon: {
        nodes: [
          { id: 'met', kind: 'npc', npc: 'script', noStamp: true },
          {
            id: 'filled',
            kind: 'npc',
            npc: 'filled',
            chapter: 'ot-01-filled',
            noStamp: true,
          },
          {
            id: 'legacy-door',
            kind: 'npc',
            npc: 'shared',
            chapter: 'ot-02-shared',
            noStamp: true,
          },
          { id: 'stamped', kind: 'npc', npc: 'script', noStamp: false },
          { id: 'no-script', kind: 'npc', noStamp: true },
          { id: 'spot', kind: 'spot', noStamp: true },
        ],
      },
    };

    expect(stampAlbumNpcMeetingProgress(
      node,
      cityData,
      storageWith('["met","filled","legacy-door","stamped","no-script","spot"]'),
    )).toEqual({
      cityId: 'lyon',
      got: 2,
      total: 2,
      label: '만난 사람 2/2',
    });
  });

  it('하드코딩되지 않은 미래 도시도 로드된 전용 NPC로 자동 포섭한다', () => {
    const cityId = 'future-city';
    const node = { gate: { type: 'city', to: cityId } };
    const cityData = {
      [cityId]: {
        nodes: [{
          id: 'future-city-guide',
          kind: 'npc',
          npc: 'future-city-guide',
          chapter: 'ot-01-guide',
          noStamp: true,
        }],
      },
    };

    expect(stampAlbumNpcMeetingProgress(node, cityData, storageWith(null))).toEqual({
      cityId,
      got: 0,
      total: 1,
      label: '만난 사람 0/1',
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
        total: 3,
        label: '만난 사람 0/3',
      });
    }
  });

  it('비도시·후보 없는 도시는 저장소를 읽지 않고 기존 카드를 유지한다', () => {
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
