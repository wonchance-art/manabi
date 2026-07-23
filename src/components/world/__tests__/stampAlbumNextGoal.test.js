import { describe, expect, it } from 'vitest';
import {
  stampAlbumNextGoal,
  STAMP_ALBUM_COMPLETE_LINE,
} from '../stampAlbumNextGoal.js';

function district(cityId = 'lyon', openCount = 4) {
  return {
    cityId,
    openCount,
    countLabel: `개방 ${openCount} 동네`,
  };
}

function discovery(got = 0, total = 8, cityId = 'lyon') {
  return {
    cityId,
    got,
    total,
    label: `발견 ${got}/${total}`,
  };
}

function npcMeeting(got = 0, total = 3, cityId = 'lyon') {
  return {
    cityId,
    got,
    total,
    label: `만난 사람 ${got}/${total}`,
  };
}

function stampTitle(remaining = 10) {
  return {
    stampCount: 10 - remaining,
    nextMilestone: {
      count: 10,
      remaining,
      titleKey: 'stamp-10',
    },
    progressLine: `다음 칭호까지 도장 ${remaining}개`,
  };
}

describe('S7 여행 수첩 다음 목표 우선순위', () => {
  it('S13 감사 7도시에서 정적 개방 수를 제외하고 실제 잔여량만 고른다', () => {
    const auditCases = [
      {
        cityId: 'lyon',
        discoveryTotal: 8,
        npcTotal: 3,
        expectedKind: 'npc-meeting',
        expectedLine: '만난 사람 0/3',
      },
      {
        cityId: 'bordeaux',
        discoveryTotal: 8,
        npcTotal: 1,
        expectedKind: 'npc-meeting',
        expectedLine: '만난 사람 0/1',
      },
      {
        cityId: 'strasbourg',
        discoveryTotal: 7,
        npcTotal: 1,
        expectedKind: 'npc-meeting',
        expectedLine: '만난 사람 0/1',
      },
      { cityId: 'seoul', discoveryTotal: null, expectedKind: 'stamp-title', expectedLine: '다음 칭호까지 도장 9개' },
      { cityId: 'busan', discoveryTotal: null, expectedKind: 'stamp-title', expectedLine: '다음 칭호까지 도장 9개' },
      { cityId: 'cote-dazur', discoveryTotal: null, expectedKind: 'stamp-title', expectedLine: '다음 칭호까지 도장 9개' },
      { cityId: 'leman-riviera', discoveryTotal: null, expectedKind: 'stamp-title', expectedLine: '다음 칭호까지 도장 9개' },
    ];

    for (const {
      cityId,
      discoveryTotal,
      npcTotal,
      expectedKind,
      expectedLine,
    } of auditCases) {
      const goal = stampAlbumNextGoal({
        district: district(cityId),
        discovery: discoveryTotal == null
          ? null
          : discovery(0, discoveryTotal, cityId),
        npcMeeting: npcTotal == null
          ? null
          : npcMeeting(0, npcTotal, cityId),
        stampTitle: stampTitle(9),
      });

      expect(goal?.kind, cityId).toBe(expectedKind);
      expect(goal?.line, cityId).toBe(expectedLine);
      expect(goal?.line, cityId).not.toBe('개방 4 동네');
    }
  });

  it('남은 개수가 가장 작은 발견·만남·칭호 후보 하나만 고른다', () => {
    expect(stampAlbumNextGoal({
      district: district(),
      discovery: discovery(0, 8),
      npcMeeting: npcMeeting(0, 3),
      stampTitle: stampTitle(9),
    })).toEqual({
      kind: 'npc-meeting',
      cityId: 'lyon',
      remaining: 3,
      line: '만난 사람 0/3',
    });

    expect(stampAlbumNextGoal({
      district: district(),
      discovery: discovery(6, 8),
      npcMeeting: npcMeeting(0, 3),
      stampTitle: stampTitle(9),
    })).toEqual({
      kind: 'discovery',
      cityId: 'lyon',
      remaining: 2,
      line: '발견 6/8',
    });

    expect(stampAlbumNextGoal({
      district: district(),
      discovery: discovery(0, 8),
      npcMeeting: npcMeeting(0, 3),
      stampTitle: stampTitle(1),
    })).toEqual({
      kind: 'stamp-title',
      cityId: null,
      remaining: 1,
      line: '다음 칭호까지 도장 1개',
    });
  });

  it('동률은 발견 → 만남 → 칭호 순으로 고정하고 달성한 후보는 제외한다', () => {
    expect(stampAlbumNextGoal({
      district: district(),
      discovery: discovery(4, 8),
      npcMeeting: npcMeeting(0, 4),
      stampTitle: stampTitle(4),
    })?.kind).toBe('discovery');

    expect(stampAlbumNextGoal({
      discovery: discovery(8, 8),
      npcMeeting: npcMeeting(0, 4),
      stampTitle: stampTitle(4),
    })?.kind).toBe('npc-meeting');

    expect(stampAlbumNextGoal({
      discovery: discovery(8, 8),
      npcMeeting: npcMeeting(4, 4),
      stampTitle: stampTitle(4),
    })?.kind).toBe('stamp-title');
  });

  it('여권과 현재 도시 발견·만남을 전부 달성하면 완료 카피만 반환한다', () => {
    const completedTitle = {
      stampCount: 85,
      nextMilestone: null,
      progressLine: '모든 여행 칭호를 모았어요.',
    };

    expect(stampAlbumNextGoal({
      district: district(),
      discovery: discovery(8, 8),
      npcMeeting: npcMeeting(3, 3),
      stampTitle: completedTitle,
    })).toEqual({
      kind: 'complete',
      cityId: null,
      remaining: 0,
      line: STAMP_ALBUM_COMPLETE_LINE,
    });
    expect(STAMP_ALBUM_COMPLETE_LINE).toBe('여권이 가득 찼어요');

    expect(stampAlbumNextGoal({
      district: district(),
      discovery: discovery(7, 8),
      npcMeeting: npcMeeting(3, 3),
      stampTitle: completedTitle,
    })?.kind).toBe('discovery');

    expect(stampAlbumNextGoal({
      district: district(),
      discovery: discovery(8, 8),
      npcMeeting: npcMeeting(2, 3),
      stampTitle: completedTitle,
    })?.kind).toBe('npc-meeting');
  });

  it('유효한 후보가 없으면 표기를 만들지 않고 결과는 결정적·동결한다', () => {
    expect(stampAlbumNextGoal()).toBeNull();
    expect(stampAlbumNextGoal({
      district: district(),
    })).toBeNull();
    expect(stampAlbumNextGoal({
      discovery: { got: 9, total: 8, label: '발견 9/8' },
      npcMeeting: { got: -1, total: 3, label: '만난 사람 -1/3' },
      stampTitle: { nextMilestone: { remaining: 0 }, progressLine: '' },
    })).toBeNull();

    const first = stampAlbumNextGoal({
      district: district(),
      discovery: discovery(6, 8),
      npcMeeting: npcMeeting(0, 3),
      stampTitle: stampTitle(9),
    });
    const second = stampAlbumNextGoal({
      district: district(),
      discovery: discovery(6, 8),
      npcMeeting: npcMeeting(0, 3),
      stampTitle: stampTitle(9),
    });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
  });
});
