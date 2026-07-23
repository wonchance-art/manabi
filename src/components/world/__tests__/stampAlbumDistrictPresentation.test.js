import { describe, expect, it } from 'vitest';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse.js';
import { CITY_DATA } from '../cities/index.js';
import {
  STAMP_ALBUM_DISTRICT_CITY_IDS,
  stampAlbumDistrictPresentation,
} from '../stampAlbumDistrictPresentation.js';

describe('여행 수첩 — 지구제 도시 상세', () => {
  it('정본 7도시의 resolver 결과를 개방 n 동네와 라벨 목록으로 표시한다', () => {
    const presentations = STAMP_ALBUM_NODES
      .map((node) => stampAlbumDistrictPresentation(node, CITY_DATA))
      .filter(Boolean);

    expect(presentations.map(({ cityId, countLabel, labels }) => ({
      cityId,
      countLabel,
      labels: [...labels],
    }))).toEqual([
      {
        cityId: 'seoul',
        countLabel: '개방 4 동네',
        labels: ['사대문 안', '서남권', '강남·잠실', '한강 북안'],
      },
      {
        cityId: 'busan',
        countLabel: '개방 4 동네',
        labels: ['원도심·항만', '도심 북부', '동부 해안', '남부 해안'],
      },
      {
        cityId: 'cote-dazur',
        countLabel: '개방 4 동네',
        labels: ['서부 리비에라', '니스', '동부 연안', '모나코 일대'],
      },
      {
        cityId: 'leman-riviera',
        countLabel: '개방 4 동네',
        labels: ['로잔·우시', '라보 포도밭', '브베', '몽트뢰·시옹'],
      },
      {
        cityId: 'lyon',
        countLabel: '개방 4 동네',
        labels: ['프레스킬 남부', '구시가·푸르비에르', '테로·크루아루스', '론 강변·파르디외'],
      },
      {
        cityId: 'bordeaux',
        countLabel: '개방 4 동네',
        labels: ['생장역 일대', '역사 지구', '샤르트롱·북강변', '클래식 워크 회랑'],
      },
      {
        cityId: 'strasbourg',
        countLabel: '개방 4 동네',
        labels: ['중앙역 일대', '그랑딜', '유럽 지구', '리버사이드 워크 회랑'],
      },
    ]);
    expect(new Set(presentations.map(({ cityId }) => cityId)))
      .toEqual(new Set(STAMP_ALBUM_DISTRICT_CITY_IDS));
  });

  it('잠금 영역 정보는 개방 동네 수와 라벨에 섞지 않는다', () => {
    const city = {
      id: 'seoul',
      cols: 5,
      rows: 4,
      entrance: { x: 0, y: 0 },
      buildGrid: () => new Uint8Array(20),
      districts: {
        version: 'district-v1',
        open: [
          { id: 'one', label: '첫 동네', tiles: { rects: [[0, 0, 1, 1]] } },
          { id: 'two', label: '둘째 동네', tiles: { rects: [[3, 2, 4, 3]] } },
        ],
        locked: {
          style: 'guidebook',
          line: '아직 준비 중이에요.',
          total: 99,
          areas: ['잠금 하나', '잠금 둘'],
        },
      },
    };
    const node = { gate: { type: 'city', to: 'seoul' } };

    expect(stampAlbumDistrictPresentation(node, { seoul: city })).toEqual({
      cityId: 'seoul',
      openCount: 2,
      countLabel: '개방 2 동네',
      labels: ['첫 동네', '둘째 동네'],
    });
  });

  it('지구제 범위 밖 노드는 상세를 만들거나 도시 grid를 읽지 않는다', () => {
    let builds = 0;
    const cityData = {
      tokyo: {
        buildGrid: () => {
          builds += 1;
          return new Uint8Array();
        },
      },
    };

    expect(stampAlbumDistrictPresentation({ gate: { type: 'city', to: 'tokyo' } }, cityData)).toBeNull();
    expect(stampAlbumDistrictPresentation({ kind: 'landmark' }, cityData)).toBeNull();
    expect(builds).toBe(0);
  });

  it('동일 입력은 동결된 byte-identical presentation을 만든다', () => {
    const node = STAMP_ALBUM_NODES.find(({ id }) => id === 'lyon');
    const first = stampAlbumDistrictPresentation(node, CITY_DATA);
    const second = stampAlbumDistrictPresentation(node, CITY_DATA);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.labels)).toBe(true);
  });
});
