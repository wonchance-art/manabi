import { describe, expect, it } from 'vitest';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse.js';
import { CITY_DATA } from '../cities/index.js';
import { stampAlbumDiscoveryProgress } from '../stampAlbumDiscoveryProgress.js';
import { stampAlbumDistrictPresentation } from '../stampAlbumDistrictPresentation.js';
import { stampAlbumNextGoal } from '../stampAlbumNextGoal.js';
import { stampAlbumNpcMeetingProgress } from '../stampAlbumNpcMeetingProgress.js';
import { stampTitlePresentation } from '../stampTitlePresentation.js';

const EMPTY_STORAGE = Object.freeze({ getItem: () => null });

const DISTRICT_AUDIT_CASES = Object.freeze([
  {
    nodeId: 'seoul',
    cityId: 'seoul',
    labels: ['사대문 안', '서남권', '강남·잠실', '한강 북안'],
    nextGoal: { kind: 'stamp-title', line: '다음 칭호까지 도장 9개' },
  },
  {
    nodeId: 'busan',
    cityId: 'busan',
    labels: ['원도심·항만', '도심 북부', '동부 해안', '남부 해안'],
    nextGoal: { kind: 'stamp-title', line: '다음 칭호까지 도장 9개' },
  },
  {
    nodeId: 'nice',
    cityId: 'cote-dazur',
    labels: ['서부 리비에라', '니스', '동부 연안', '모나코 일대'],
    nextGoal: { kind: 'stamp-title', line: '다음 칭호까지 도장 9개' },
  },
  {
    nodeId: 'leman-riviera',
    cityId: 'leman-riviera',
    labels: ['로잔·우시', '라보 포도밭', '브베', '몽트뢰·시옹'],
    nextGoal: { kind: 'stamp-title', line: '다음 칭호까지 도장 9개' },
  },
  {
    nodeId: 'lyon',
    cityId: 'lyon',
    labels: ['프레스킬 남부', '구시가·푸르비에르', '테로·크루아루스', '론 강변·파르디외'],
    nextGoal: { kind: 'npc-meeting', line: '만난 사람 0/3' },
  },
  {
    nodeId: 'bordeaux',
    cityId: 'bordeaux',
    labels: ['생장역 일대', '역사 지구', '샤르트롱·북강변', '클래식 워크 회랑'],
    nextGoal: { kind: 'npc-meeting', line: '만난 사람 0/1' },
  },
  {
    nodeId: 'strasbourg',
    cityId: 'strasbourg',
    labels: ['중앙역 일대', '그랑딜', '유럽 지구', '리버사이드 워크 회랑'],
    nextGoal: { kind: 'npc-meeting', line: '만난 사람 0/1' },
  },
  {
    nodeId: 'tokyo',
    cityId: 'tokyo',
    labels: ['야마노테·서부', '중심·동부', '남부·항만', '하네다'],
    nextGoal: { kind: 'stamp-title', line: '다음 칭호까지 도장 9개' },
  },
  {
    nodeId: 'osaka',
    cityId: 'osaka',
    labels: ['북부·허브', '성곽·동부', '난바·텐노지', '항만'],
    nextGoal: { kind: 'stamp-title', line: '다음 칭호까지 도장 9개' },
  },
  {
    nodeId: 'fukuoka',
    cityId: 'fukuoka',
    labels: ['하카타항', '텐진·오호리', '나카스·하카타', '모모치'],
    nextGoal: { kind: 'stamp-title', line: '다음 칭호까지 도장 9개' },
  },
  {
    nodeId: 'kyoto',
    cityId: 'kyoto',
    labels: ['아라시야마·산인', '황궁·니조', '히가시야마·중심', '역·후시미'],
    nextGoal: { kind: 'stamp-title', line: '다음 칭호까지 도장 9개' },
  },
]);

describe('여행 수첩 — 지구제 도시 상세', () => {
  it('S12 감사 11도시의 지구 라벨과 다음 목표를 정본 payload에서 동적으로 표시한다', () => {
    const presentations = STAMP_ALBUM_NODES
      .map((node) => stampAlbumDistrictPresentation(node, CITY_DATA))
      .filter(Boolean);
    const presentationByCityId = new Map(
      presentations.map((presentation) => [presentation.cityId, presentation]),
    );

    expect(DISTRICT_AUDIT_CASES.map(({
      nodeId,
      cityId,
    }) => {
      const node = STAMP_ALBUM_NODES.find(({ id }) => id === nodeId);
      const district = presentationByCityId.get(cityId);
      const goal = stampAlbumNextGoal({
        district,
        discovery: stampAlbumDiscoveryProgress(node, CITY_DATA, EMPTY_STORAGE),
        npcMeeting: stampAlbumNpcMeetingProgress(node, CITY_DATA, EMPTY_STORAGE),
        stampTitle: stampTitlePresentation(new Set([nodeId]), EMPTY_STORAGE),
      });

      return {
        cityId,
        countLabel: district?.countLabel,
        labels: district ? [...district.labels] : null,
        nextGoal: goal ? { kind: goal.kind, line: goal.line } : null,
      };
    })).toEqual(DISTRICT_AUDIT_CASES.map(({
      cityId,
      labels,
      nextGoal,
    }) => ({
      cityId,
      countLabel: '개방 4 동네',
      labels,
      nextGoal,
    })));

    const districtCityIds = Object.values(CITY_DATA)
      .filter((city) => city.districts != null)
      .map((city) => city.id)
      .sort();
    expect([...presentationByCityId.keys()].sort()).toEqual(districtCityIds);
    expect(districtCityIds).toEqual(
      DISTRICT_AUDIT_CASES.map(({ cityId }) => cityId).sort(),
    );
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

  it('districts 미정의 도시와 비도시 노드는 상세를 만들거나 grid를 읽지 않는다', () => {
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
