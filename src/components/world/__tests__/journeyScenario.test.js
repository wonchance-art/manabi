import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  claimDiscoveryMilestoneReward,
} from '../../../lib/world/discoveryMilestones.js';
import {
  GUEST_STAMPS_STORAGE_KEY,
  collectGuestStamp,
  loadGuestStamps,
} from '../../../lib/world/stamps.js';
import {
  WORLD_TITLES_STORAGE_KEY,
  claimStampMilestoneRewards,
} from '../../../lib/world/stampMilestones.js';
import { STAMP_ALBUM_NODES } from '../../../lib/world/stampUniverse.js';
import bordeaux from '../cities/bordeaux.js';
import kyoto from '../cities/kyoto.js';
import lyon from '../cities/lyon.js';
import osaka from '../cities/osaka.js';
import tokyo from '../cities/tokyo.js';
import {
  isNpcMeetingCandidate,
  loadNpcMeetingIds,
  npcMeetingStorageKey,
  recordNpcMeeting,
} from '../npcMeetings.js';
import {
  routeDiscoveryStorageKey,
  saveRouteDiscoveryIds,
} from '../routeDiscoveries.js';

const albumHooks = vi.hoisted(() => ({
  activeTabId: 'national',
  callIndex: 0,
  detailCities: {},
}));

// StampAlbum의 상세 도시는 클라이언트 effect에서 lazy-load된다. Node 렌더에서도 같은
// 최종 표면을 검사할 수 있도록 effect 완료 뒤의 세 state만 주입하고 제품 계산은 그대로 둔다.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useEffect: () => {},
    useRef: (initialValue) => ({ current: initialValue }),
    useState: (initialValue) => {
      const index = albumHooks.callIndex;
      albumHooks.callIndex += 1;
      if (index === 0) return [{}, () => {}];
      if (index === 1) return [albumHooks.activeTabId, () => {}];
      if (index === 2) return [albumHooks.detailCities, () => {}];
      return [initialValue, () => {}];
    },
  };
});

vi.mock('../QuestReview', () => ({
  GBC: {
    creamHi: '#fffaf0',
    creamShade: '#e4d5a6',
    ink: '#2a2118',
    inkSoft: '#5a4b38',
    border: '#2a2118',
    brown: '#8a5a2b',
    green: '#5f9a46',
    font: 'monospace',
    shadow: '4px 4px 0 rgba(42,33,24,0.35)',
  },
  gbcPanel: {},
  gbcButtonPrimary: {},
}));

import StampAlbum from '../StampAlbum.jsx';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    values,
  };
}

function stampPlan(requiredId, count) {
  return [
    requiredId,
    ...STAMP_ALBUM_NODES
      .map(({ id }) => id)
      .filter((id) => id !== requiredId),
  ].slice(0, count);
}

function collectGuestStamps(storage, ids) {
  for (const id of ids) expect(collectGuestStamp(id, storage)).toBe(true);
  return new Set(loadGuestStamps(storage));
}

function renderAlbum(tabId, stamps) {
  albumHooks.activeTabId = tabId;
  albumHooks.callIndex = 0;
  albumHooks.detailCities = {
    bordeaux,
    kyoto,
    lyon,
    osaka,
    tokyo,
  };
  return renderToStaticMarkup(createElement(StampAlbum, {
    devGuest: true,
    stamps,
    onClose: () => {},
  }));
}

function visibleText(markup) {
  return markup
    .replaceAll('<!-- -->', '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nextGoalLine(markup, cityName) {
  const escapedName = cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markup.match(
    new RegExp(`aria-label="${escapedName} 다음 목표"[^>]*>([^<]+)</span>`),
  );
  return match?.[1] ?? null;
}

function titleKeys(storage) {
  return JSON.parse(storage.getItem(WORLD_TITLES_STORAGE_KEY) ?? '[]');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('S17 한 게스트의 수집→발견→칭호→만남→수첩 여정', () => {
  it('리옹 8/8 완집과 NPC 2명 만남을 순차 반영해 StampAlbum 표면을 단계마다 바꾼다', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const plannedStamps = stampPlan('lyon', 10);

    let stamps = collectGuestStamps(storage, plannedStamps.slice(0, 9));
    let markup = renderAlbum('emea', stamps);
    let text = visibleText(markup);
    expect(text).toContain('9 / 85');
    expect(text).toContain('유럽·지중해·중동 1/11');
    expect(text).toContain('프레스킬 남부');
    expect(text).toContain('론 강변·파르디외');
    expect(nextGoalLine(markup, '리옹')).toBe('다음 칭호까지 도장 1개');

    stamps = collectGuestStamps(storage, [plannedStamps[9]]);
    expect(claimStampMilestoneRewards(stamps, storage)).toMatchObject({
      stampCount: 10,
      unlocked: ['stamp-10'],
    });
    markup = renderAlbum('emea', stamps);
    expect(visibleText(markup)).toContain('10 / 85');
    expect(nextGoalLine(markup, '리옹')).toBe('발견 0/8');

    const discoveryIds = lyon.mainRoute.discoveries.map(({ id }) => id);
    const discovered = new Set(discoveryIds.slice(0, 7));
    expect(saveRouteDiscoveryIds('lyon', discovered, storage)).toBe(true);
    markup = renderAlbum('emea', stamps);
    expect(nextGoalLine(markup, '리옹')).toBe('발견 7/8');

    discovered.add(discoveryIds[7]);
    expect(saveRouteDiscoveryIds('lyon', discovered, storage)).toBe(true);
    expect(claimDiscoveryMilestoneReward({
      cityId: 'lyon',
      discoveries: lyon.mainRoute.discoveries,
      discoveredIds: discovered,
      storage,
    })).toMatchObject({
      discoveredCount: 8,
      totalCount: 8,
      complete: true,
      unlocked: ['discovery-lyon'],
    });
    expect(titleKeys(storage)).toEqual(['stamp-10', 'discovery-lyon']);
    markup = renderAlbum('emea', stamps);
    expect(nextGoalLine(markup, '리옹')).toBe('만난 사람 0/12');

    const meetingNodes = lyon.nodes.filter(isNpcMeetingCandidate);
    expect(meetingNodes.map(({ id }) => id)).toEqual([
      'lyon-presquile-confluence-cafe',
      'lyon-vieux-lyon-fourviere-traboule',
      'lyon-terreaux-croix-rousse-marche',
      'lyon-rhone-part-dieu-marche-1',
      'lyon-rhone-part-dieu-marche-2',
      'lyon-presquile-postoffice',
      'lyon-fourviere-pharmacy',
      'lyon-croix-rousse-fleur',
      'lyon-croix-rousse-crepe',
      'lyon-rhone-fisherman',
      'lyon-part-dieu-bus-announcer',
      'lyon-terreaux-park-keeper',
    ]);
    expect(recordNpcMeeting({ cityId: 'lyon', node: meetingNodes[0], storage })).toBe(true);
    markup = renderAlbum('emea', stamps);
    expect(nextGoalLine(markup, '리옹')).toBe('만난 사람 1/12');

    expect(recordNpcMeeting({ cityId: 'lyon', node: meetingNodes[1], storage })).toBe(true);
    expect(loadNpcMeetingIds('lyon', storage)).toEqual(new Set(
      meetingNodes.slice(0, 2).map(({ id }) => id),
    ));
    markup = renderAlbum('emea', stamps);
    expect(nextGoalLine(markup, '리옹')).toBe('만난 사람 2/12');
  });

  it('도쿄의 일본 지구와 동적 NPC 2명 만남을 같은 수첩 시나리오로 잇는다', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const stamps = collectGuestStamps(storage, stampPlan('tokyo', 10));
    expect(claimStampMilestoneRewards(stamps, storage).unlocked).toEqual(['stamp-10']);

    let markup = renderAlbum('national', stamps);
    let text = visibleText(markup);
    expect(text).toContain('도쿄');
    expect(text).toContain('야마노테·서부');
    expect(text).toContain('중심·동부');
    expect(text).toContain('남부·항만');
    expect(text).toContain('하네다');
    expect(nextGoalLine(markup, '도쿄')).toBe('만난 사람 0/2');

    const meetingNodes = tokyo.nodes.filter(isNpcMeetingCandidate);
    expect(meetingNodes.map(({ id }) => id)).toEqual([
      'tokyo-yamanote-west-cafe',
      'tokyo-central-east-bookstore',
    ]);
    expect(recordNpcMeeting({ cityId: 'tokyo', node: meetingNodes[0], storage })).toBe(true);
    markup = renderAlbum('national', stamps);
    expect(nextGoalLine(markup, '도쿄')).toBe('만난 사람 1/2');

    expect(recordNpcMeeting({ cityId: 'tokyo', node: meetingNodes[1], storage })).toBe(true);
    markup = renderAlbum('national', stamps);
    expect(nextGoalLine(markup, '도쿄')).toBe('발견 0/8');
  });

  it('깨진 발견 JSON은 빈 진척으로 닫고 수첩 렌더를 유지한다', () => {
    const lyonMeetings = lyon.nodes.filter(isNpcMeetingCandidate).map(({ id }) => id);
    const storage = memoryStorage({
      [GUEST_STAMPS_STORAGE_KEY]: '["lyon"]',
      [routeDiscoveryStorageKey('lyon')]: '{broken',
      [npcMeetingStorageKey('lyon')]: JSON.stringify(lyonMeetings),
      [WORLD_TITLES_STORAGE_KEY]: '{broken',
    });
    vi.stubGlobal('localStorage', storage);

    const markup = renderAlbum('emea', new Set(loadGuestStamps(storage)));
    expect(visibleText(markup)).toContain('1 / 85');
    expect(nextGoalLine(markup, '리옹')).toBe('발견 0/8');
  });

  it('게스트·발견·만남의 유령 ID가 분자나 스탬프 수를 부풀리지 않는다', () => {
    const discoveryIds = lyon.mainRoute.discoveries.map(({ id }) => id);
    const lyonMeetings = lyon.nodes.filter(isNpcMeetingCandidate).map(({ id }) => id);
    const storage = memoryStorage({
      [GUEST_STAMPS_STORAGE_KEY]: '["lyon","ghost-city","lyon"]',
      [routeDiscoveryStorageKey('lyon')]: JSON.stringify([
        ...discoveryIds.slice(0, 7),
        'lyon-d-ghost',
      ]),
      [npcMeetingStorageKey('lyon')]: JSON.stringify([
        ...lyonMeetings,
        'lyon-npc-ghost',
      ]),
    });
    vi.stubGlobal('localStorage', storage);

    const markup = renderAlbum('emea', new Set(loadGuestStamps(storage)));
    expect(visibleText(markup)).toContain('1 / 85');
    expect(nextGoalLine(markup, '리옹')).toBe('발견 7/8');
  });
});

describe('S20 보르도 채움 라운드 2 여정', () => {
  it('스탬프·도어 앞 NPC·발견을 이어 수첩 지구와 다음 목표를 갱신한다', () => {
    const storage = memoryStorage({
      [npcMeetingStorageKey('bordeaux')]: JSON.stringify(['bordeaux-gare-accueil']),
    });
    vi.stubGlobal('localStorage', storage);
    const stamps = collectGuestStamps(storage, stampPlan('bordeaux', 4));

    let markup = renderAlbum('emea', stamps);
    const text = visibleText(markup);
    expect(text).toContain('4 / 85');
    expect(text).toContain('유럽·지중해·중동 1/11');
    expect(text).toContain('보르도');
    expect(text).toContain('생장역 일대');
    expect(text).toContain('역사 지구');
    expect(text).toContain('샤르트롱·북강변');
    expect(text).toContain('클래식 워크 회랑');
    expect(nextGoalLine(markup, '보르도')).toBe('만난 사람 1/3');

    const meetingNodes = bordeaux.nodes.filter(isNpcMeetingCandidate);
    expect(meetingNodes.map(({ id }) => id)).toEqual([
      'bordeaux-gare-accueil',
      'bordeaux-centre-historique-patisserie',
      'bordeaux-nord-rive-antiquaire',
    ]);
    expect([
      [meetingNodes[1].tile, bordeaux.nodes.find(({ id }) => id === 'fr-21').tile],
      [meetingNodes[2].tile, bordeaux.nodes.find(({ id }) => id === 'fr-22').tile],
    ]).toEqual([
      [[268, 225], [268, 226]],
      [[269, 147], [269, 148]],
    ]);

    expect(recordNpcMeeting({
      cityId: 'bordeaux',
      node: meetingNodes[1],
      storage,
    })).toBe(true);
    markup = renderAlbum('emea', stamps);
    expect(nextGoalLine(markup, '보르도')).toBe('만난 사람 2/3');

    expect(recordNpcMeeting({
      cityId: 'bordeaux',
      node: meetingNodes[2],
      storage,
    })).toBe(true);
    expect(loadNpcMeetingIds('bordeaux', storage)).toEqual(new Set(
      meetingNodes.map(({ id }) => id),
    ));
    markup = renderAlbum('emea', stamps);
    expect(nextGoalLine(markup, '보르도')).toBe('다음 칭호까지 도장 6개');

    const discovered = new Set(
      bordeaux.mainRoute.discoveries.slice(0, 3).map(({ id }) => id),
    );
    expect(saveRouteDiscoveryIds('bordeaux', discovered, storage)).toBe(true);
    markup = renderAlbum('emea', stamps);
    expect(nextGoalLine(markup, '보르도')).toBe('발견 3/8');
  });
});

describe('S25 일본 코스 트랙 도시 여정', () => {
  it('오사카 스탬프 10개부터 NPC 2명과 발견 3건까지 다음 목표를 전환한다', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const stamps = collectGuestStamps(storage, stampPlan('osaka', 10));
    expect(claimStampMilestoneRewards(stamps, storage).unlocked).toEqual(['stamp-10']);

    let markup = renderAlbum('national', stamps);
    expect(visibleText(markup)).toContain('10 / 85');
    expect(nextGoalLine(markup, '오사카')).toBe('만난 사람 0/2');

    const meetingNodes = osaka.nodes.filter(isNpcMeetingCandidate);
    expect(meetingNodes.map(({ id }) => id)).toEqual([
      'osaka-north-hubs-transfer',
      'osaka-castle-east-guide',
    ]);
    expect(recordNpcMeeting({
      cityId: 'osaka',
      node: meetingNodes[0],
      storage,
    })).toBe(true);
    markup = renderAlbum('national', stamps);
    expect(nextGoalLine(markup, '오사카')).toBe('만난 사람 1/2');

    expect(recordNpcMeeting({
      cityId: 'osaka',
      node: meetingNodes[1],
      storage,
    })).toBe(true);
    expect(loadNpcMeetingIds('osaka', storage)).toEqual(new Set(
      meetingNodes.map(({ id }) => id),
    ));
    markup = renderAlbum('national', stamps);
    expect(nextGoalLine(markup, '오사카')).toBe('발견 0/8');

    const discovered = new Set(
      osaka.mainRoute.discoveries.slice(0, 3).map(({ id }) => id),
    );
    expect(saveRouteDiscoveryIds('osaka', discovered, storage)).toBe(true);
    markup = renderAlbum('national', stamps);
    expect(visibleText(markup)).toContain('발견 3/8');
    expect(nextGoalLine(markup, '오사카')).toBe('발견 3/8');
  });

  it('교토 발견 8/8 칭호를 한 번만 지급하고 다음 목표를 전환한다', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const stamps = collectGuestStamps(storage, stampPlan('kyoto', 10));
    expect(claimStampMilestoneRewards(stamps, storage).unlocked).toEqual(['stamp-10']);

    let markup = renderAlbum('national', stamps);
    expect(nextGoalLine(markup, '교토')).toBe('발견 0/8');

    const discovered = new Set(kyoto.mainRoute.discoveries.map(({ id }) => id));
    expect(saveRouteDiscoveryIds('kyoto', discovered, storage)).toBe(true);
    expect(claimDiscoveryMilestoneReward({
      cityId: 'kyoto',
      discoveries: kyoto.mainRoute.discoveries,
      discoveredIds: discovered,
      storage,
    })).toMatchObject({
      discoveredCount: 8,
      totalCount: 8,
      complete: true,
      unlocked: ['discovery-kyoto'],
    });
    expect(claimDiscoveryMilestoneReward({
      cityId: 'kyoto',
      discoveries: kyoto.mainRoute.discoveries,
      discoveredIds: discovered,
      storage,
    })).toMatchObject({
      complete: true,
      unlocked: [],
    });
    expect(titleKeys(storage)).toEqual(['stamp-10', 'discovery-kyoto']);

    markup = renderAlbum('national', stamps);
    expect(nextGoalLine(markup, '교토')).toBe('다음 칭호까지 도장 20개');
  });
});
