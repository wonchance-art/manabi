// 🗻 가와구치코/후지 도시 정밀맵 — 실 OSM geo(#276, 567×863)를 CityScene 계약에 연결한다.
// 일본 5호(유럽 2차 사이의 오너 승인 라운드): name=nameJa canonical + yomi(일본 도시 문법).
// desc 사실 검증 2026-07-18(츄레이토 20세기 중반·아라쿠라 8세기 전승·세계유산 구성자산 —
// 재고 §F). IP: 로프웨이 운영 브랜드 일반화(天上山公園 정식 공원명)·료칸/산장 상호 무언급·
// 후지큐 하이랜드 POI 제외(브랜드).
// 🚌 첫 등산 버스 TRANSIT: 5합목은 의도적 분리 성분(33타일 — geo 2성분 계약)이라 도보 불가,
//    실제 등산객처럼 가와구치코역에서 버스로 올라간다. 🛶 도선 8번째 = 호수 유람선.
// 🗻 subaru-5th POI = 후지 등산 액트 씬(#275·#277) 진입 게이트. 🎨 tileSkins kawara.

import { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater } from './terrain.js';
import { KAWAGUCHIKO_GEO } from './kawaguchiko.geo.js';
import { KAWAGUCHIKO_DOORS } from '../kawaguchikoDoors.js';

export { CITY_TILE, isCityBlocked, isCityWalkable, isCityWater };

export const COLS = KAWAGUCHIKO_GEO.meta.grid.w;
export const ROWS = KAWAGUCHIKO_GEO.meta.grid.h;
export const ENTRANCE = { ...KAWAGUCHIKO_GEO.entrance };

const KAWAGUCHIKO_DESC_KO = Object.freeze({
  'kawaguchiko-station': '후지급행선의 종점 「河口湖駅」(かわぐちこえき). 산장풍 역사를 나서면 정면으로 후지산이 올려다보여요.',
  'oishi-park': '호수 북안의 꽃길 공원 「大石公園」(おおいしこうえん). 여름 라벤더 너머로 호수와 후지산이 겹치는 구도로 알려져 있어요.',
  'tenjozan-park': '호반에서 오르는 전망 산 「天上山公園」(てんじょうざんこうえん). 카치카치야마 설화의 무대로 전해지는 산 위에서 호수와 후지산을 한눈에 담아요.',
  chureito: '아라쿠라야마 중턱의 오층탑 「忠霊塔」(ちゅうれいとう). 20세기 중반 세워진 위령탑으로 전해지며, 봄이면 벚꽃·탑·후지산이 한 장면에 담기는 자리로 알려져 있어요.',
  'arakura-sengen': '츄레이토로 오르는 참배길의 신사 「新倉富士浅間神社」(あらくらふじせんげんじんじゃ). 8세기 초 창건으로 전해져요.',
  'oshino-hakkai': '후지산 눈 녹은 물이 솟는 여덟 연못 「忍野八海」(おしのはっかい). 바닥이 비치는 맑은 용천으로, 세계유산 후지산의 구성자산으로 알려져 있어요.',
  'kitaguchi-hongu': '요시다 등산로의 기점 신사 「北口本宮冨士浅間神社」(きたぐちほんぐうふじせんげんじんじゃ). 고대 창건 전승의 삼나무 참배길 — 세계유산 구성자산으로 알려져 있어요.',
  'fujiyoshida-honcho': '레트로 간판 상점가 「本町通り」(ほんちょうどおり). 거리 정면에 후지산이 가득 차는 구도로 널리 알려진 길이에요.',
  'lake-kawaguchi': '후지오호(富士五湖)의 하나 「河口湖」(かわぐちこ). 호안선이 가장 긴 호수로 알려져 있고, 유람선이 호수를 돌아요.',
  'funatsu-onsen': '호반의 온천 거리 「船津温泉街」(ふなつおんせんがい). 료칸 창 너머로 호수와 후지산을 바라보며 몸을 데워요.',
  'subaru-5th': '후지 등산의 관문 「富士スバルライン五合目」(ふじすばるらいんごごうめ). 해발 2,300m 부근으로 알려진 요시다 루트의 출발점 — 역에서 등산 버스로 올라와, 여기서 정상을 향해 걸어요.',
});

// 설정 언어 < 현지 언어 중앙 lookup — ko 슬롯 저작, nameJa canonical.
export const KAWAGUCHIKO_COPY = Object.freeze({
  ko: Object.freeze(Object.fromEntries(KAWAGUCHIKO_GEO.pois.map((poi) => [
    poi.id,
    Object.freeze({
      name: poi.nameJa,
      desc: KAWAGUCHIKO_DESC_KO[poi.id] ?? `가와구치코의 대표 장소 「${poi.nameJa}」. 실제 지도 위치를 따라 걸어가 볼 수 있어요.`,
    }),
  ]))),
});

function poiCopy(id, locale = 'ko') {
  return KAWAGUCHIKO_COPY[locale]?.[id] || KAWAGUCHIKO_COPY.ko[id];
}

// 구역 라벨 — webmercator 재투영 계산치.
export const ZONES = [
  { id: 'lake-north', label: '오이시·호반 북안', bounds: [0, 84, 204, 223], labelTile: [102, 154] },
  { id: 'station-onsen', label: '역전·후나츠 온천', bounds: [113, 223, 304, 323], labelTile: [200, 273] },
  { id: 'arakura', label: '아라쿠라·츄레이토', bounds: [304, 230, 420, 323], labelTile: [362, 276] },
  { id: 'fujiyoshida', label: '후지요시다 혼초', bounds: [249, 323, 431, 418], labelTile: [340, 370] },
  { id: 'oshino', label: '오시노', bounds: [431, 446, 567, 557], labelTile: [499, 502] },
  { id: 'fuji-slope', label: '후지 북사면·5합목', bounds: [0, 529, 295, 863], labelTile: [148, 696] },
];

// ja 도어 4종(ja-01~04) tile — 앵커 POI 곁 보행+이격 ≥2 스크립트 검증 배치.
// ja-03 산장 예약 창구는 5합목 분리 성분 내(등산 버스로만 도달 — 성분 소속 실측 확인).
const KAWAGUCHIKO_DOOR_TILES = Object.freeze({
  'ja-01': [166, 259], // 료칸 체크인 — 후나츠 온천가
  'ja-02': [168, 259], // 온천 탈의실 — 후나츠 온천가
  'ja-03': [36, 853],  // 산장 예약 창구 — 5합목
  'ja-04': [177, 284], // 오미야게 가게 — 역전
});

export const CITY_NODES = [
  ...KAWAGUCHIKO_GEO.pois.map((poi) => {
    const copy = poiCopy(poi.id);
    return {
      id: poi.id,
      kind: 'spot',
      name: copy.name,
      nameJa: poi.nameJa,
      yomi: poi.yomi,
      contentLocale: poi.contentLocale,
      facade: 'sign',
      tile: [poi.tile[0], poi.tile[1]],
      facing: 'down',
      noStamp: true,
      desc: copy.desc,
      // 🗻 5합목 = 후지 등산 액트 씬 진입 게이트(액트 씬 3호 — MSM·자갈치 문법).
      ...(poi.id === 'subaru-5th' ? {
        gate: Object.freeze({ type: 'story-scene', scene: 'fuji-climb-scene' }),
      } : {}),
    };
  }),
  // 일본어 문화 도어 4종(ja-01~04 — 첫 n5 본편 세트 #249) — track 명시 라우팅.
  ...KAWAGUCHIKO_DOORS.map((door) => ({
    id: door.id,
    kind: 'spot',
    name: door.nameJa,
    nameJa: door.nameJa,
    contentLocale: 'ja',
    facade: 'sign',
    tile: [...KAWAGUCHIKO_DOOR_TILES[door.id]],
    facing: 'down',
    noStamp: true,
    track: door.track,
    chapter: door.chapter,
    desc: `${door.name} — ${door.lines[0].ja} (${door.lines[0].gloss})`,
  })),
];

export const STATIONS = KAWAGUCHIKO_GEO.stations.map((station) => ({
  id: station.id,
  nameJa: `${station.nameJa}駅`,
  yomi: `${station.yomi}えき`,
  contentLocale: station.contentLocale,
  tile: [station.tile[0], station.tile[1]],
  line: station.line,
}));

// 유람선 선착장(geo transitPoints) + 등산 버스 정류장 2종(5합목 분리 성분 연결 — 실측 배치).
export const TRANSIT_POINTS = [
  ...KAWAGUCHIKO_GEO.transitPoints.map((point) => ({
    id: point.id,
    nameJa: point.nameJa,
    yomi: point.yomi || '',
    contentLocale: point.contentLocale,
    tile: [point.tile[0], point.tile[1]],
  })),
  { id: 'kawaguchiko-bus-stop', nameJa: '河口湖駅バスのりば', yomi: 'かわぐちこえきばすのりば', contentLocale: 'ja', tile: [178, 286] },
  { id: 'subaru-5th-stop', nameJa: '五合目バスのりば', yomi: 'ごごうめばすのりば', contentLocale: 'ja', tile: [38, 853] },
];

// 구간 시간·운행 창은 게임 월드의 결정적 시뮬레이션 값(실시간표 아님).
export const TRANSIT = [
  {
    // 후지급행선 유효 구간 실정차 노선 순(후지큐 하이랜드역은 브랜드 제외 — 통과 처리).
    id: 'kawaguchiko-fujikyuko', nameJa: '富士急行線', mode: 'train', color: 0xc23a30,
    stopIds: ['kawaguchiko', 'fujisan', 'shimoyoshida'],
    segmentMinutes: [8, 3], dwellMinutes: 1,
    serviceWindows: [
      { startMinute: 0, endMinute: 360, headwayMinutes: 40 },
      { startMinute: 360, endMinute: 1380, headwayMinutes: 20 },
    ],
  },
  {
    // 🛶 호수 유람선(도선 문법 8번째) — 후나츠 선착장 ↔ 오이시 방면.
    id: 'kawaguchiko-cruise', nameJa: '河口湖遊覧船', mode: 'ferry', color: 0x2e7d5b,
    stopIds: ['funatsu-pier', 'oishi-landing'],
    segmentMinutes: [12], dwellMinutes: 2,
    serviceWindows: [
      { startMinute: 540, endMinute: 990, headwayMinutes: 40 },
    ],
  },
  {
    // 🚌 첫 등산 버스 — 5합목 분리 성분의 유일한 다리(여름 등산철 감각의 운행 창).
    id: 'kawaguchiko-climb-bus', nameJa: '富士山五合目行きバス', mode: 'bus', color: 0x3a6ea5,
    stopIds: ['kawaguchiko-bus-stop', 'subaru-5th-stop'],
    segmentMinutes: [50], dwellMinutes: 3,
    serviceWindows: [
      { startMinute: 420, endMinute: 1020, headwayMinutes: 60 },
    ],
  },
];

// 🏮 렌더크래프트 — 기존 kind 재사용 배치(보행 판정+이격 ≥2 계산치).
export const PROPS = [
  { kind: 'noren', tile: [369, 348] },    // 혼초 상점가 노렌
  { kind: 'stall', tile: [541, 499] },    // 오시노 명수 노점
  { kind: 'gachapon', tile: [179, 284] }, // 역전 캡슐토이(서브컬처 kind #262)
];

export function buildKawaguchikoGrid() {
  const grid = Uint8Array.from(KAWAGUCHIKO_GEO.terrain);
  for (const [x, y] of KAWAGUCHIKO_GEO.exitTiles) grid[y * COLS + x] = CITY_TILE.EXIT;
  return grid;
}

export const KAWAGUCHIKO = {
  id: 'kawaguchiko', name: '가와구치코', cols: COLS, rows: ROWS, entrance: ENTRANCE,
  roadStyle: 'autotile-v1',
  returnNode: 'kawaguchiko', // 오버월드 APAC 게이트는 Codex-1 후속(기존 fuji 마커 연계 검토)
  zones: ZONES, nodes: CITY_NODES, stations: STATIONS, props: PROPS,
  transit: TRANSIT, transitPoints: TRANSIT_POINTS, railways: KAWAGUCHIKO_GEO.railways,
  // 🎨 R4 — 먹색 기와(료칸·산촌 무드).
  tileSkins: Object.freeze({ building: 'kawara' }),
  CITY_TILE, buildGrid: buildKawaguchikoGrid,
};

export default KAWAGUCHIKO;
