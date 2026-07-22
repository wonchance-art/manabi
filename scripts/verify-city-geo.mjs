// 한국(+향후 유럽) 도시 geo 인수 게이트 — Claude(검수)와 Codex(구현)가 공유하는 단일 기준.
//
// 원칙: 모든 게이트는 **최종 terrain(플레이어가 보는 그리드)** 기준이다. 스냅샷 마스크가
// 통과해도 최종 지형에서 도로가 하천을 덮으면 FAIL — 실제로 이 괴리가 부산 온천천에서
// 발생했다(#151). 핸드오프(CODEX_DONE) 전 이 스크립트가 green이어야 한다.
//
// 사용: node scripts/verify-city-geo.mjs --city busan [--file <geo.js 경로>]
// 종료코드: 게이트 전부 통과 0, 하나라도 FAIL 1. report 항목은 판정에 미포함(참고 수치).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EARTH = 6378137;
const DEG = Math.PI / 180;
const T = { ROAD: 0, SIDEWALK: 1, CROSSWALK: 2, PARK: 4, BRIDGE: 5, WATER: 8, BUILDING: 9, ISLAND: 10, RIVER: 11, MOUNTAIN: 13 };
const isWaterTile = (v) => v === T.WATER || v === T.RIVER;

// ── 도시별 게이트 정의 ─────────────────────────────────────────────────────
// riverSections: 단면 스캔 — sumMinM(수면 합계)·runMinM(최대 연속) 둘 다 충족.
// streamCourses: 유로 보간 샘플 ±windowTiles 내 수면 존재율 ≥ presenceMin.
// downtown: 도심 4km(200×200타일) 가시도로 비율 — report 전용(버퍼 정책 변경에 민감).
const CITY_GATES = {
  busan: {
    file: 'src/components/world/cities/busan.geo.js',
    snapshot: 'scripts/data/busan-osm-v21.json',
    buildingPct: [9, 11],
    greenMinPct: 20,
    poiMaxDevTiles: 2.5,
    downtown: { label: '서면', lon: 129.0593, lat: 35.1579 },
    riverSections: [
      { name: '낙동강(을숙도 단면)', lat: 35.10, lonRange: [128.90, 129.00], sumMinM: 1200, runMinM: 600 },
    ],
    streamCourses: [
      // 온천천은 OSM relation 6994989 지표 수면 기준 2분절 — 세병교 35.2030~35.2083 구간은
      // 실제 복개(way 577576476: tunnel=culvert·layer=-1)라 표본에서 제외(계약과 일치,
      // Codex-1 #151 재반박 수용). 하류 pin은 relation 실굴곡(수영강 합류 방면 남동 커브).
      {
        name: '온천천(상류·복개 이북)', presenceMin: 0.8, windowTiles: 4,
        pts: [[129.0893, 35.2308], [129.0884, 35.2237], [129.0869, 35.2208], [129.0849, 35.2179], [129.0817, 35.2151], [129.0805, 35.2136], [129.0787, 35.2107], [129.0786, 35.2085]],
      },
      {
        name: '온천천(하류·복개 이남)', presenceMin: 0.8, windowTiles: 4,
        pts: [[129.0785, 35.2028], [129.0792, 35.2007], [129.0802, 35.1993], [129.0836, 35.1960], [129.0851, 35.1950], [129.0876, 35.1940], [129.0908, 35.1935], [129.0943, 35.1930], [129.0985, 35.1920], [129.1029, 35.1910], [129.1073, 35.1906]],
      },
    ],
    reportCourses: [
      { name: '수영강(참고)', windowTiles: 3, pts: [[129.1150, 35.1900], [129.1180, 35.1730], [129.1230, 35.1640]] },
      { name: '동천(참고)', windowTiles: 3, pts: [[129.0590, 35.1560], [129.0550, 35.1450], [129.0480, 35.1330]] },
    ],
    // 오너 지시(2026-07-16): KR 도시에서 BRIDGE(5) 잔존 0 — 진짜 교량은 차도(ROAD)로,
    // 강심 고립·애매 조각은 수면/도로 중 자연스러운 쪽으로 흡수. 교량 회랑 생존은 pin으로 검증.
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      { name: '광안대교', lon: 129.1150, lat: 35.1470, windowTiles: 5 },
    ],
  },
  seoul: {
    file: 'src/components/world/cities/seoul.geo.js',
    snapshot: 'scripts/data/seoul-osm-v21.json',
    buildingPct: [9, 11],
    greenMinPct: 20,
    poiMaxDevTiles: 2.5,
    downtown: { label: '시청', lon: 126.9779, lat: 37.5657 },
    riverSections: [
      { name: '한강(반포 단면)', lon: 126.99, latRange: [37.60, 37.47], sumMinM: 800, runMinM: 600 },
    ],
    streamCourses: [],
    reportCourses: [
      { name: '청계천(참고)', windowTiles: 3, pts: [[126.9787, 37.5692], [127.0093, 37.5713], [127.0400, 37.5610]] },
    ],
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      { name: '마포대교', lon: 126.9480, lat: 37.5285, windowTiles: 5 },
      { name: '반포대교', lon: 126.9965, lat: 37.5125, windowTiles: 5 },
    ],
  },
  // ── 유럽 1차 (Codex-2 착수 전 선제 정의 — 파일명이 다르면 --file 로 대입) ──
  'grand-paris': {
    file: 'src/components/world/cities/grand-paris.geo.js',
    snapshot: 'scripts/data/grand-paris-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 20,
    // R5(2026-07-23, 제안 docs/proposal-verifier-r5.md 승인): exact 15.06% 중심 ±1.5pp.
    buildingPct: [13.5, 16.5],
    greenMinPct: 8,
    poiMaxDevTiles: 2.5,
    downtown: { label: '샤틀레', lon: 2.3467, lat: 48.8586 },
    riverSections: [
      // R5: 트로카데로 best 180/120 → sum 140 상향(40m 여유). 루브르는 퐁뒤카루젤 차도 교차
      // false-fail 회피를 위해 현행 유지(±2 best-of-5 보정 전제).
      { name: '센강(트로카데로 단면)', lon: 2.28, latRange: [48.875, 48.850], sumMinM: 140, runMinM: 100 },
      { name: '센강(루브르 단면)', lon: 2.33, latRange: [48.870, 48.850], sumMinM: 120, runMinM: 100 },
    ],
    streamCourses: [],
    reportCourses: [],
    // 오너 확정(2026-07-16): 프랑스 도시도 한국식 교량 정리 — BRIDGE 잔존 0, 다리=차도, 강심=수면.
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      { name: '퐁뇌프', lon: 2.3413, lat: 48.8567, windowTiles: 5 },
      { name: '퐁드베르시', lon: 2.3745, lat: 48.8375, windowTiles: 6 },
    ],
  },
  'cote-dazur': {
    file: 'src/components/world/cities/cote-dazur.geo.js',
    snapshot: 'scripts/data/cote-dazur-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 20,
    buildingPct: [6, 9],
    greenMinPct: 20,
    poiMaxDevTiles: 2.5,
    downtown: { label: '니스 구시가', lon: 7.2755, lat: 43.6955 },
    riverSections: [
      // R5: best 120/120 — sum 100 유지, 연속 하한만 60→80m 상향. buildingPct [6,9]는 재실측
      // exact 7.25%로 현행 유지 확정(다핵 해안 벨트 — 조이지 않음).
      { name: '바르강 하구 단면', lat: 43.665, lonRange: [7.19, 7.21], sumMinM: 100, runMinM: 80 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0, // 오너 확정: 프랑스도 한국식 교량 정리
    bridgeCrossings: [],
  },
  brussels: {
    file: 'src/components/world/cities/brussels.geo.js',
    snapshot: 'scripts/data/brussels-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 20,
    buildingPct: [18, 22],
    greenMinPct: 4.5,
    poiMaxDevTiles: 2.5,
    downtown: { label: '그랑플라스', lon: 4.3525, lat: 50.8467 },
    riverSections: [
      // 브뤼셀-샤를루아 운하(센느는 복개 — culvert 제외 계약). 실측 120/80에 마진.
      { name: '운하 단면', lat: 50.825, lonRange: [4.32, 4.35], sumMinM: 100, runMinM: 60 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [],
    // 다언어 복수 앵커 첫 실전(§3-8): fr canonical + nl 병기 전수.
    multilingual: { anchors: ['fr', 'nl'], nameFields: ['nameFr', 'nameNl'] },
  },
  taipei: {
    file: 'src/components/world/cities/taipei.geo.js',
    snapshot: 'scripts/data/taipei-osm-v21.json',
    expectedLocale: 'zh',
    expectedMpt: 20,
    buildingPct: [9.5, 14],
    greenMinPct: 10,
    poiMaxDevTiles: 2.5,
    downtown: { label: '시먼딩', lon: 121.5070, lat: 25.0421 },
    riverSections: [
      // 담수하(서측 경계 하천) — 실측 460~920m.
      { name: '담수하 단면', lat: 25.06, lonRange: [121.49, 121.53], sumMinM: 400, runMinM: 400 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [],
    // 정체(canonical)/간체(학습 트랙) 복수 앵커 — 브뤼셀 fr/nl 문법 재사용.
    multilingual: { anchors: ['zh-Hant', 'zh-Hans'], nameFields: ['nameZhHant', 'nameZhHans'] },
  },
  'hong-kong': {
    file: 'src/components/world/cities/hong-kong.geo.js',
    snapshot: 'scripts/data/hong-kong-osm-v21.json',
    expectedLocale: 'zh',
    expectedMpt: 20,
    buildingPct: [9.5, 14],
    greenMinPct: 18,
    poiMaxDevTiles: 2.5,
    downtown: { label: '침사추이', lon: 114.1722, lat: 22.2975 },
    riverSections: [
      // 빅토리아항(침사추이~센트럴) — 실측 1,540m 연속.
      { name: '빅토리아항 단면', lon: 114.163, latRange: [22.298, 22.278], sumMinM: 1000, runMinM: 1000 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [],
    multilingual: { anchors: ['zh-Hant', 'zh-Hans'], nameFields: ['nameZhHant', 'nameZhHans'] },
  },
  shanghai: {
    file: 'src/components/world/cities/shanghai.geo.js',
    snapshot: 'scripts/data/shanghai-osm-v21.json',
    expectedLocale: 'zh',
    expectedMpt: 20,
    buildingPct: [9.5, 14],
    greenMinPct: 2,
    poiMaxDevTiles: 2.5,
    downtown: { label: '인민광장', lon: 121.4737, lat: 31.2323 },
    riverSections: [
      // 황푸강(와이탄~루자쭈이) — Codex-2 실측 합계 520m/연속 420m에 마진.
      { name: '황푸강 단면', lat: 31.235, lonRange: [121.47, 121.53], sumMinM: 400, runMinM: 360 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      // 와이바이두교(쑤저우허 하구) — 차도 회랑 보존 pin.
      { name: '와이바이두교', lon: 121.4903, lat: 31.2446, windowTiles: 5 },
    ],
    multilingual: { anchors: ['zh-Hant', 'zh-Hans'], nameFields: ['nameZhHant', 'nameZhHans'] },
  },
  beijing: {
    file: 'src/components/world/cities/beijing.geo.js',
    snapshot: 'scripts/data/beijing-osm-v21.json',
    expectedLocale: 'zh',
    expectedMpt: 20,
    buildingPct: [9.5, 14],
    greenMinPct: 2,
    poiMaxDevTiles: 2.5,
    downtown: { label: '왕푸징', lon: 116.4110, lat: 39.9097 },
    riverSections: [
      // 북해~什剎海 수면(황실 원림 호수축) — Codex-2 실측 560m/560m에 마진.
      // 39.924는 경화도(백탑 섬)를 지나 분절(220/180) — 섬 북측 개수면 39.928로 pin(실측 540/540).
      { name: '북해 수면 단면', lat: 39.928, lonRange: [116.37, 116.40], sumMinM: 400, runMinM: 400 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [],
    multilingual: { anchors: ['zh-Hant', 'zh-Hans'], nameFields: ['nameZhHant', 'nameZhHans'] },
  },
  brisbane: {
    file: 'src/components/world/cities/brisbane.geo.js',
    snapshot: 'scripts/data/brisbane-osm-v21.json',
    expectedLocale: 'en',
    expectedMpt: 20,
    buildingPct: [9, 12],
    greenMinPct: 5,
    poiMaxDevTiles: 2.5,
    downtown: { label: '퀸스트리트몰', lon: 153.0258, lat: -27.4695 },
    riverSections: [
      // 브리즈번강 S자 사행 — 위도 스캔 실측 -27.476에서 합계 1600m/최대 연속 800m(다중 관통).
      // 이웃 위도 run 260~320 변동이라 run은 보수 마진(240), sum은 사행 합산 특성 반영(800).
      { name: '브리즈번강 단면', lat: -27.476, lonRange: [153.00, 153.05], sumMinM: 800, runMinM: 240 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      { name: '스토리브리지', lon: 153.0351, lat: -27.4636, windowTiles: 5 },
      { name: '빅토리아교', lon: 153.0203, lat: -27.4738, windowTiles: 5 },
    ],
  },
  sydney: {
    file: 'src/components/world/cities/sydney.geo.js',
    snapshot: 'scripts/data/sydney-osm-v21.json',
    expectedLocale: 'en',
    expectedMpt: 20,
    buildingPct: [9, 12],
    greenMinPct: 5,
    poiMaxDevTiles: 2.5,
    downtown: { label: '서큘러키', lon: 151.2110, lat: -33.8610 },
    riverSections: [
      // 포트잭슨(하버브리지 동측 개수면) — 경도 스캔 실측 151.24에서 2300m/연속 2280m.
      { name: '포트잭슨 단면', lon: 151.24, latRange: [-33.84, -33.875], sumMinM: 1600, runMinM: 1600 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      { name: '하버브리지', lon: 151.2108, lat: -33.8523, windowTiles: 5 },
      { name: '안작브리지', lon: 151.1870, lat: -33.8700, windowTiles: 6 },
    ],
  },
  canberra: {
    file: 'src/components/world/cities/canberra.geo.js',
    snapshot: 'scripts/data/canberra-osm-v21.json',
    expectedLocale: 'en',
    expectedMpt: 20,
    buildingPct: [5.5, 8],
    greenMinPct: 20,
    poiMaxDevTiles: 2.5,
    downtown: { label: '시빅(앨링가 스트리트)', lon: 149.1310, lat: -35.2780 },
    riverSections: [
      // 벌리 그리핀 호수(웨스트 베이슨) — 경도 스캔 실측 149.115에서 1040m/연속 900m.
      { name: '벌리그리핀호 단면', lon: 149.115, latRange: [-35.278, -35.305], sumMinM: 800, runMinM: 700 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      { name: '커먼웰스 애비뉴 교', lon: 149.1206, lat: -35.2925, windowTiles: 5 },
      { name: '킹스 애비뉴 교', lon: 149.1367, lat: -35.2985, windowTiles: 5 },
    ],
  },
  melbourne: {
    file: 'src/components/world/cities/melbourne.geo.js',
    snapshot: 'scripts/data/melbourne-osm-v21.json',
    expectedLocale: 'en',
    expectedMpt: 20,
    buildingPct: [9, 12],
    greenMinPct: 5,
    poiMaxDevTiles: 2.5,
    downtown: { label: '플린더스 스트리트역', lon: 144.9671, lat: -37.8183 },
    riverSections: [
      // 야라강(프린세스~스완st 교 사이) — 경도 스캔 실측 144.975에서 120m/120m(도심 하폭 100~120m).
      { name: '야라강 단면', lon: 144.975, latRange: [-37.812, -37.828], sumMinM: 100, runMinM: 80 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [
      { name: '프린세스브리지', lon: 144.9681, lat: -37.8193, windowTiles: 5 },
    ],
  },
  'mont-saint-michel': {
    file: 'src/components/world/cities/mont-saint-michel.geo.js',
    snapshot: 'scripts/data/mont-saint-michel-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 4, // 정밀 티어 1호 — mpt 계약 자체가 게이트
    buildingPct: [0.5, 1.5],
    greenMinPct: null, // 갯벌 지형 — 녹지 프로필 부적용
    poiMaxDevTiles: 6, // 4m/타일 기준 24m
    downtown: null,
    riverSections: [],
    streamCourses: [],
    reportCourses: [],
  },
  // ── 1.5차 런던권 B안 (#150 스펙 — Codex-2 착수분 선제 정의) ──
  london: {
    file: 'src/components/world/cities/london.geo.js',
    snapshot: 'scripts/data/london-osm-v21.json',
    expectedLocale: 'en',
    expectedMpt: 20,
    buildingPct: [9.5, 12.5],
    greenMinPct: 8, // 하이드·리젠츠·큐·리치먼드·햄스테드 — 관찰 후 상향 검토
    poiMaxDevTiles: 2.5,
    downtown: { label: '트래펄가', lon: -0.1281, lat: 51.5080 },
    riverSections: [
      { name: '템스(웨스트민스터 단면)', lon: -0.1220, latRange: [51.515, 51.495], sumMinM: 200, runMinM: 160 },
      // 타워브리지(-0.0754)는 남북 교량이라 고정 lon 스캔과 평행 겹침(퐁뒤카루젤 선례의 세로판) —
      // 런던브리지(-0.0878)와의 중간 개수면으로 이동. Codex-2 감사: 원본 수면 240~300m 정상.
      { name: '템스(타워브리지 하류 단면)', lon: -0.0810, latRange: [51.515, 51.498], sumMinM: 200, runMinM: 160 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0, // 한국식 교량 정리 — 템스 다리 = 차도
    bridgeCrossings: [
      { name: '타워브리지', lon: -0.0754, lat: 51.5055, windowTiles: 5 },
      { name: '웨스트민스터교', lon: -0.1220, lat: 51.5008, windowTiles: 5 },
    ],
  },
  // ── 유럽 2차 1호 마르세유 (#260 — 이프성 외해 섬은 geo 테스트의 2성분 BFS 계약이 담당) ──
  marseille: {
    file: 'src/components/world/cities/marseille.geo.js',
    snapshot: 'scripts/data/marseille-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 20,
    // R5(2026-07-23): exact 17.42% 중심 ±2.0pp(항만 분모 변동 감안).
    buildingPct: [15.5, 19.5],
    greenMinPct: 1,
    poiMaxDevTiles: 2.5,
    downtown: { label: '구항(벨주 부두)', lon: 5.3745, lat: 43.2946 },
    riverSections: [
      // R5: 구항 best 320/320 → 280/280(2타일 여유), 이프 해협 best 2,220 → 2,000(약 10% 여유).
      { name: '구항 단면', lon: 5.368, latRange: [43.300, 43.288], sumMinM: 280, runMinM: 280 },
      { name: '이프성 해협 단면', lat: 43.288, lonRange: [5.325, 5.355], sumMinM: 2000, runMinM: 2000 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0, // 구항·해안에 교량 없음(오너 교량 정리 규율 동일)
    bridgeCrossings: [],
  },
  // ── 일본 5호 가와구치코/후지 (#276 — 5합목 33타일 분리 성분은 geo 테스트 2성분 계약이 담당,
  //    도시 배선의 등산 버스 TRANSIT 가 유일한 다리) ──
  kawaguchiko: {
    file: 'src/components/world/cities/kawaguchiko.geo.js',
    snapshot: 'scripts/data/kawaguchiko-osm-v21.json',
    expectedLocale: 'ja',
    expectedMpt: 20,
    buildingPct: [4.5, 7],
    greenMinPct: null, // MOUNTAIN이 land denominator를 지배하는 특수형 — report-only 유지
    poiMaxDevTiles: 2.5,
    downtown: { label: '가와구치코역', lon: 138.7645, lat: 35.4986 },
    riverSections: [
      // 河口湖 개수면 — 위도 스캔 실측 35.518에서 2,540m/2,460m(우노시마 섬 북측 무분절 구간).
      { name: '가와구치호 단면', lat: 35.518, lonRange: [138.73, 138.79], sumMinM: 2000, runMinM: 2000 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0,
    bridgeCrossings: [],
  },
  // ── 유럽 2차 3호 제네바 (#289 — 단일 성분 79,146 실측, 무에트 도선은 도시 배선 소관) ──
  geneva: {
    file: 'src/components/world/cities/geneva.geo.js',
    snapshot: 'scripts/data/geneva-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 20,
    buildingPct: [9.5, 12.5],
    greenMinPct: 7.5,
    poiMaxDevTiles: 2.5,
    downtown: { label: '코르나뱅역', lon: 6.1425, lat: 46.2104 },
    riverSections: [
      // 레만호 개수면 — 위도 스캔 실측 46.225에서 2,480m/2,460m(항 방파제 밖 무분절 구간).
      { name: '레만호 단면', lat: 46.225, lonRange: [6.145, 6.185], sumMinM: 2000, runMinM: 2000 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0, // 론강 다리 = 차도 흡수(몽블랑교 회랑은 단일 성분 실측으로 확인)
    bridgeCrossings: [
      { name: '몽블랑교', lon: 6.1478, lat: 46.2077, windowTiles: 5 },
    ],
  },
  // ── 유럽 2차 4호 레만호 연안 (#304 — 로잔 서안·동부 북안 2성분은 CGN 도선이 유일한 다리,
  //    남안 사부아 스트립 분리 성분은 report-only. 성분 계약은 geo 테스트 소관) ──
  'leman-riviera': {
    file: 'src/components/world/cities/leman-riviera.geo.js',
    snapshot: 'scripts/data/leman-riviera-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 20,
    buildingPct: [2.0, 3.5], // 다핵 호반 벨트 정본 2.6% — R3 승인 hard gate
    greenMinPct: null, // 라보 경사면·알프 자락 MOUNTAIN 질량 — report 관찰
    poiMaxDevTiles: 2.5,
    downtown: { label: '로잔역', lon: 6.6291, lat: 46.5167 },
    riverSections: [
      // 레만호 개수면(우시 앞바다) — 위도 스캔 실측 46.47에서 6,920m/6,920m(무분절 호심).
      { name: '레만호 우시 단면', lat: 46.47, lonRange: [6.63, 6.72], sumMinM: 6000, runMinM: 6000 },
      // 시옹성 연안(베토만) — 경도 스캔 실측 6.915에서 2,760m/2,760m(성 서측 개수면).
      { name: '시옹성 연안 단면', lon: 6.915, latRange: [46.430, 46.405], sumMinM: 2200, runMinM: 2200 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0, // 호안 벨트에 수면 교량 없음(한국식 3분류 정리 동일)
    bridgeCrossings: [],
  },
  lyon: {
    file: 'src/components/world/cities/lyon.geo.js',
    snapshot: 'scripts/data/lyon-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 20,
    buildingPct: [13, 17], // 반도 도심·언덕 혼합 정본 14.6% — R4 승인 hard gate
    greenMinPct: null, // 테트도르·언덕 사면 혼합 — report 관찰
    poiMaxDevTiles: 2.5,
    downtown: { label: '벨쿠르', lon: 4.8320, lat: 45.7578 },
    riverSections: [
      // 론강(모랑 다리 위도) — 위도 스캔 실측 45.767에서 160m/160m(단일 수로).
      { name: '론강 도심 단면', lat: 45.767, lonRange: [4.835, 4.850], sumMinM: 140, runMinM: 140 },
      // 손강(구시가 위도) — 위도 스캔 실측 45.762에서 60m/60m(교량 데크 ROAD 흡수 감안 하한).
      { name: '손강 구시가 단면', lat: 45.762, lonRange: [4.815, 4.830], sumMinM: 50, runMinM: 50 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0, // 한국식 3분류 정리 동일(도심 교량은 ROAD 흡수)
    bridgeCrossings: [],
  },
  bordeaux: {
    file: 'src/components/world/cities/bordeaux.geo.js',
    snapshot: 'scripts/data/bordeaux-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 20,
    buildingPct: [12, 16], // 초승달 항만 도심 정본 13.8% — R4 승인 hard gate
    greenMinPct: null,
    poiMaxDevTiles: 2.5,
    downtown: { label: '부르스 광장', lon: -0.5693, lat: 44.8414 },
    riverSections: [
      // 가론강(부르스 위도) — 위도 스캔 실측 44.8414에서 460m/440m(단일 대하).
      { name: '가론강 부르스 단면', lat: 44.8414, lonRange: [-0.575, -0.545], sumMinM: 400, runMinM: 400 },
      // 가론강(시테뒤뱅 위도) — 실측 660m/660m(하류 확폭).
      { name: '가론강 시테뒤뱅 단면', lat: 44.86, lonRange: [-0.57, -0.535], sumMinM: 600, runMinM: 600 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0, // 피에르 다리 등은 ROAD 흡수(한국식 3분류 동일)
    bridgeCrossings: [],
  },
  strasbourg: {
    file: 'src/components/world/cities/strasbourg.geo.js',
    snapshot: 'scripts/data/strasbourg-osm-v21.json',
    expectedLocale: 'fr',
    expectedMpt: 20,
    buildingPct: [10.5, 14], // 그랑딜 밀집 도심 정본 12.2% — R4 승인 hard gate
    greenMinPct: null,
    poiMaxDevTiles: 2.5,
    downtown: { label: '클레베르 광장', lon: 7.7455, lat: 48.5833 },
    riverSections: [
      // 일강 그랑딜 남수로(프티트 프랑스 위도) — 실측 합계 300m/최장 140m(수로 분기 합산).
      { name: '일강 그랑딜 남수로', lat: 48.58, lonRange: [7.735, 7.755], sumMinM: 240, runMinM: 100 },
      // 일강 북수로(대성당 북측) — 실측 합계 240m/최장 80m(운하 분기).
      { name: '일강 북수로', lat: 48.586, lonRange: [7.745, 7.775], sumMinM: 180, runMinM: 60 },
    ],
    streamCourses: [],
    reportCourses: [],
    bridgeMaxTiles: 0, // 퐁쿠베르 등 교량은 ROAD 흡수(한국식 3분류 동일)
    bridgeCrossings: [],
  },
};

// ── 투영(도시 geo 생성 계약과 동일: webmercator + aspectCorrection) ─────────
function makeProjector(bbox, metersPerTile) {
  const wm = (lon, lat) => ({ x: EARTH * lon * DEG, y: EARTH * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)) });
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const sw = wm(minLon, minLat);
  const ne = wm(maxLon, maxLat);
  const corr = Math.cos(((minLat + maxLat) / 2) * DEG);
  return {
    tile: (lon, lat) => {
      const p = wm(lon, lat);
      return [((p.x - sw.x) * corr) / metersPerTile, ((ne.y - p.y) * corr) / metersPerTile];
    },
  };
}

function terrainShares(geo) {
  const counts = {};
  for (const v of geo.terrain) counts[v] = (counts[v] || 0) + 1;
  const land = geo.terrain.length - (counts[T.WATER] || 0) - (counts[T.RIVER] || 0) - (counts[T.ISLAND] || 0);
  const pct = (t) => (100 * (counts[t] || 0)) / land;
  return { counts, land, pct };
}

// 단면은 스캔 축 ±2 오프셋 5개 중 최적값 — 교량 데크(→KR 정리 후엔 차도)가 pin 열과 정확히
// 겹치면 수면이 0으로 나오는 false FAIL 방지(그랑파리 루브르 단면 = 퐁뒤카루젤 사례, Codex-2 진단).
function scanSection(geo, proj, section) {
  const W = geo.meta.grid.w;
  const mpt = geo.meta.metersPerTile;
  const scanOnce = (offset) => {
    const runs = [];
    let run = 0;
    let sum = 0;
    const push = (v) => {
      if (isWaterTile(v)) { sum += 1; run += 1; } else if (run > 0) { runs.push(run); run = 0; }
    };
    if (section.lat != null) { // 가로 단면(고정 위도, 경도 스캔) — 오프셋은 y축
      const y = Math.floor(proj.tile(section.lonRange[0], section.lat)[1]) + offset;
      const [x0, x1] = section.lonRange.map((lon) => Math.floor(proj.tile(lon, section.lat)[0]));
      for (let x = x0; x <= x1; x += 1) push(geo.terrain[y * W + x]);
    } else { // 세로 단면(고정 경도, 위도 스캔 — latRange는 북→남) — 오프셋은 x축
      const x = Math.floor(proj.tile(section.lon, section.latRange[0])[0]) + offset;
      const [y0, y1] = section.latRange.map((lat) => Math.floor(proj.tile(section.lon, lat)[1]));
      for (let y = y0; y <= y1; y += 1) push(geo.terrain[y * W + x]);
    }
    if (run > 0) runs.push(run);
    return { sumM: sum * mpt, runM: Math.max(0, ...runs) * mpt };
  };
  let best = { sumM: 0, runM: 0 };
  for (const offset of [-2, -1, 0, 1, 2]) {
    const result = scanOnce(offset);
    if (result.sumM > best.sumM || (result.sumM === best.sumM && result.runM > best.runM)) best = result;
  }
  return best;
}

function coursePresence(geo, proj, course) {
  const { w: W, h: H } = geo.meta.grid;
  const win = course.windowTiles;
  let hit = 0;
  let total = 0;
  for (let i = 0; i < course.pts.length - 1; i += 1) {
    const [lon1, lat1] = course.pts[i];
    const [lon2, lat2] = course.pts[i + 1];
    for (let t = 0; t <= 20; t += 1) {
      const [fx, fy] = proj.tile(lon1 + ((lon2 - lon1) * t) / 20, lat1 + ((lat2 - lat1) * t) / 20);
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      let found = 0;
      for (let dy = -win; dy <= win; dy += 1) {
        for (let dx = -win; dx <= win; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue; // 경계 wrap 방지(#156 P2)
          const v = geo.terrain[ny * W + nx];
          if (isWaterTile(v) || v === T.BRIDGE) found = 1; // 하천 위 다리는 수면 증거로 인정
        }
      }
      hit += found;
      total += 1;
    }
  }
  return hit / total;
}

function downtownRoadPct(geo, proj, downtown) {
  const { w: W, h: H } = geo.meta.grid;
  const [fx, fy] = proj.tile(downtown.lon, downtown.lat);
  const cx = Math.floor(fx);
  const cy = Math.floor(fy);
  let road = 0;
  let land = 0;
  for (let y = Math.max(0, cy - 100); y < Math.min(H, cy + 100); y += 1) {
    for (let x = Math.max(0, cx - 100); x < Math.min(W, cx + 100); x += 1) {
      const v = geo.terrain[y * W + x];
      if (v === T.WATER || v === T.RIVER || v === T.ISLAND) continue;
      land += 1;
      if (v === T.ROAD || v === T.CROSSWALK || v === T.BRIDGE) road += 1;
    }
  }
  return (100 * road) / land;
}

async function main() {
  const argv = process.argv.slice(2);
  const read = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const city = read('--city');
  const gates = CITY_GATES[city];
  if (!gates) throw new Error(`Usage: node scripts/verify-city-geo.mjs --city <${Object.keys(CITY_GATES).join('|')}> [--file <geo.js>]`);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = read('--file') || path.join(root, gates.file);

  const mod = await import(path.resolve(file));
  const geoKey = Object.keys(mod).find((k) => k.endsWith('_GEO'));
  const geo = mod[geoKey];
  const proj = makeProjector(geo.meta.bbox, geo.meta.metersPerTile);
  const { pct } = terrainShares(geo);

  const results = [];
  const gate = (name, pass, detail) => results.push({ name, pass, detail, hard: true });
  const report = (name, detail) => results.push({ name, pass: null, detail, hard: false });

  // ⓪ 계약 게이트 — 타일 해상도·언어 앵커 (정의된 도시만)
  if (gates.expectedMpt != null) {
    gate(`m/타일 계약 = ${gates.expectedMpt}`, geo.meta.metersPerTile === gates.expectedMpt, `${geo.meta.metersPerTile}m`);
  }
  if (gates.expectedLocale != null) {
    gate(`contentLocale = ${gates.expectedLocale}`, geo.meta.contentLocale === gates.expectedLocale, `${geo.meta.contentLocale}`);
  }

  // ① 건물 비중 (프로필 미확정 도시는 report)
  const building = pct(T.BUILDING);
  if (gates.buildingPct) {
    gate(`건물 ${gates.buildingPct[0]}~${gates.buildingPct[1]}%`, building >= gates.buildingPct[0] && building <= gates.buildingPct[1], `${building.toFixed(1)}%`);
  } else {
    report('건물 비중(프로필 관찰)', `${building.toFixed(1)}%`);
  }

  // ② 녹지(산+공원) 질량
  const green = pct(T.MOUNTAIN) + pct(T.PARK);
  if (gates.greenMinPct != null) {
    gate(`녹지(M+P) ≥${gates.greenMinPct}%`, green >= gates.greenMinPct, `${green.toFixed(1)}%`);
  } else {
    report('녹지(M+P)', `${green.toFixed(1)}%`);
  }

  // ③ POI 재투영 정합
  let worstDev = 0;
  let worstId = '';
  for (const poi of geo.pois || []) {
    if (poi.lon == null) continue;
    const [ex, ey] = proj.tile(poi.lon, poi.lat);
    const d = Math.hypot(ex - poi.tile[0], ey - poi.tile[1]);
    if (d > worstDev) { worstDev = d; worstId = poi.id; }
  }
  gate(`POI 재투영 ≤${gates.poiMaxDevTiles}타일`, worstDev <= gates.poiMaxDevTiles, `worst ${worstId} ${worstDev.toFixed(2)}타일`);

  // ④ 강 단면(합계+연속)
  for (const section of gates.riverSections) {
    const { sumM, runM } = scanSection(geo, proj, section);
    gate(`${section.name} 합계 ≥${section.sumMinM}m·연속 ≥${section.runMinM}m`, sumM >= section.sumMinM && runM >= section.runMinM, `합계 ${sumM}m / 연속 ${runM}m`);
  }

  // ⑤ 지천 유로 존재율 (최종 terrain — 마스크 아님)
  for (const course of gates.streamCourses) {
    const presence = coursePresence(geo, proj, course);
    gate(`${course.name} 유로 수면 존재율 ≥${course.presenceMin * 100}%`, presence >= course.presenceMin, `${(presence * 100).toFixed(0)}%`);
  }
  for (const course of gates.reportCourses || []) {
    report(`${course.name} 유로 수면 존재율`, `${(coursePresence(geo, proj, course) * 100).toFixed(0)}%`);
  }

  // ⑤-b 다언어 앵커(브뤼셀 §3-8): localeAnchors 선언 + 병기 필드 전수 커버리지
  if (gates.multilingual) {
    const anchors = geo.meta.localeAnchors || [];
    gate(`localeAnchors = [${gates.multilingual.anchors.join(',')}]`,
      gates.multilingual.anchors.every((a) => anchors.includes(a)), JSON.stringify(anchors));
    for (const field of gates.multilingual.nameFields) {
      const markers = [...(geo.pois || []), ...(geo.stations || [])];
      const covered = markers.filter((m) => typeof m[field] === 'string' && m[field].length > 0).length;
      gate(`${field} 커버리지 100%`, covered === markers.length, `${covered}/${markers.length}`);
    }
  }

  // ⑥ 교량 정리(오너 지시): BRIDGE 잔존 0 + 주요 교량이 차도 회랑으로 생존
  if (gates.bridgeMaxTiles != null) {
    const bridgeCount = (terrainShares(geo).counts[T.BRIDGE] || 0);
    gate(`BRIDGE 잔존 ≤${gates.bridgeMaxTiles}타일 (교량→차도/수면 흡수)`, bridgeCount <= gates.bridgeMaxTiles, `${bridgeCount}타일`);
    const { w: W2, h: H2 } = geo.meta.grid;
    for (const pin of gates.bridgeCrossings || []) {
      const [fx, fy] = proj.tile(pin.lon, pin.lat);
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      let paved = false;
      for (let dy = -pin.windowTiles; dy <= pin.windowTiles && !paved; dy += 1) {
        for (let dx = -pin.windowTiles; dx <= pin.windowTiles; dx += 1) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= W2 || ny < 0 || ny >= H2) continue;
          const v = geo.terrain[ny * W2 + nx];
          if (v === T.ROAD || v === T.CROSSWALK || v === T.BRIDGE) { paved = true; break; }
        }
      }
      gate(`${pin.name} 교량 회랑 생존`, paved, paved ? '차도 확인' : `±${pin.windowTiles}타일 내 차도 없음`);
    }
  }

  // ⑦ 스냅샷·분류 계약 (파일이 있을 때만 — main 등 부재 브랜치에선 SKIP)
  const snapPath = gates.snapshot ? path.join(root, gates.snapshot) : null;
  if (snapPath && fs.existsSync(snapPath)) {
    const head = fs.readFileSync(snapPath, 'utf8').slice(0, 4096);
    const version = Number((head.match(/"version"\s*:\s*(\d+)/) || [])[1] || 0);
    gate('스냅샷 계약 v2+ (가시 도로 분류)', version >= 2, `version ${version}`);
  } else {
    report('스냅샷 계약', gates.snapshot ? `SKIP (${gates.snapshot} 없음)` : 'SKIP (경로 미확정)');
  }
  try {
    const { roadStyle } = await import(path.join(root, 'scripts/build-korean-city-osm-snapshot.mjs'));
    const visible = ['residential', 'service', 'tertiary'].every((h) => roadStyle(h).value === 2);
    gate('roadStyle 계약(residential·service·tertiary 가시)', visible, visible ? 'OK' : '비가시 클래스 존재');
  } catch {
    report('roadStyle 계약', 'SKIP (스냅샷 스크립트 없음)');
  }

  // report: 도심 가시도로 (게이트 아님 — 버퍼 정책 변경에 민감해 참고 수치)
  if (gates.downtown) {
    report(`도심(${gates.downtown.label}) 4km 가시도로`, `${downtownRoadPct(geo, proj, gates.downtown).toFixed(1)}%`);
  }

  // ── 출력 ──
  let failed = 0;
  for (const r of results) {
    const mark = r.pass === null ? '·' : r.pass ? '✅' : '❌';
    if (r.pass === false) failed += 1;
    console.log(`${mark} ${r.name} — ${r.detail}`);
  }
  console.log(failed === 0 ? `\n${city}: 전 게이트 통과` : `\n${city}: 게이트 ${failed}건 FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => { console.error(error.message); process.exit(2); });
