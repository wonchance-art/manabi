'use client';

// 🌱 학습 월드 — Phaser 게임 캔버스 (솔로 코어).
// 포켓몬 골드(GBC) 감성: 도트 그래픽 + 블럭(타일) 단위 이동.
// 외부 에셋 0 — 모든 타일/캐릭터/펫은 Graphics 픽셀맵을 generateTexture로 즉석 생성.
// phaser는 무거우므로 이 파일은 next/dynamic(ssr:false)로만 로드된다(/world 라우트 전용 청크).
//
// 통합 계약은 ./bus.js 주석 참고 — **좌표 스케일 불변**:
//   emit 'local:state' {x,y,dir}  (~100ms, x·y는 월드 px, 1타일=32px)
//   on 'peers:update' (원격 렌더) · emit 'peers:dist' (px, 500ms).
// 내부 표현만 그리드(타일 인덱스)로 다루고, 버스로 오가는 값은 예전과 동일한 32px/타일 월드 px다.
//
// ── GB 실규격 뷰포트(2× 백킹) ──
// 게임 캔버스를 320×288(=GB 화면 160×144의 2배 백킹)로 고정하고, 카메라 zoom 1로
// 32px/타일 월드를 화면상 그대로 32px/타일로 담아 **정확히 10×9타일**(=GB 필드 시야,
// 320/32=10, 288/32=9)이 유지되게 한다.
//   · 왜 2배 백킹인가: zoom 0.5(160×144 백킹)에서는 10px 닉네임 텍스트가 백킹 5px로
//     축소된 뒤 CSS 정수 확대를 거치며 한글 글리프가 뭉개졌다. 백킹을 2배(320×288)로
//     올리고 zoom을 1로 하면 화면에 보이는 도트 크기·시야는 완전히 동일하되, 텍스트는
//     백킹 픽셀을 2배 확보해 선명해진다.
//   · zoom은 렌더 스케일일 뿐 월드 좌표/버스/음성 근접 게이팅에는 영향 없다(예전과 동일 원리).
// 캔버스(320×288)는 컨테이너에 맞춰 **정수 배율**(×1/×2/×3…)로만 CSS 확대한다(도트 보존).
// 이전 160×144×정수배(최소 ×2)와 동일한 화면 크기가 되려면 320×288은 최소 ×1이어야 한다.

import { useEffect, useRef, useState } from 'react';
import bus from './bus';
import QuestReview, { GBC, gbcButtonPrimary, gbcPanel } from './QuestReview';
import StampAlbum from './StampAlbum';
import WorldGameMenu from './WorldGameMenu';
import {
  CHAR_W, CHAR_H, CHAR_ORIGIN_Y, PET_W, PET_H,
  CHAR_DIRS, CHAR_POSES, CHAR_WALK_CYCLE, charFrameRows,
  PET_KEYS, petFrameRows,
  BASE_TILE_PAL, CHAR_PAL_LOCAL, CHAR_PAL_REMOTE, PET_PAL,
  tonePalette, toneColor,
  riverStreamRects, RIVER_N, RIVER_E, RIVER_S, RIVER_W,
  BOAT_W, BOAT_H, BOAT_PAL, boatFrameRows,
  NPC_KEYS, NPC_W, NPC_H, NPC_PAL, npcMarkerRows,
  GOURMET_PAL, gourmetMarkerRows,
  applyPeersToScene, updateScenePeers, peerLabelStyle, emitPeerDistances, ensureAvatarCharSet,
} from './sprites';
import { DEFAULT_AVATAR, avatarPalette, normalizeWorldAvatar } from '../../lib/world/avatar';
// 🗾 여행 스탬프 — 노드 첫 방문 수집(fetch 래퍼, 실패 조용히). API: /api/world/stamps.
import { loadStamps, collectStamp } from '../../lib/world/stamps';
// 🗺️ 광장 맵 데이터 — 한반도+일본 열도 실비율 도트 맵(448×384, build-map.mjs 산출).
import { MAP_W, MAP_H, decodeMap, TERRAIN, isBlocked, POI } from './mapData';
// 🧭 장소 노드(도시·공항·항구·랜드마크) + 미니맵 다운샘플(순수 함수).
import { WORLD_NODES, getNode, buildMinimap } from './worldNodes';
// 🏙️ 광장 SEA→LAND 메꿈(순수 함수·단일 진실원 — 런타임·관리자 뷰·미니맵 공통).
import { buildPlayableGrid, PLAZA_R } from '../../lib/world/mapGeo';
import {
  PhaserOverworldOverlayLayer,
  PhaserOverworldPageRenderer,
} from './overworldPageRenderer';
import { OverworldChunkLoader } from '../../lib/world/overworldChunkLoader';
import {
  OVERWORLD_FIXTURE_BASE_URL,
  OVERWORLD_FIXTURE_MANIFEST,
} from '../../lib/world/overworldFixture';
import { activeOverworldVehiclesAt, OVERWORLD_ROUTES } from './overworldTransit';
// 🧭 재접속 스폰 좌표 검증(순수) — 저장된 타일이 맵 안·보행 가능일 때만 사용, 아니면 서울 폴백.
// cityRedirectScene: 초기 부팅 시 저장 씬이 'city:<id>' 면 도시맵 직행 판별(순수 — Codex P1-1 회귀 게이트).
import {
  isSpawnTileValid,
  cityRedirectScene,
  corridorRedirectScene,
  defaultOverworldRegionSpawn,
  overworldRegionRedirectScene,
} from '../../lib/world/session';
// 🌏 독해 트랙 "도쿄 도착" 글 1 → 월드 스토리 씬(하네다 공항). 공항 씬·텍스트박스·문답 오버레이.
import { buildAirportScene } from './airportScene';
import { buildMsmAbbeyScene, MSM_ABBEY_SCENE_KEY } from './msmAbbeyScene';
import { buildTranssibCorridorScene } from './transsibCorridorScene';
import { buildOverworldRegionScene } from './overworldRegionScene';
// 🏙️ 도시 정밀맵(계층형 맵) — CityScene 은 1개, cityId 로 파라미터화. 도시 추가 = cities/<id>.js 1개.
//   도시 데이터는 이 청크(GameCanvas 는 next/dynamic ssr:false) 안에서만 로드된다 — /world First Load JS 무영향.
import { buildCityScene } from './CityScene';
import { CITY_DATA } from './cities/index.js';
import { CITY_MINI_SCALE, cityMinimapLayout, downsampleCityGrid } from './cityMinimap';
import { directTransitDestinations } from '../../lib/world/transit';
import { corridorStopSpawn } from '../../lib/world/transsibCorridor';
import {
  OVERWORLD_REGION_LIST,
  overworldRegionById,
  overworldRegionByScene,
  overworldRegionSpawn,
} from '../../lib/world/overworldRegions';
import {
  overworldAirDestinationById,
  overworldAirDestinations,
} from '../../lib/world/overworldAirHub';
import { formatWorldTime, WORLD_TIME_SCALE } from '../../lib/world/worldClock';
import { cityWeatherAt, worldEventAt } from '../../lib/world/worldLife';
import { useWorldClock } from '../../lib/world/useWorldClock';
import { toInteractiveNode } from './cultureDoors';
import { StoryTextbox, AirportQuiz } from './StoryOverlay';
import { buildStoryScript } from './storyScript';
// 🗾 NPC 도트 대화(마스터플랜 A-1) — 하카타 라멘 전문점 주인·신사 미코상. 대화 콘텐츠·판정은
// npcScripts, 오버레이 UI 는 NpcDialog(공항 StoryOverlay 와 같은 GBC 관행). 로컬 전용 파일럿(공유 없음).
// 완주 스탬프는 보안성 없는 "방문 기념"(P2) — 학습 달성/보상으로 쓰려면 서버 검증 claim(A-4) 필요.
import NpcDialog from './NpcDialog';
// 🔒 월드 번들 정답 격리(P1-1): 전체 트랙(n5_tokyo.js)을 정적 import하면 트리 셰이킹 불가로
// /world 청크에 30편 전 글의 questions·answer·why가 실린다(서버 스트립 P2-7 무력화).
// 월드 스토리 씬은 글 1만 쓰므로 그 데이터만 담은 scene1 모듈만 가져온다(글 1은 상시 열림 → 정당).
import scene1Text from '../../content/japanese/reading/n5_tokyo_scene1';
// 통과 기록은 본편 R3와 동일 규약을 그대로 공유(readingProgress·reviewEvents·grammarSrs).
import { READING_LANG, readingSlug, markReadingPassedLocal, markReadingPassedRemote } from '../../lib/readingProgress';
import { logReviewEvents } from '../../lib/reviewEvents';
import { enqueueGrammarReview } from '../../lib/grammarSrs';

// 프로토타입 = 글 1 하나. scene1 모듈(원본 글 1의 사본) 무수정 — 런타임에 텍스트박스 스텝으로 변환만.
const READING_TEXT_ID = 'n5-tokyo-01';
const STORY_TEXT = (scene1Text && scene1Text.id === READING_TEXT_ID) ? scene1Text : null;
const STORY_STEPS = STORY_TEXT ? buildStoryScript(STORY_TEXT) : [];

const CITY_FADE_MS = 260; // 도시 진입/이탈 페이드(페리와 동일 감성 · 조작 잠금)
const formatTransitMinute = (totalGameMinutes) => {
  const minute = ((Math.floor(totalGameMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
};

// ── 좌표 스케일 (버스 계약 불변: 1타일 = 32 월드 px) ──
const TILE = 32;            // 월드 px / 타일 (예전과 동일 — local:state·peers:dist 스케일 유지)
const TEX = 16;             // 타일 소스 텍스처 크기(px) — 도트 원본
const TSCALE = TILE / TEX;  // 소스→월드 배율 = 2 (타일·캐릭터·펫 공통: 소스 1px = 월드 2px)
const ZOOM = 1;             // 카메라 줌 → 화면상 타일 32*1 = 32px (백킹 2배 확보, 시야·도트 크기는 예전과 동일)
const VIEW_W = 320;         // 백킹 캔버스 가로(px) = 10타일 × 32px (예전 160의 2배)
const VIEW_H = 288;         // 백킹 캔버스 세로(px) = 9타일 × 32px (예전 144의 2배)
const MIN_SCALE = 1;        // 캔버스 최소 정수 배율(백킹이 2배가 됐으므로 ×1 = 예전 ×2와 동일 화면 크기)
const LOCAL_DEBUG_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// 원격 피어 도트 닉네임 라벨/말풍선 — 머리 위 오프셋(월드 px)과 항상 최상단 depth.
const PEER_LABEL_DY = 30;          // 스프라이트 기준점 위로 라벨을 띄우는 높이(캐릭터 키 ≈ 32px)
const PEER_LABEL_DEPTH = 15000;    // 캐릭터(depth=y, 최대 WORLD_H)보다 항상 위에 그려지도록 큰 상수
// 월드 격자 = 실비율 도트 맵(한반도+일본, 448×384타일). 예전 40×30에서 확대 — 좌표 스케일만 커진다.
const COLS = MAP_W;
const ROWS = MAP_H;
const WORLD_W = TILE * COLS;
const WORLD_H = TILE * ROWS;
// 장식(나무·꽃·풀숲) 동시 스폰 상한 — 카메라 주변만 생성/재활용하므로 화면 밖은 즉시 회수된다.
const DECOR_CAP = 128;
// 스폰 광장 반경(타일) — 이 안은 land 보장 + 장식 비움(플레이어가 갇히지 않게).
// PLAZA_R 은 mapGeo(광장 변환의 단일 진실원)에서 import — 값 이원화 방지.
const STEP_MS = 200;        // 타일 1칸 이동 시간(기본 — 버스 계약 스케일 불변)
// ── 달리기(B 홀드 한정) ── B가 눌린 상태에서 방향 입력이 들어와 스텝이 시작될 때만 2배속.
// STEP_MS 200→100, CHAR_ANIM_MS 100→50. B 탭(짧게)은 여전히 취소/뜻 토글일 뿐(스텝이 없으면 무효).
const RUN_STEP_MS = 100;    // 달리기 시 타일 1칸 이동 시간
const RUN_ANIM_MS = 50;     // 달리기 시 보행 프레임 주기
const TURN_MS = 90;         // 방향만 바꾸는 유예(이 안에 떼면 제자리에서 돌기만)
const WALK_MS = 110;        // 펫 걷기 프레임 교차 주기
// 캐릭터 보행 4프레임 사이클[l,n,r,n] 진행 주기. 100ms → 400ms/사이클 = 2타일 스텝(200ms×2)에
// 딱 맞물려, 한 칸에 "발 한 번" 리듬이 자연스럽게 난다.
const CHAR_ANIM_MS = 100;
const PET_IDLE_MS = 480;    // 펫 idle(통통/꼬리) 2프레임 교차 주기 — 걷기보다 느긋하게
const QUEST_RANGE = 64;     // 표지판 상호작용 근접 반경(px)
const NODE_TALK_RANGE = 96; // 장소 노드/명산 A(말 걸기) 근접 반경(px) — 라벨은 없고 A로 설명 열람

// 팔레트·픽셀맵(16×16 캐릭터·12×16 펫)·시간대 톤은 ./sprites.js로 추출했다
// (GameCanvas 경량화 + 무결성/팔레트 vitest 검증 가능). 여기선 씬이 그걸 굽기만 한다.

// 방향키/코드 → 4방향. (대각선 없음)
function keyToDir(key) {
  switch (key) {
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    default: return null;
  }
}
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const VALID_DIR = new Set(['up', 'down', 'left', 'right']);

function localWorldDebugEnabled() {
  if (typeof window === 'undefined' || !LOCAL_DEBUG_HOSTS.has(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get('worldDebug') === '1';
}

// 결정적(재로드해도 배치 동일) 유사난수 — 나무·장식 흩뿌리기용.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// 타일 좌표 → 결정적 해시(0..1). 장식(나무/꽃/풀숲) 흩뿌리기용 — 재로드해도 배치 동일.
function tileHash(tx, ty) {
  let n = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;
  n ^= n >>> 13; n = Math.imul(n, 0x5bd1e995) >>> 0; n ^= n >>> 15;
  return (n >>> 0) / 0xffffffff;
}

// ── 미니맵 오버레이 ──
// mapData 4타일→1px 다운샘플(112×96) 4색 + 노드 점 + 플레이어 점(깜빡). 캔버스는 1회 굽고
// 짧은 인터벌로 플레이어 점·깜빡임만 다시 얹는다. 씬 pTileX/pTileY 를 직접 읽는다(버스 무오염).
const MINI_FACTOR = 4;
const MINI_SCALE = 2; // 표시 배율(112×96 → 224×192 백킹, CSS 로 화면 폭에 맞춤)
const MINI_COLORS = {
  [TERRAIN.SEA]: [60, 110, 145],
  [TERRAIN.LAND]: [95, 154, 70],
  [TERRAIN.RIVER]: [63, 176, 196],
  [TERRAIN.FENCE]: [166, 67, 47],
  [TERRAIN.MOUNTAIN]: [58, 92, 50],   // 짙은 녹(산지)
  [TERRAIN.PEAK]: [200, 205, 212],    // 회백(설산)
};

// 도시 미니맵 타일색(코드→RGB) — 도시 정밀맵 전용(전국 4색과 별개, 구역 라벨 포함).
const CITY_MINI_COLORS = {
  0: [55, 60, 70],     // road
  1: [213, 203, 181],  // sidewalk
  2: [230, 224, 210],  // crosswalk
  3: [216, 196, 140],  // plaza
  4: [120, 180, 90],   // park
  5: [150, 120, 80],   // bridge
  6: [140, 100, 60],   // dock
  7: [90, 200, 90],    // exit
  8: [60, 130, 170],   // water(바다·항만)
  9: [82, 78, 74],     // building
  10: [110, 165, 80],  // island(섬 실루엣 — 도달 불가 배경)
  11: [63, 122, 106],  // river(강·운하 — 바다보다 탁한 강 톤)
  12: [232, 214, 166], // beach(모래 해변)
  13: [58, 92, 76],    // mountain(산지 — PARK와 구분되는 어두운 청록)
};

function Minimap({ sceneRef, activeScene, onClose }) {
  const canvasRef = useRef(null);
  const city = typeof activeScene === 'string' && activeScene.startsWith('city:')
    ? CITY_DATA[activeScene.slice(5)] : null;

  useEffect(() => {
    // ── 도시 미니맵 — 도시 정밀맵(구역 라벨 포함) ──
    if (city) {
      const grid = city.buildGrid();
      const w = city.cols, h = city.rows;
      const layout = cityMinimapLayout(w, h);
      const sampled = downsampleCityGrid(grid, w, h, layout.factor);
      const off = document.createElement('canvas');
      off.width = sampled.width; off.height = sampled.height;
      const octx = off.getContext('2d');
      const img = octx.createImageData(sampled.width, sampled.height);
      const d = img.data;
      for (let i = 0; i < sampled.codes.length; i++) {
        const c = CITY_MINI_COLORS[sampled.codes[i]] || CITY_MINI_COLORS[1];
        d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      if (city.railways?.mask) {
        octx.fillStyle = '#3d3028';
        for (let index = 0; index < city.railways.mask.length; index += 1) {
          if (!city.railways.mask[index]) continue;
          octx.fillRect(
            Math.floor((index % w) / layout.factor),
            Math.floor(Math.floor(index / w) / layout.factor),
            1,
            1,
          );
        }
      } else if (city.transit?.length) {
        const stops = new Map([...(city.stations || []), ...(city.transitPoints || [])].map((stop) => [stop.id, stop]));
        octx.lineWidth = 1;
        for (const line of city.transit) {
          if (line.mode === 'ferry') continue;
          const points = line.stopIds.map((id) => stops.get(id)?.tile).filter(Boolean);
          if (points.length < 2) continue;
          octx.strokeStyle = '#c66e2c';
          octx.beginPath(); octx.moveTo(points[0][0] / layout.factor, points[0][1] / layout.factor);
          for (const [x, y] of points.slice(1)) octx.lineTo(x / layout.factor, y / layout.factor);
          octx.stroke();
        }
      }
      const W = layout.width, H = layout.height;
      const miniPosition = (tile) => (tile / layout.factor) * CITY_MINI_SCALE;
      const drawFrame = (blinkOn) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, 0, 0, W, H);
        // 구역 라벨.
        ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const z of (city.zones || [])) {
          const lx = miniPosition(z.labelTile[0]), ly = miniPosition(z.labelTile[1]);
          ctx.fillStyle = 'rgba(20,22,26,0.55)';
          const tw = ctx.measureText(z.label).width + 6;
          ctx.fillRect(Math.round(lx - tw / 2), Math.round(ly - 7), Math.round(tw), 13);
          ctx.fillStyle = '#f6edcf';
          ctx.fillText(z.label, Math.round(lx), Math.round(ly));
        }
        // 🚃 전철역 아이콘(청록 점 + 흰 테두리) — 정기 교통 승차 위치 표시.
        for (const st of (city.stations || [])) {
          const sx = miniPosition(st.tile[0]), sy = miniPosition(st.tile[1]);
          ctx.fillStyle = '#f6edcf';
          ctx.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 5, 5);
          ctx.fillStyle = '#2f9ad0';
          ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 3, 3);
        }
        const scene = sceneRef.current;
        if (scene?.vehicleViews) {
          ctx.fillStyle = '#ffe24a';
          for (const [, vehicle] of scene.vehicleViews) {
            const vx = miniPosition(vehicle.x / TILE);
            const vy = miniPosition(vehicle.y / TILE);
            ctx.fillRect(Math.round(vx) - 1, Math.round(vy) - 1, 3, 3);
          }
        }
        // 플레이어 점(노랑, 깜빡).
        const s = scene;
        if (blinkOn && s && Number.isFinite(s.pTileX)) {
          const px = miniPosition(s.pTileX), py = miniPosition(s.pTileY);
          ctx.fillStyle = '#ffe24a';
          ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 4, 4);
        }
      };
      let blinkOn = true;
      drawFrame(blinkOn);
      const timer = setInterval(() => { blinkOn = !blinkOn; drawFrame(blinkOn); }, 260);
      return () => clearInterval(timer);
    }

    // ── 전국 미니맵 — mapData 다운샘플 4색 + 노드 점(도시 소속 노드 제외) ──
    const { w, h, codes } = buildMinimap(MINI_FACTOR);
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d');
    const img = octx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < codes.length; i++) {
      const c = MINI_COLORS[codes[i]] || MINI_COLORS[TERRAIN.SEA];
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    octx.putImageData(img, 0, 0);

    const W = w * MINI_SCALE, H = h * MINI_SCALE;
    const drawFrame = (blinkOn) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, W, H);
      // 노드 점(크림) — 도시 소속(city 필드) 노드는 전국맵에 없으므로 제외.
      ctx.fillStyle = '#fff4cf';
      for (const n of WORLD_NODES) {
        if (n.city) continue;
        const nx = (n.tile[0] / MINI_FACTOR) * MINI_SCALE, ny = (n.tile[1] / MINI_FACTOR) * MINI_SCALE;
        ctx.fillRect(Math.round(nx) - 1, Math.round(ny) - 1, 2, 2);
      }
      // 플레이어 점(노랑, 깜빡).
      const s = sceneRef.current;
      if (blinkOn && s && Number.isFinite(s.pTileX)) {
        const px = (s.pTileX / MINI_FACTOR) * MINI_SCALE, py = (s.pTileY / MINI_FACTOR) * MINI_SCALE;
        ctx.fillStyle = '#ffe24a';
        ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
      }
    };

    let blinkOn = true;
    drawFrame(blinkOn);
    const timer = setInterval(() => { blinkOn = !blinkOn; drawFrame(blinkOn); }, 260);
    return () => clearInterval(timer);
  }, [sceneRef, city]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', background: 'rgba(11,13,8,0.6)' }}>
      <div style={{ ...gbcPanel, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <canvas
          ref={canvasRef}
          style={{ width: 'min(78vw, 240px)', height: 'auto', imageRendering: 'pixelated', display: 'block', borderRadius: 2 }}
        />
        <button
          type="button"
          onClick={onClose}
          style={{ ...gbcButtonPrimary, fontSize: '0.7rem', padding: '3px 10px' }}
        >
          닫기 Ⓑ
        </button>
      </div>
    </div>
  );
}

// controlsRef: GBC 셸(WorldPage)이 D-pad·A·B를 게임에 주입하는 최소 인터페이스.
//   셸 마운트 시 GameCanvas가 controlsRef.current = { press, release, interact, cancel }를 채운다.
//   press/release는 키보드와 동일 경로(씬 heldDirs)로 흘려보내 홀드 연속 이동까지 재사용한다.
//   버스는 오염시키지 않는다(순수 씬 메서드 호출).
export default function GameCanvas({ userId = null, nickname = '나', pet = { key: 'dog', emoji: '🐕', level: 1, mood: 'happy' }, avatar = DEFAULT_AVATAR, controlsRef = null, initialSpawn = null, canAccessPreviewRegions = false, onOpenChapter = null, onOpenReading = null, onOpenDictionary = null, onAvatarChange = null }) {
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);   // 활성 씬 — React가 입력 잠금을 갱신
  const nickRef = useRef(nickname);
  const petRef = useRef(pet);
  const avatarRef = useRef(normalizeWorldAvatar(avatar));
  const canAccessPreviewRegionsRef = useRef(canAccessPreviewRegions);
  // 재접속 스폰 — { scene:'plaza'|'airport', x, y(타일) } | null. WorldScene create()가 읽는다.
  // ref 로 흘려 게임 재생성 없이 최신값을 쓰되, 실제 사용은 씬 생성 1회(mount) 시점에 고정된다.
  const initialSpawnRef = useRef(initialSpawn);
  const { snapshot: worldClock, clockRef: worldClockRef } = useWorldClock();
  const [nearQuest, setNearQuest] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false); // 인게임 즉석 리뷰 오버레이
  const nearQuestRef = useRef(false);   // A(상호작용) 콜백이 최신 근접 상태를 읽도록 미러
  const reviewOpenRef = useRef(false);  // B(취소) 콜백이 최신 오버레이 상태를 읽도록 미러

  // ── 장소 노드 근접 + 페리 + 미니맵 상태 ──
  const [nearNode, setNearNode] = useState(null);        // 근접한 노드 { id, name, desc, gate? } | null
  const [descOpen, setDescOpen] = useState(false);       // A로 연 GBC 설명 박스(게이트 없는 노드)
  const [ferryPrompt, setFerryPrompt] = useState(null);  // 페리 확인 다이얼로그 { toId, toName } | null
  const [minimapOpen, setMinimapOpen] = useState(false); // 미니맵 오버레이 열림
  const [albumOpen, setAlbumOpen] = useState(false);     // 🗾 여행 스탬프 앨범 오버레이 열림
  const albumOpenRef = useRef(false);   // 앨범 열림 동안 A 입력 잠금 + B로 닫기
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const gameMenuOpenRef = useRef(false);
  // ── 도시 정밀맵(계층형 맵) ──
  // cityPrompt: 전국맵 도시 노드 A → "시내로 들어가기" 확인 { to, name } | null
  // activeScene: 활성 씬 식별자('plaza'|'airport'|'city:<id>'|'transsib-corridor') — 오버레이 분기.
  const [cityPrompt, setCityPrompt] = useState(null);
  const [chapterPrompt, setChapterPrompt] = useState(null); // 학습 도어 확인 { chapter|reading, node } | null
  const [activeScene, setActiveScene] = useState('plaza');
  const nearNodeRef = useRef(null);
  const descOpenRef = useRef(false);
  const ferryPromptRef = useRef(null);
  const minimapOpenRef = useRef(false);
  const cityPromptRef = useRef(null);
  const chapterPromptRef = useRef(null);

  // ── 🚃 정기 교통(도시맵 이동 수단, docs §8) ──
  //   nearStation: 근접한 역 { id, nameJa, yomi, line? } | null (A → 행선지 선택 오버레이)
  //   stationSelect: 행선지 선택 오버레이 { cityId, fromId, fromName } | null (B/취소로 항상 닫힘 — 소프트락 방지)
  //   stationToast: 도착 확인 토스트 { nameJa, yomi } | null (짧게 표시 후 자동 소멸)
  const [nearStation, setNearStation] = useState(null);
  const [stationSelect, setStationSelect] = useState(null);
  const [stationToast, setStationToast] = useState(null);
  const [transitStatus, setTransitStatus] = useState(null);
  const nearStationRef = useRef(null);
  const stationSelectRef = useRef(null);
  const activeSceneRef = useRef('plaza');   // interact 콜백(once-effect)이 현재 씬을 읽도록 미러

  // ── 🚆 시베리아 횡단 연결선(장거리 직접 하차) ──
  const [corridorNear, setCorridorNear] = useState(null);
  const [corridorPrompt, setCorridorPrompt] = useState(null);
  const [corridorStatus, setCorridorStatus] = useState(null);
  const corridorPromptRef = useRef(null);

  // ── 🌍 확장 오버월드 지역(① 아시아·태평양 / ② 유럽·지중해·중동) ──
  const [regionNearGate, setRegionNearGate] = useState(null);
  const [regionGatePrompt, setRegionGatePrompt] = useState(null);
  const [regionStatus, setRegionStatus] = useState(null);
  const regionGatePromptRef = useRef(null);

  // ── ✈️ 광장 공항 노드 → 확장 오버월드 항공 허브 ──
  // releaseEligible 지역은 모두에게, preview 지역은 관리자에게만 노출한다. 목적지 선택 뒤에는
  // 도착 좌표 저장이 성공해야 씬을 전환해 공항 좌표가 마지막 영속 위치를 덮지 않게 한다.
  const airDestinationsRef = useRef(overworldAirDestinations({ includePreview: canAccessPreviewRegions }));
  const [airHubPrompt, setAirHubPrompt] = useState(null);
  const [airHubStatus, setAirHubStatus] = useState(null);
  const airHubPromptRef = useRef(null);

  useEffect(() => {
    airDestinationsRef.current = overworldAirDestinations({ includePreview: canAccessPreviewRegions });
    setAirHubPrompt(null);
  }, [canAccessPreviewRegions]);

  // ── NPC 대화 상태 ── npcDialog: { key, node } | null (열림 = 대화 오버레이 표시)
  const [npcDialog, setNpcDialog] = useState(null);
  const npcDialogRef = useRef(null);
  const npcActionRef = useRef(null);  // 셸 A → 현재 스텝의 기본 동작(대사=다음)
  const npcCancelRef = useRef(null);  // 셸 B → say=뜻 토글, 그 외 스텝=대화 나가기(P1-1 소프트락 방지)

  // ── 여행 스탬프 상태 ──
  // stamps: 수집한 노드 id Set(마운트 시 서버에서 로드). newStamp: 방금 획득한 노드 { id, name } | null
  // (GBC 다이얼로그에 "🗾 ○○ 기념 스탬프!" 한 줄 플래시). 중복 수집 안 함(Set 가드).
  // 시맨틱(P2): 스탬프는 보안성 없는 "방문 기념" — 서버(/api/world/stamps)는 실존 노드+본인만
  // 검증하고 방문/완주 여부는 검증하지 않는다(직접 POST 위조 가능). 달성·증명 뉘앙스 금지
  // (문구도 "기념 스탬프"). 학습 달성/보상으로 쓰려면 서버 검증 claim(마스터플랜 A-4 원칙) 필요.
  const [stamps, setStamps] = useState(() => new Set());
  const [newStamp, setNewStamp] = useState(null);
  const stampsRef = useRef(stamps);          // interact 콜백(once-effect)이 최신 Set 을 읽도록 미러
  const collectStampRef = useRef(null);      // 최신 수집 함수 미러(렌더마다 갱신)

  // ── 월드 스토리(공항 씬) 상태 ──
  // storyPhase: 'none'(광장) | 'walking'(줄→심사대) | 'dialogue'(텍스트박스) | 'quiz'(문답) | 'passed'(통과·출구)
  const [storyActive, setStoryActive] = useState(false); // 공항 씬 진입 여부(오버레이 게이팅)
  const [storyPhase, setStoryPhase] = useState('none');
  const [storyIdx, setStoryIdx] = useState(0);           // 현재 텍스트박스 스텝
  const [showKo, setShowKo] = useState(false);           // ja 대사 한국어 뜻 토글
  const storyActiveRef = useRef(false);
  const storyPhaseRef = useRef('none');
  // 셸 A/B 콜백이 최신 스토리 조작을 부르도록 함수 미러(렌더마다 갱신).
  const advanceStoryRef = useRef(null);
  const toggleKoRef = useRef(null);

  useEffect(() => { nickRef.current = nickname || '나'; }, [nickname]);
  useEffect(() => { petRef.current = pet || { key: 'dog', level: 1, mood: 'happy' }; }, [pet]);
  useEffect(() => {
    const next = normalizeWorldAvatar(avatar);
    avatarRef.current = next;
    const game = gameRef.current;
    if (!game) return;
    const candidates = [
      ['pc', game.scene.getScene('world')],
      ['ax_pc', game.scene.getScene('airport')],
      ['ct_pc', Object.values(CITY_DATA).map((city) => game.scene.getScene(`city:${city.id}`)).find((scene) => scene?.textures?.exists('ct_pc_down_n'))],
    ];
    for (const [prefix, scene] of candidates) {
      if (!scene?.textures?.exists(`${prefix}_down_n`)) continue;
      ensureAvatarCharSet(scene, prefix, tonePalette(avatarPalette(next), scene.mode || 'day'), { replace: true });
    }
  }, [avatar]);
  useEffect(() => { initialSpawnRef.current = initialSpawn; }, [initialSpawn]);
  useEffect(() => { canAccessPreviewRegionsRef.current = canAccessPreviewRegions; }, [canAccessPreviewRegions]);
  useEffect(() => { nearQuestRef.current = nearQuest; }, [nearQuest]);
  useEffect(() => { reviewOpenRef.current = reviewOpen; }, [reviewOpen]);
  useEffect(() => { nearNodeRef.current = nearNode; }, [nearNode]);
  useEffect(() => { descOpenRef.current = descOpen; }, [descOpen]);
  // 노드에서 멀어지면(근접 해제) 설명 박스도 닫는다.
  useEffect(() => { if (!nearNode) setDescOpen(false); }, [nearNode]);
  useEffect(() => { ferryPromptRef.current = ferryPrompt; }, [ferryPrompt]);
  useEffect(() => { minimapOpenRef.current = minimapOpen; }, [minimapOpen]);
  useEffect(() => { albumOpenRef.current = albumOpen; }, [albumOpen]);
  useEffect(() => { gameMenuOpenRef.current = gameMenuOpen; }, [gameMenuOpen]);
  useEffect(() => { cityPromptRef.current = cityPrompt; }, [cityPrompt]);
  useEffect(() => { chapterPromptRef.current = chapterPrompt; }, [chapterPrompt]);
  useEffect(() => { nearStationRef.current = nearStation; }, [nearStation]);
  useEffect(() => { stationSelectRef.current = stationSelect; }, [stationSelect]);
  useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);
  useEffect(() => { corridorPromptRef.current = corridorPrompt; }, [corridorPrompt]);
  useEffect(() => { regionGatePromptRef.current = regionGatePrompt; }, [regionGatePrompt]);
  useEffect(() => { airHubPromptRef.current = airHubPrompt; }, [airHubPrompt]);
  // 역에서 멀어지면 열려 있던 행선지 오버레이도 닫는다(근접 해제 = 취소).
  useEffect(() => { if (!nearStation) setStationSelect(null); }, [nearStation]);
  // 도착 확인 토스트는 잠시 뒤 자동으로 걷힌다.
  useEffect(() => {
    if (!stationToast) return undefined;
    const t = setTimeout(() => setStationToast(null), 1800);
    return () => clearTimeout(t);
  }, [stationToast]);
  useEffect(() => {
    if (!['arrived', 'missed'].includes(transitStatus?.state)) return undefined;
    const timer = setTimeout(() => setTransitStatus(null), 2600);
    return () => clearTimeout(timer);
  }, [transitStatus]);
  useEffect(() => { npcDialogRef.current = npcDialog; }, [npcDialog]);
  useEffect(() => { storyActiveRef.current = storyActive; }, [storyActive]);
  useEffect(() => { storyPhaseRef.current = storyPhase; }, [storyPhase]);
  useEffect(() => { stampsRef.current = stamps; }, [stamps]);

  // 수집 상태 로드(마운트/계정별 1회) — 실패면 조용히 빈 Set 유지.
  useEffect(() => {
    let cancelled = false;
    loadStamps().then((ids) => { if (!cancelled) setStamps(new Set(ids)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  // 노드 첫 방문 스탬프 수집 — 렌더마다 최신본을 ref 에 심어 interact/버튼 콜백이 참조한다.
  //   이미 수집한 노드면 무시(중복 없음). 낙관 갱신(즉시 Set 추가·플래시) 후 서버 upsert(실패 조용히).
  collectStampRef.current = (node) => {
    if (!node || stampsRef.current.has(node.id)) return;
    setStamps((prev) => { const next = new Set(prev); next.add(node.id); return next; });
    setNewStamp({ id: node.id, name: node.name });
    collectStamp(node.id);
  };

  // "획득!" 플래시는 잠시 뒤 자동으로 걷힌다.
  useEffect(() => {
    if (!newStamp) return undefined;
    const t = setTimeout(() => setNewStamp(null), 3500);
    return () => clearTimeout(t);
  }, [newStamp]);

  // ── GBC 셸 입력 주입 인터페이스 등록 ──
  // press/release → 씬 heldDirs(키보드와 동일 경로).
  // A(interact): 대사 중이면 "다음", 광장 게이트 근접이면 공항 진입, 표지판 근접이면 리뷰.
  // B(cancel): 대사 중이면 한국어 뜻 토글, 리뷰 열려 있으면 닫기.
  useEffect(() => {
    if (!controlsRef) return undefined;
    controlsRef.current = {
      press: (dir) => sceneRef.current?.extInputDown?.(dir),
      release: (dir) => sceneRef.current?.extInputUp?.(dir),
      // B 홀드 → 달리기 스위치(씬 플래그). 씬이 스텝 시작 시에만 소비하므로 탭 취소와 충돌하지 않는다.
      runOn: () => { if (sceneRef.current) sceneRef.current.runHeld = true; },
      runOff: () => { if (sceneRef.current) sceneRef.current.runHeld = false; },
      interact: () => {
        if (gameMenuOpenRef.current) return;
        if (airHubStatus?.phase === 'saving') return;
        // 🗾 앨범 열림 중 A → 최우선 무시(닫기는 칩/B/ESC). 숨은 배경 오버레이가 A를 가로채지 않게 맨 앞에서 소비.
        if (albumOpenRef.current) return;
        if (npcDialogRef.current) { npcActionRef.current?.(); return; } // NPC 대화 중 A → 다음 대사
        if (storyPhaseRef.current === 'dialogue') { advanceStoryRef.current?.(); return; }
        if (reviewOpenRef.current || storyActiveRef.current || ferryPromptRef.current || cityPromptRef.current || chapterPromptRef.current) return;
        if (corridorPromptRef.current) return;
        if (regionGatePromptRef.current) return;
        if (airHubPromptRef.current) return;
        if (activeSceneRef.current === 'transsib-corridor') { sceneRef.current?.corridorInteract?.(); return; }
        if (activeSceneRef.current.startsWith('overworld:')) { sceneRef.current?.regionInteract?.(); return; }
        if (activeSceneRef.current === MSM_ABBEY_SCENE_KEY) { sceneRef.current?.abbeyInteract?.(); return; }
        if (stationSelectRef.current) return; // 행선지 오버레이는 버튼으로 선택(B로 닫기) — A는 무시
        if (descOpenRef.current) { setDescOpen(false); return; } // 설명 박스 열려 있으면 A로도 닫기
        const node = nearNodeRef.current;
        // 🚃 역 근접(상호작용 노드가 A를 가져가지 않을 때) → 행선지 선택 오버레이.
        const st = nearStationRef.current;
        if (st && !node) {
          const cityId = typeof activeSceneRef.current === 'string' && activeSceneRef.current.startsWith('city:')
            ? activeSceneRef.current.slice(5) : null;
          if (cityId) { setStationSelect({ cityId, fromId: st.id, fromName: st.nameJa }); return; }
        }
        if (node?.openNow === false) { setDescOpen(true); return; }
        // A-2 독해 도어는 관리자 파일럿에 콜백이 열린 경우에만 활성화한다.
        // 일반 학습자에게는 같은 노드를 기존 설명 표지로 남겨 막힌 관리자 경로를 노출하지 않는다.
        if (node?.reading && onOpenReading) { setChapterPrompt({ reading: node.reading, node }); return; }
        // 문화 도어는 NPC 대화보다 우선한다. 확인 후 문법 챕터로 이동한다.
        if (node?.chapter) { setChapterPrompt({ chapter: node.chapter, node }); return; }
        // NPC 노드는 대화 오버레이를 연다(스탬프는 대화 완주 시 — 여기서 수집하지 않는다).
        if (node?.npc) { setNpcDialog({ key: node.npc, node }); return; }
        // 노드 첫 상호작용이면 스탬프 수집 — 단 noStamp(도시 파사드 등 실존 노드 아님)는 제외.
        if (node && !node.noStamp) collectStampRef.current?.(node);
        if (node?.gate) {
          // 게이트 있는 노드는 게이트 동작 우선(설명은 게이트 프롬프트에 병기).
          if (node.gate.type === 'story-scene') {
            if (node.gate.scene === 'airport') {
              const destinations = airDestinationsRef.current;
              if (destinations.length > 0) {
                setAirHubPrompt({ node, destinations });
                return;
              }
              sceneRef.current?.enterAirport?.();
            } else {
              sceneRef.current?.enterStoryScene?.(node.gate.scene);
            }
            return;
          }
          if (node.gate.type === 'ferry') {
            const dest = getNode(node.gate.to);
            setFerryPrompt({ toId: node.gate.to, toName: dest?.name || '' });
            return;
          }
          if (node.gate.type === 'city') { setCityPrompt({ to: node.gate.to, name: node.name }); return; }
        }
        if (node) { setDescOpen(true); return; } // 게이트 없는 노드/명산 → GBC 설명 박스
        if (nearQuestRef.current) setReviewOpen(true);
      },
      cancel: () => {
        if (gameMenuOpenRef.current) { setGameMenuOpen(false); return; }
        if (activeSceneRef.current === MSM_ABBEY_SCENE_KEY) { sceneRef.current?.abbeyCancel?.(); return; }
        if (albumOpenRef.current) { setAlbumOpen(false); return; } // 🗾 앨범 최우선 닫기(숨은 배경 오버레이보다 먼저)
        if (npcDialogRef.current) { npcCancelRef.current?.(); return; } // NPC 대화 중 B → 뜻 토글
        if (storyPhaseRef.current === 'dialogue') { toggleKoRef.current?.(); return; }
        if (descOpenRef.current) { setDescOpen(false); return; }
        if (stationSelectRef.current) { setStationSelect(null); return; } // 🚃 행선지 오버레이 나가기(소프트락 방지)
        if (ferryPromptRef.current) { setFerryPrompt(null); return; }
        if (cityPromptRef.current) { setCityPrompt(null); return; }
        if (chapterPromptRef.current) { setChapterPrompt(null); return; }
        if (corridorPromptRef.current) { setCorridorPrompt(null); return; }
        if (regionGatePromptRef.current) { setRegionGatePrompt(null); return; }
        if (airHubPromptRef.current) { setAirHubPrompt(null); return; }
        if (corridorStatus?.phase === 'error') { setCorridorStatus(null); return; }
        if (regionStatus?.phase === 'error' && !regionStatus?.preview) { setRegionStatus(null); return; }
        if (airHubStatus?.phase === 'error') { setAirHubStatus(null); return; }
        if (minimapOpenRef.current) { setMinimapOpen(false); return; }
        if (reviewOpenRef.current) setReviewOpen(false);
      },
    };
    return () => { if (controlsRef) controlsRef.current = null; };
  }, [controlsRef, onOpenChapter, onOpenReading, corridorStatus?.phase, regionStatus?.phase, regionStatus?.preview, airHubStatus?.phase]);

  // ── 스토리 조작(대사 진행·뜻 토글) — 셸 A/B 콜백이 참조하도록 ref에 최신본을 심는다 ──
  const advanceStory = () => {
    setShowKo(false);
    setStoryIdx((i) => {
      if (i + 1 >= STORY_STEPS.length) { setStoryPhase('quiz'); return i; } // 대사 끝 → 심사관 문답
      return i + 1;
    });
  };
  advanceStoryRef.current = advanceStory;
  toggleKoRef.current = () => setShowKo((v) => !v);

  // 대사 스텝이 바뀔 때 연출: 화자 시선 전환 + 도장 장면 가벼운 흔들림(파티클 없음).
  useEffect(() => {
    if (storyPhase !== 'dialogue') return;
    const step = STORY_STEPS[storyIdx];
    if (!step) return;
    if (step.kind === 'speech') sceneRef.current?.faceForDialogue?.();
    if (step.stamp) sceneRef.current?.stampShake?.();
  }, [storyPhase, storyIdx]);

  // 스토리 페이즈 → 씬 입력 잠금(대사·문답 중 이동 정지, 걷기·통과 후엔 해제).
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !storyActive) return;
    scene.inputLocked = (storyPhase === 'dialogue' || storyPhase === 'quiz');
  }, [storyPhase, storyActive]);

  // 통과 기록 — 본편 R3 handlePass와 동일 규약(같은 데이터 공유, 본편 트랙 UI는 존치).
  // async 로 원격 upsert 성공을 확인하고 반환한다: AirportQuiz.savePass 가 await 해서 성공 후에만
  // 통과 화면·출구를 열고, 실패(reject)면 재시도 UI 를 띄운다(P2-7·P2-8).
  const recordPass = async (events) => {
    // userId를 넘겨 사용자 스코프 키에 기록 — 게스트 키에 남기면 로그아웃→타 계정 로그인 시
    // 승계 루프가 진도를 복제한다(Codex P2-7). 계정 전환은 WorldPage 가 GameCanvas 를 userId 로
    // key remount 해 진행 중 AirportQuiz 를 통째로 폐기하므로, 이 recordPass 의 userId 는 항상 현재 계정이다.
    markReadingPassedLocal(READING_TEXT_ID, userId);
    if (userId) {
      const ok = await markReadingPassedRemote(userId, READING_TEXT_ID);
      if (!ok) throw new Error('reading pass upsert failed'); // {error} → savePass 재시도(재-push)
      logReviewEvents(userId, events); // AirportQuiz→buildReadingEvents 산출물 — lang:'Japanese', source:'reading'
      enqueueGrammarReview(userId, READING_LANG, readingSlug(READING_TEXT_ID));
    }
    setStoryPhase('passed');
    sceneRef.current?.openExit?.(); // 출구 게이트 열림 연출
  };

  // 리뷰·페리 확인·NPC 대화·앨범 등 전체 화면 오버레이가 열리면 게임 입력을 잠근다(캔버스 이동 정지).
  // 닫히면 해제. 잠글 때 heldDirs/tapTile/runHeld 를 비워 오버레이 뒤로 이동이 새지 않게 한다(Codex #91 P1).
  // (미니맵만 예외 — 살짝 훑어보는 오버레이라 이동을 막지 않는다. 앨범은 전체 모달이라 잠근다.)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const lock = reviewOpen || !!ferryPrompt || !!npcDialog || !!cityPrompt || !!chapterPrompt
      || !!stationSelect || !!corridorPrompt || !!regionGatePrompt || !!airHubPrompt
      || airHubStatus?.phase === 'saving' || albumOpen || gameMenuOpen;
    const locked = lock || !!scene.railTrip;
    scene.inputLocked = locked;
    if (locked) { if (scene.heldDirs) scene.heldDirs.length = 0; scene.tapTile = null; scene.runHeld = false; }
  }, [reviewOpen, ferryPrompt, npcDialog, cityPrompt, chapterPrompt, stationSelect, corridorPrompt, regionGatePrompt, airHubPrompt, airHubStatus?.phase, albumOpen, gameMenuOpen]);

  useEffect(() => {
    let destroyed = false;
    let game = null;
    let ro = null;    // 캔버스 정수 배율 피팅용 ResizeObserver
    let debugBridge = null;

    // ── 버스 구독을 컴포넌트 스코프에서 등록/해제한다(리스너 누수 방지). ──
    // 기존엔 씬 'shutdown'에서 off 했지만 Phaser destroy 경로에서 shutdown이 안 뜰 수 있어,
    // 재방문마다 죽은 씬 콜백이 bus에 누적됐다. 이제 React cleanup이 off를 직접 보장한다.
    // 활성 씬(광장·공항·도시)에 위임 — 공항 씬도 quest:scored/done 연출을 받는다(옵셔널 체이닝으로 무해).
    // ── 씬 전환 직후 음성 잔류 차단(Codex P1-2) ──
    // 씬 shutdown 은 렌더 피어를 지우지만, 새 씬은 다음 'peers:update' 까지 peers/otherScenePeerIds 가
    // 비어 emitPeerDistances 가 {} 만 emit 한다 — WorldPage 거리 수신부는 전달된 key 만 갱신하므로
    // 이전 씬에서의 근거리 값이 voice 에 남는다(상대가 백그라운드면 stale 정리까지 최대 10초 음성 지속).
    // 해법: 최신 피어 스냅샷을 캐시해 두고, 각 씬 create 말미(onReady)에 ① 스냅샷을 새 씬에 즉시
    // 재적용(applyPeers — 같은 씬 피어 렌더 + 타 씬 id 는 otherScenePeerIds)하고 ② 전체 키를 1회
    // emit(emitPeerDistances — 같은 씬=실거리 · 타 씬=Infinity)한다. 첫 프레임부터 거리가 올바르다.
    let latestPeersSnapshot = null;
    const onPeers = (data) => { latestPeersSnapshot = data; sceneRef.current?.applyPeers?.(data); };
    const resetScenePeers = () => {
      const scene = sceneRef.current;
      if (!scene || latestPeersSnapshot == null) return;
      scene.applyPeers?.(latestPeersSnapshot);
      if (scene.player) emitPeerDistances(scene, bus); // 전체 키 1회 emit(씬 전환 직후 보장)
    };
    const onQuestScored = (data) => sceneRef.current?.questScoredFx?.(data);
    const onQuestDone = (data) => sceneRef.current?.questDoneFx?.(data);
    // 채팅 메시지 → 해당 유저 캐릭터 위 3초 도트 말풍선(공항 씬엔 메서드 없어 옵셔널 체이닝으로 무해).
    const onChatMsg = (m) => { if (m) sceneRef.current?.showChatBubble?.(m.userId, m.text); };
    bus.on('peers:update', onPeers);
    bus.on('quest:scored', onQuestScored);
    bus.on('quest:done', onQuestDone);
    bus.on('chat:msg', onChatMsg);

    (async () => {
      const Phaser = (await import('phaser')).default;
      if (destroyed || !hostRef.current) return;

      class WorldScene extends Phaser.Scene {
        constructor() { super('world'); }

        // ── 픽셀맵을 1px 단위 fillRect로 그린다 ──
        drawMap(g, rows, pal) {
          for (let y = 0; y < rows.length; y++) {
            const row = rows[y];
            for (let x = 0; x < row.length; x++) {
              const col = pal[row[x]];
              if (col == null) continue; // '.'·미정의 = 투명
              g.fillStyle(col, 1);
              g.fillRect(x, y, 1, 1);
            }
          }
        }

        makeTex(key, rows, pal, w, h) {
          const g = this.make.graphics({ add: false });
          this.drawMap(g, rows, pal);
          g.generateTexture(key, w, h);
          g.destroy();
        }

        preload() {
          // 지형은 주간 팔레트로 고정하고 글로벌 월드 시각은 런타임 조명으로 표현한다.
          // 장시간 접속해도 시간대 경계에서 다시 들어올 필요 없이 모든 플레이어가 같은 빛을 본다.
          this.mode = 'day';
          this.pal = tonePalette(BASE_TILE_PAL, this.mode);
          this.charPal = {
            pc: tonePalette(avatarPalette(avatarRef.current), this.mode),
            pr: tonePalette(CHAR_PAL_REMOTE, this.mode),
          };
          this.petPal = {};
          for (const k of PET_KEYS) this.petPal[k] = tonePalette(PET_PAL[k], this.mode);

          this.buildGround();
          this.buildRiver();      // 강 오토타일 16변형(땅+물줄기) — 아틀라스 15..30
          this.buildSand();
          this.buildFence();
          this.buildBridge();
          this.buildTerrain();    // 산지·고산(설산)·평야 질감 타일(순수 시각 · 통행 가능)
          this.buildTree();
          this.buildDecor();
          this.buildBoat();       // 페리 항해·물 위 피어 배 도트
          this.buildSign();
          this.buildNodeMarkers();
          this.buildNpcMarkers();  // NPC 대화 노드 전용 도트(worldNodes npc 필드 → t_npc_<key>)
          this.buildGourmetMarker();  // 맛집 노드 공용 마커(worldNodes gourmet 필드 → t_gourmet)
          this.buildNamedPeaks();  // 명산 전용 도트 조각(worldNodes peak 필드 → t_peak_<peak>)
          this.buildHeart();
          this.buildLamp();
          this.buildCharSet('pc', this.charPal.pc);
          this.buildCharSet('pr', this.charPal.pr);
          this.buildPets();
        }

        // 잔디/흙길/물(3프레임 물결) — 전부 픽셀 절차 생성(this.pal = 시간대 톤).
        buildGround() {
          const C = this.pal;
          const dither = (seed) => {
            const rng = makeRng(seed); const pts = [];
            for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) if (rng() < 0.14) pts.push([x, y]);
            return pts;
          };
          // grass
          {
            const g = this.make.graphics({ add: false });
            g.fillStyle(C.grass1, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(C.grass2, 1); for (const [x, y] of dither(0x11)) g.fillRect(x, y, 1, 1);
            g.fillStyle(C.grass3, 1); g.fillRect(3, 4, 1, 2); g.fillRect(10, 7, 1, 2); g.fillRect(6, 12, 1, 2); g.fillRect(13, 2, 1, 2);
            g.generateTexture('t_grass', TEX, TEX); g.destroy();
          }
          // path (dirt) — 가장자리 살짝 어둡게
          {
            const g = this.make.graphics({ add: false });
            g.fillStyle(C.path1, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(C.path2, 1); for (const [x, y] of dither(0x22)) g.fillRect(x, y, 1, 1);
            g.fillStyle(C.pathE, 0.5);
            g.fillRect(0, 0, TEX, 1); g.fillRect(0, TEX - 1, TEX, 1); g.fillRect(0, 0, 1, TEX); g.fillRect(TEX - 1, 0, 1, TEX);
            g.generateTexture('t_path', TEX, TEX); g.destroy();
          }
          // water — 물결 하이라이트가 아래로 흐르는 3프레임(shift로 y 이동).
          const water = (key, base, shift) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(base, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(C.water2, 0.9);
            const y1 = 3 + shift, y2 = 10 + shift;
            g.fillRect(2, y1, 5, 1); g.fillRect(9, y1 + 1, 4, 1);
            g.fillRect(6, y2, 5, 1); g.fillRect(1, y2 + 1, 3, 1);
            g.generateTexture(key, TEX, TEX); g.destroy();
          };
          water('t_water0', C.water1, 0);
          water('t_water1', C.waterMd, 1);
          water('t_water2', C.waterDk, 2);

          // lake — 걸어서 건너는 얕은 물(고인 물). 바다보다 밝고 옅은 청록 단일 프레임(정적).
          //   강(RIVER)은 더 이상 타일 전체 물이 아니라 buildRiver 의 "땅+물줄기" 오토타일로 굽는다.
          const lakeBase = toneColor(0x63c1e2, this.mode);   // 호수 — 옅은 청록
          const shallowHi = C.water2;                        // 흰 물결 하이라이트(바다와 공유 톤)
          {
            const g = this.make.graphics({ add: false });
            g.fillStyle(lakeBase, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(shallowHi, 0.7);
            g.fillRect(2, 4, 6, 1); g.fillRect(9, 8, 4, 1); g.fillRect(4, 11, 5, 1);
            g.generateTexture('t_lake', TEX, TEX); g.destroy();
          }
        }

        // ── 강(RIVER) 오토타일 — 땅 바탕 + 폭 3px 도트 물줄기(16변형) ──
        // 4방향 이웃 연결 비트마스크(0..15)마다 riverStreamRects(순수)로 물줄기 사각형을 받아 굽는다.
        //   땅 바탕은 잔디 톤(주변 육지와 이음새 연속) — 강은 "타일 전체 물"이 아니라 굽이치는 물줄기로 보인다.
        //   물줄기는 변 중앙(세로 cols6~8·가로 rows6~8)에서 이웃과 만나 끊기지 않고 이어진다. 통행 규칙 무변경.
        buildRiver() {
          const C = this.pal;
          const water = toneColor(0x5bb8e6, this.mode);   // 물줄기 — 바다보다 밝은 청록
          const waterD = toneColor(0x3f9fce, this.mode);  // 물줄기 가장자리 음영(오른·아래)
          const foam = C.water2;                          // 흰 반짝(흐름 힌트)
          for (let mask = 0; mask < 16; mask++) {
            const g = this.make.graphics({ add: false });
            // 땅 바탕(잔디 톤 + 미세 얼룩) — t_grass 와 톤 연속.
            g.fillStyle(C.grass1, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(C.grass2, 0.5);
            for (const [x, y] of [[2, 3], [12, 2], [4, 13], [13, 11]]) g.fillRect(x, y, 1, 1);
            const rects = riverStreamRects(mask);
            // 음영을 먼저 깔고 그 위에 밝은 물을 1px 안쪽으로 → 오른·아래에 얕은 뚝(둑) 그림자.
            g.fillStyle(waterD, 1);
            for (const [x, y, w, h] of rects) g.fillRect(x, y, w, h);
            g.fillStyle(water, 1);
            for (const [x, y, w, h] of rects) g.fillRect(x, y, Math.max(1, w - 1), Math.max(1, h - 1));
            // 흐름 반짝(연결된 축 방향에만) — 굽이치는 물줄기 느낌.
            g.fillStyle(foam, 0.8);
            if ((mask & RIVER_N) || (mask & RIVER_S)) { g.fillRect(7, 4, 1, 1); g.fillRect(7, 11, 1, 1); }
            if ((mask & RIVER_E) || (mask & RIVER_W)) { g.fillRect(4, 7, 1, 1); g.fillRect(11, 7, 1, 1); }
            g.fillRect(7, 7, 1, 1);
            g.generateTexture(`t_river_${mask}`, TEX, TEX); g.destroy();
          }
        }

        // DMZ 철조망(fence) — 통행 차단. 기둥 + 가시철선 도트 1타일 패턴(위압감 있게).
        buildFence() {
          const C = this.pal;
          const rust = toneColor(0x8a4a34, this.mode);   // 녹슨 적갈(기둥·가시)
          const rustD = toneColor(0x5e3122, this.mode);  // 그림자
          const wire = toneColor(0xbdb6a6, this.mode);   // 철선(밝은 금속)
          const g = this.make.graphics({ add: false });
          g.fillStyle(C.path2, 0.35); g.fillRect(0, 0, TEX, TEX);         // 흙 바탕(살짝)
          // 세로 기둥 2개(좌/우).
          g.fillStyle(rustD, 1); g.fillRect(3, 1, 2, 14); g.fillRect(11, 1, 2, 14);
          g.fillStyle(rust, 1); g.fillRect(3, 1, 1, 14); g.fillRect(11, 1, 1, 14);
          // 가로 철선 3줄.
          g.fillStyle(wire, 1);
          g.fillRect(0, 3, TEX, 1); g.fillRect(0, 8, TEX, 1); g.fillRect(0, 13, TEX, 1);
          // 가시(철선 위 X 도트) — 위압감.
          g.fillStyle(rust, 1);
          for (const x of [1, 6, 9, 14]) { g.fillRect(x, 2, 1, 1); g.fillRect(x, 4, 1, 1); }
          for (const x of [3, 8, 12]) { g.fillRect(x, 7, 1, 1); g.fillRect(x, 9, 1, 1); }
          g.generateTexture('t_fence', TEX, TEX); g.destroy();
        }

        // 교량(bridge) — 바다 위 통행 데크. 나무/콘크리트 데크 판자 + 양옆 난간.
        buildBridge() {
          const deck = toneColor(0xb89058, this.mode);   // 데크(웜 탠)
          const deckD = toneColor(0x8a6538, this.mode);  // 판자 이음새
          const rail = toneColor(0x6f4a28, this.mode);   // 난간
          const g = this.make.graphics({ add: false });
          g.fillStyle(deck, 1); g.fillRect(0, 0, TEX, TEX);
          g.fillStyle(deckD, 1);                          // 가로 판자 이음새
          for (let y = 2; y < TEX; y += 4) g.fillRect(0, y, TEX, 1);
          g.fillStyle(rail, 1);                           // 양옆 난간(세로)
          g.fillRect(0, 0, 1, TEX); g.fillRect(TEX - 1, 0, 1, TEX);
          g.generateTexture('t_bridge', TEX, TEX); g.destroy();
        }

        // ── 지형 질감 타일(순수 시각 · 전부 통행 가능) ──
        // 산지(짙은 녹 능선+음영 도트) · 고산/설산(회백 암석+흰 설관) · 평야(밝은 황록 농지 격자 힌트).
        // toneColor 로 시간대 톤을 함께 굽는다 — 밤이면 설산이 푸르스름해지는 것은 톤 함수가 알아서 한다.
        buildTerrain() {
          // ── 산지 3종 변형(능선 방향·밀도 차이) — 타일 좌표 해시로 골라 롤러 자국 같은 단조로움 제거. ──
          const mBase = toneColor(0x4f7a3a, this.mode);    // 산기슭 녹
          const mRidge = toneColor(0x35602b, this.mode);   // 능선 그림자(짙은 녹)
          const mHi = toneColor(0x6fa048, this.mode);      // 능선 양지
          // 삼각 능선 하나 — 정점(ax,ay)에서 아래로 h줄 계단 도트, hiSide 사면에 양지 하이라이트.
          const ridgeTri = (g, ax, ay, h, hiSide) => {
            g.fillStyle(mRidge, 1);
            for (let i = 0; i < h; i++) g.fillRect(ax - i, ay + i, 1 + i * 2, 1);
            g.fillStyle(mHi, 1);
            for (let i = 0; i < h - 2; i++) g.fillRect(hiSide === 'l' ? ax - i : ax + i, ay + i, 1, 1);
          };
          const mtn = (key, draw) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(mBase, 1); g.fillRect(0, 0, TEX, TEX);
            draw(g);
            g.generateTexture(key, TEX, TEX); g.destroy();
          };
          mtn('t_mountain', (g) => {                        // A: 좌향 단일 능선(중밀도) — 기존 톤
            ridgeTri(g, 8, 4, 8, 'l');
            g.fillStyle(mRidge, 1);
            for (const [x, y] of [[3, 12], [11, 13], [6, 14], [13, 10], [2, 9]]) g.fillRect(x, y, 1, 1);
          });
          mtn('t_mountain_b', (g) => {                      // B: 쌍봉(트윈) + 고밀도 음영(울창한 숲)
            ridgeTri(g, 5, 6, 6, 'l');
            ridgeTri(g, 11, 3, 9, 'r');
            g.fillStyle(mRidge, 1);
            for (const [x, y] of [[2, 11], [4, 14], [7, 13], [9, 15], [12, 12], [14, 14], [1, 13], [6, 10]]) g.fillRect(x, y, 1, 1);
          });
          mtn('t_mountain_c', (g) => {                      // C: 우향 낮은 능선(저밀도 · 완만)
            ridgeTri(g, 9, 6, 6, 'r');
            g.fillStyle(mRidge, 1);
            for (const [x, y] of [[4, 13], [12, 14], [8, 12]]) g.fillRect(x, y, 1, 1);
          });
          // 고산/설산 — 회백 암석 + 흰 설관.
          {
            const g = this.make.graphics({ add: false });
            const rock = toneColor(0x8a8f98, this.mode);   // 회백 암석
            const rockD = toneColor(0x5f636b, this.mode);  // 암석 그림자
            const snow = toneColor(0xf2f5fa, this.mode);   // 설관(흰)
            const snowD = toneColor(0xcdd6e2, this.mode);  // 설관 음영
            g.fillStyle(rock, 1); g.fillRect(0, 0, TEX, TEX);
            g.fillStyle(rockD, 1);
            for (const [x, y] of [[2, 11], [5, 13], [9, 12], [12, 14], [7, 10]]) g.fillRect(x, y, 2, 1); // 하부 암석 음영
            g.fillStyle(snow, 1);
            for (let i = 0; i < 6; i++) g.fillRect(8 - i, 1 + i, 1 + i * 2, 1); // 설관 삼각(상부)
            g.fillStyle(snowD, 1);
            for (let i = 0; i < 6; i++) g.fillRect(8 + i, 1 + i, 1, 1);         // 오른 사면 음영
            g.generateTexture('t_peak', TEX, TEX); g.destroy();
          }
          // 평야 — 밝은 황록 단색 + 미세 노이즈만(밭이랑 격자 제거 — 해안 "체크무늬"의 주범이었다).
          //   격자 라인을 없애고 잔디와 톤이 이어지는 부드러운 얼룩으로 바꿔 타일 이음새가 두드러지지 않게 한다.
          {
            const g = this.make.graphics({ add: false });
            const base = toneColor(0x9fc85a, this.mode);   // 밝은 황록(단색 바탕)
            const n1 = toneColor(0x93bd4e, this.mode);     // 살짝 진한 미세 노이즈
            const n2 = toneColor(0xaad066, this.mode);     // 살짝 밝은 미세 노이즈
            g.fillStyle(base, 1); g.fillRect(0, 0, TEX, TEX);
            const rng = makeRng(0x5a);
            g.fillStyle(n1, 1);
            for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) if (rng() < 0.10) g.fillRect(x, y, 1, 1);
            g.fillStyle(n2, 1);
            for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) if (rng() < 0.06) g.fillRect(x, y, 1, 1);
            g.generateTexture('t_plain', TEX, TEX); g.destroy();
          }
        }

        // ── 명산(名山) 전용 도트 조각 — 지정 8명산에 개별 실루엣 스프라이트. ──
        // worldNodes 의 peak 필드(baekdu·geumgang·seorak·bukhan·jiri·halla·fuji·aso)를 키로 t_peak_<peak>
        // 텍스처를 굽는다. 마커(노드)로 오버레이되며(≤8 스프라이트), 타일맵을 오염시키지 않는다.
        // 규격: 16×24(노드 마커와 동일 · origin 하단중앙). 후지산만 상징성 위해 32×28(2타일 폭 허용).
        buildNamedPeaks() {
          const rock = toneColor(0x8a8f98, this.mode);   // 회백 암석
          const rockD = toneColor(0x5f636b, this.mode);  // 암석 그림자
          const snow = toneColor(0xf2f5fa, this.mode);   // 설관(흰)
          const snowD = toneColor(0xcdd6e2, this.mode);  // 설관 음영
          const forest = toneColor(0x3f7030, this.mode); // 완만 명산 산체(녹)
          const forestD = toneColor(0x2c5222, this.mode);
          const lake = toneColor(0x2f74c8, this.mode);   // 백두산 천지 칼데라
          const granite = toneColor(0xbcae93, this.mode);// 북한산 화강암 돔
          const graniteD = toneColor(0x8c7d61, this.mode);
          const smoke = toneColor(0xbfb7ab, this.mode);  // 아소 분연

          // 삼각 원뿔 — 정점(cx,topY)에서 botY까지 매 줄 grow px씩 좌우로 벌어지는 채움.
          const cone = (g, color, cx, topY, botY, grow = 1) => {
            g.fillStyle(color, 1);
            let half = 0;
            for (let y = topY; y <= botY; y++) { g.fillRect(Math.round(cx - half), y, Math.round(half * 2) + 1, 1); half += grow; }
          };
          // 침봉(뾰족 암탑) — x위치·높이 다발. snowTip 이면 끝에 눈 픽셀.
          const spires = (g, base, botY, cols, snowTip) => {
            for (const [x, h] of cols) {
              g.fillStyle(base, 1); g.fillRect(x, botY - h, 2, h);
              g.fillStyle(rockD, 1); g.fillRect(x + 1, botY - h, 1, h);
              if (snowTip) { g.fillStyle(snow, 1); g.fillRect(x, botY - h, 2, 1); }
            }
          };
          const mk = (key, w, h, draw) => {
            const g = this.make.graphics({ add: false });
            draw(g, w, h);
            g.generateTexture(key, w, h); g.destroy();
          };
          const W = TEX, H = TEX + 8; // 16×24

          // 백두산 — 천지 칼데라: 회백 산체 + 설관 + 정상 파란 호수 픽셀.
          mk('t_peak_baekdu', W, H, (g) => {
            cone(g, rock, 8, 7, 23, 1);
            cone(g, snow, 8, 7, 13, 1);
            g.fillStyle(rockD, 1); g.fillRect(6, 8, 1, 1); g.fillRect(10, 8, 1, 1); // 칼데라 벽
            g.fillStyle(lake, 1); g.fillRect(7, 8, 3, 2);                            // 천지
          });
          // 금강산 — 기암 침봉(회백 뾰족 다발), 눈 없음.
          mk('t_peak_geumgang', W, H, (g) => {
            cone(g, rockD, 8, 14, 23, 1.4);
            spires(g, rock, 22, [[2, 8], [5, 12], [8, 15], [11, 11], [13, 7]], false);
          });
          // 설악산 — 침봉 + 설관(끝에 눈).
          mk('t_peak_seorak', W, H, (g) => {
            cone(g, rockD, 8, 13, 23, 1.4);
            spires(g, rock, 22, [[2, 7], [5, 11], [8, 14], [11, 12], [13, 8]], true);
          });
          // 북한산 — 화강암 돔(둥근 반구).
          mk('t_peak_bukhan', W, H, (g) => {
            g.fillStyle(graniteD, 1);
            for (const [dy, w] of [[0, 4], [1, 8], [2, 10], [3, 12]]) g.fillRect(8 - w / 2, 12 + dy, w, 1);
            g.fillStyle(granite, 1);
            for (const [dy, w] of [[4, 14], [5, 14], [6, 14], [7, 14]]) g.fillRect(8 - w / 2, 12 + dy, w, 1);
            g.fillRect(2, 23, 12, 1);
            g.fillStyle(snow, 0.5); g.fillRect(6, 13, 2, 1);  // 화강암 반사광
          });
          // 지리산 — 완만한 장릉(넓고 낮은 능선).
          mk('t_peak_jiri', W, H, (g) => {
            g.fillStyle(forestD, 1);
            for (const [dy, x0, x1] of [[0, 5, 10], [1, 3, 12], [2, 2, 14]]) g.fillRect(x0, 15 + dy, x1 - x0 + 1, 1);
            g.fillStyle(forest, 1); g.fillRect(1, 18, 14, 5);
            g.fillStyle(forestD, 1); g.fillRect(7, 16, 3, 1); g.fillRect(4, 19, 1, 1); g.fillRect(11, 20, 1, 1);
          });
          // 한라산 — 방패형(넓은 저각 돔) + 정상 분화구 함몰.
          mk('t_peak_halla', W, H, (g) => {
            g.fillStyle(forestD, 1);
            for (const [dy, w] of [[0, 6], [1, 10], [2, 13]]) g.fillRect(8 - (w >> 1), 13 + dy, w, 1);
            g.fillStyle(forest, 1); g.fillRect(1, 16, 14, 7);
            g.fillStyle(rockD, 1); g.fillRect(6, 13, 4, 1); g.fillRect(6, 13, 1, 1); g.fillRect(9, 13, 1, 1); // 백록담 분화구
          });
          // 후지산 — 대칭 원뿔 + 넓은 설관(2타일 폭 · 상징성 최대).
          mk('t_peak_fuji', 32, 28, (g) => {
            cone(g, rock, 16, 3, 27, 0.62);
            cone(g, snow, 16, 3, 13, 0.62);
            g.fillStyle(snowD, 1);
            for (let i = 0; i < 7; i++) g.fillRect(16 + i, 3 + i, 1, 1);   // 오른 사면 음영
            g.fillStyle(snow, 1); g.fillRect(11, 13, 3, 3); g.fillRect(19, 14, 3, 2); // 잔설 골(세리)
          });
          // 아소산 — 칼데라(넓은 저각 림 + 함몰) + 분연 1픽셀.
          mk('t_peak_aso', W, H, (g) => {
            g.fillStyle(rockD, 1); g.fillRect(1, 18, 14, 5);
            g.fillStyle(rock, 1); g.fillRect(2, 16, 5, 2); g.fillRect(9, 16, 5, 2);  // 칼데라 양 림
            g.fillStyle(forestD, 1); g.fillRect(6, 17, 4, 2);                         // 화구 함몰(그늘)
            g.fillStyle(smoke, 1); g.fillRect(8, 10, 1, 6); g.fillRect(7, 11, 1, 1); g.fillRect(9, 13, 1, 1); // 분연
          });
        }

        // 장소 노드 마커 — kind별 절차 생성 도트(외부 에셋 0). 16×24, 발밑(하단 중앙) 정렬.
        buildNodeMarkers() {
          const C = this.pal;
          const post = toneColor(0x8a6a44, this.mode);
          const postD = toneColor(0x5e4830, this.mode);
          const drawPost = (g) => { g.fillStyle(postD, 1); g.fillRect(7, 12, 2, 12); g.fillStyle(post, 1); g.fillRect(7, 12, 1, 12); };

          // 도시 — 깃발풍(장대 + 삼각 페넌트).
          {
            const g = this.make.graphics({ add: false });
            drawPost(g);
            const flag = toneColor(0x5f9a46, this.mode), flagD = toneColor(0x3f7030, this.mode);
            g.fillStyle(flagD, 1); g.fillRect(8, 2, 6, 6);
            g.fillStyle(flag, 1); g.fillRect(8, 3, 5, 4);
            g.fillStyle(C.creamHi || 0xfffaf0, 1); g.fillRect(9, 4, 1, 1); g.fillRect(11, 5, 1, 1);
            g.generateTexture('t_node_city', TEX, TEX + 8); g.destroy();
          }
          // 공항 — ✈풍(관제탑 + 비행기 실루엣 힌트).
          {
            const g = this.make.graphics({ add: false });
            const body = toneColor(0xd8dbe2, this.mode), bodyD = toneColor(0x9aa0ab, this.mode);
            const glass = toneColor(0x3ea6d8, this.mode);
            g.fillStyle(bodyD, 1); g.fillRect(5, 6, 6, 18);           // 관제탑 몸통
            g.fillStyle(body, 1); g.fillRect(5, 6, 5, 18);
            g.fillStyle(glass, 1); g.fillRect(5, 8, 6, 2);            // 관제실 유리
            // 비행기(꼭대기 크로스).
            g.fillStyle(body, 1); g.fillRect(3, 2, 10, 1); g.fillRect(7, 0, 2, 5);
            g.generateTexture('t_node_airport', TEX, TEX + 8); g.destroy();
          }
          // 항구 — ⚓풍(닻).
          {
            const g = this.make.graphics({ add: false });
            const iron = toneColor(0x556072, this.mode), ironHi = toneColor(0x8b96a8, this.mode);
            drawPost(g);
            g.fillStyle(iron, 1);
            g.fillRect(7, 3, 2, 10);                                  // 샹크
            g.fillRect(5, 4, 6, 1);                                   // 스톡
            g.fillRect(4, 11, 1, 2); g.fillRect(11, 11, 1, 2);        // 팔 끝
            g.fillRect(4, 12, 8, 1);                                  // 크라운(아래 곡선)
            g.fillStyle(ironHi, 1); g.fillRect(6, 1, 4, 2);           // 링
            g.generateTexture('t_node_port', TEX, TEX + 8); g.destroy();
          }
          // 랜드마크 — 기념탑/타워풍.
          {
            const g = this.make.graphics({ add: false });
            const stone = toneColor(0xc7b48a, this.mode), stoneD = toneColor(0x93805a, this.mode);
            g.fillStyle(stoneD, 1); g.fillRect(6, 3, 4, 21);
            g.fillStyle(stone, 1); g.fillRect(6, 3, 3, 21);
            g.fillStyle(stoneD, 1); g.fillRect(4, 22, 8, 2);          // 받침
            g.fillStyle(stone, 1); g.fillRect(6, 0, 2, 3);            // 첨탑
            g.generateTexture('t_node_landmark', TEX, TEX + 8); g.destroy();
          }
        }

        // NPC 마커(kind:'npc') — sprites.js 픽셀맵(라멘집 앞면+주인장·토리이+미코상)을 시간대 톤으로 굽는다.
        // 24×24, 발밑(하단 중앙) 정렬은 nodeViews 가 origin(0.5,1) + (ty+1)*TILE 로 처리한다.
        buildNpcMarkers() {
          for (const key of NPC_KEYS) {
            const pal = tonePalette(NPC_PAL[key], this.mode);
            this.makeTex(`t_npc_${key}`, npcMarkerRows(key), pal, NPC_W, NPC_H);
          }
        }

        // 맛집(명물 요리) 노드 공용 마커 — 붉은 노렌 포장마차(worldNodes gourmet 필드 → t_gourmet).
        buildGourmetMarker() {
          this.makeTex('t_gourmet', gourmetMarkerRows(), tonePalette(GOURMET_PAL, this.mode), NPC_W, NPC_H);
        }

        // 해안(모래) — land 중 바다에 접한 타일. 잔디→모래를 "딱 잘린 띠" 대신 아래로 갈수록 짙어지는
        //   디더 그라데이션으로 깔아 타일 간 이음새(체크무늬)를 없앤다. 톤 연속(잔디 위 → 웜 모래 → 잔파도).
        buildSand() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          const sand = toneColor(0xe8d6a0, this.mode);   // 웜 모래
          const sandD = toneColor(0xd8c088, this.mode);  // 모래 알갱이 음영
          g.fillStyle(C.grass1, 1); g.fillRect(0, 0, TEX, TEX);        // 잔디 바탕(위쪽 land 와 연속)
          // 아래로 갈수록 모래 확률↑ — 하드 엣지 없이 잔디↔모래가 자연스럽게 섞인다.
          const rng = makeRng(0x5d);
          g.fillStyle(sand, 1);
          for (let y = 0; y < TEX; y++) {
            const p = ((y + 2) / (TEX + 2)) * 0.92;
            for (let x = 0; x < TEX; x++) if (rng() < p) g.fillRect(x, y, 1, 1);
          }
          g.fillStyle(sandD, 1); for (const [x, y] of [[2, 13], [7, 14], [11, 12], [13, 15]]) g.fillRect(x, y, 1, 1);
          g.fillStyle(C.water2, 0.5); g.fillRect(1, 15, 4, 1); g.fillRect(8, 15, 5, 1); // 잔파도 라인
          g.generateTexture('t_sand', TEX, TEX); g.destroy();
        }

        // 나무 — 2타일 높이(수관 위 + 줄기 아래), 16×32.
        buildTree() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          // 수관(위쪽 16px 영역 중심)
          g.fillStyle(C.leafD, 1); g.fillRect(2, 3, 12, 12);
          g.fillStyle(C.leaf1, 1); g.fillRect(3, 2, 10, 11);
          g.fillStyle(C.leaf2, 1); g.fillRect(4, 2, 4, 4); g.fillRect(9, 5, 3, 3); g.fillRect(5, 8, 3, 2);
          g.fillStyle(C.leafD, 1); g.fillRect(6, 6, 1, 1); g.fillRect(10, 9, 1, 1); g.fillRect(4, 11, 1, 1);
          // 줄기(아래 절반)
          g.fillStyle(C.trunkD, 1); g.fillRect(6, 15, 4, 15);
          g.fillStyle(C.trunk, 1); g.fillRect(7, 15, 2, 15);
          g.generateTexture('t_tree', TEX, TEX * 2); g.destroy();
        }

        // 꽃(흔들림 2프레임)·풀숲(살랑 2프레임) 장식 — 비충돌, 텍스처 스왑으로 애니.
        buildDecor() {
          const C = this.pal;
          // 꽃: 꽃송이가 좌/우로 1px 기우는 2프레임(sx = 0 / 1).
          const flower = (key, sx) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(C.stem, 1); g.fillRect(7, 9, 1, 5);
            g.fillStyle(C.flowerP, 1);
            g.fillRect(6 + sx, 6, 4, 3); g.fillRect(7 + sx, 5, 2, 1); g.fillRect(7, 9, 2, 1);
            g.fillStyle(C.flowerC, 1); g.fillRect(7 + sx, 7, 1, 1);
            g.generateTexture(key, TEX, TEX); g.destroy();
          };
          flower('t_flower0', 0);
          flower('t_flower1', 1);
          // 풀숲: 윗잎 하이라이트가 좌/우로 살랑이는 2프레임.
          const bush = (key, sx) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(C.bushD, 1); g.fillRect(3, 9, 10, 6);
            g.fillStyle(C.leaf1, 1); g.fillRect(4, 8, 8, 5);
            g.fillStyle(C.leaf2, 1); g.fillRect(5 + sx, 8, 2, 2); g.fillRect(9 - sx, 9, 2, 2);
            g.generateTexture(key, TEX, TEX); g.destroy();
          };
          bush('t_bush0', 0);
          bush('t_bush1', 1);
        }

        // 배 도트(페리 항해·물 위 피어) — 16×8, 시간대 톤으로 굽는다.
        buildBoat() {
          this.makeTex('t_boat', boatFrameRows(), tonePalette(BOAT_PAL, this.mode), BOAT_W, BOAT_H);
        }

        // 퀘스트 픽셀 팻말 — 16×20.
        buildSign() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          g.fillStyle(C.signBorder, 1); g.fillRect(2, 2, 12, 9);
          g.fillStyle(C.signBoard, 1); g.fillRect(3, 3, 10, 7);
          g.fillStyle(C.signLine, 1); g.fillRect(4, 5, 8, 1); g.fillRect(4, 7, 6, 1);
          g.fillStyle(C.signBorder, 1); g.fillRect(7, 10, 3, 9);
          g.fillStyle(C.signPost, 1); g.fillRect(8, 10, 1, 9);
          g.generateTexture('t_sign', TEX, 20); g.destroy();
        }

        buildHeart() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          const H = C.heart, I = C.heartHi;
          g.fillStyle(H, 1);
          g.fillRect(1, 1, 2, 2); g.fillRect(5, 1, 2, 2);
          g.fillRect(0, 2, 8, 2); g.fillRect(1, 4, 6, 1); g.fillRect(2, 5, 4, 1); g.fillRect(3, 6, 2, 1);
          g.fillStyle(I, 1); g.fillRect(1, 2, 1, 1);
          g.generateTexture('t_heart', 8, 7); g.destroy();
        }

        // 밤 전용 랜턴 불빛 — 부드러운 원형 글로우(중심 밝고 밖으로 번짐). 밤에만 배치.
        buildLamp() {
          const C = this.pal;
          const g = this.make.graphics({ add: false });
          const cx = 8, cy = 8;
          g.fillStyle(BASE_TILE_PAL.lampGlow, 0.28); g.fillCircle(cx, cy, 8);
          g.fillStyle(BASE_TILE_PAL.lampGlow, 0.5); g.fillCircle(cx, cy, 5);
          g.fillStyle(C.lampCore, 1); g.fillCircle(cx, cy, 2);
          g.generateTexture('t_lamp', 16, 16); g.destroy();
        }

        // 4방향 × 걷기 3패턴(n/l/r) 캐릭터, 16×16 한 칸(우향은 side flipX).
        buildCharSet(prefix, pal) {
          for (const dir of CHAR_DIRS) {
            for (const pose of CHAR_POSES) {
              this.makeTex(`${prefix}_${dir}_${pose}`, charFrameRows(dir, pose), pal, CHAR_W, CHAR_H);
            }
          }
        }

        // 펫 5종 × idle 2프레임(통통/꼬리·귀), 12×16.
        buildPets() {
          for (const key of PET_KEYS) {
            const pal = this.petPal[key];
            this.makeTex(`pet_${key}_0`, petFrameRows(key, 0), pal, PET_W, PET_H);
            this.makeTex(`pet_${key}_1`, petFrameRows(key, 1), pal, PET_W, PET_H);
          }
        }

        // 텍스처 방향키(down/up/side)로 캐릭터 프레임 이름 계산.
        // 정지: 중립(n). 이동: 4프레임 사이클[l,n,r,n]을 CHAR_ANIM_MS로 진행.
        charTex(prefix, facing, moving, time, animMs = CHAR_ANIM_MS) {
          const base = (facing === 'left' || facing === 'right') ? 'side' : facing;
          const pose = moving ? CHAR_WALK_CYCLE[Math.floor(time / animMs) % CHAR_WALK_CYCLE.length] : 'n';
          return `${prefix}_${base}_${pose}`;
        }

        // animMs 기본은 CHAR_ANIM_MS(원격 피어 등). 로컬 플레이어는 달리기 중 RUN_ANIM_MS 로 빠르게.
        setCharFrame(sprite, prefix, facing, moving, time, animMs = CHAR_ANIM_MS) {
          sprite.setTexture(this.charTex(prefix, facing, moving, time, animMs));
          sprite.setFlipX(facing === 'right');
        }

        // ── 외부(GBC 셸 D-pad) 방향 입력 주입 — 키보드 keydown/keyup과 완전히 같은 경로 ──
        // heldDirs 스택을 그대로 쓰므로 홀드 연속 이동·회전 유예·탭 취소가 자동으로 동일하게 적용된다.
        extInputDown(d) {
          if (this.inputLocked || !VALID_DIR.has(d)) return;
          this.tapTile = null;
          if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
        }
        extInputUp(d) {
          this.heldDirs = this.heldDirs.filter((x) => x !== d);
        }

        create(bootData) {
          sceneRef.current = this;   // 버스 핸들러 위임 대상 · React 입력 잠금 갱신용
          const corridorRedirect = corridorRedirectScene(bootData, initialSpawnRef.current, {
            allowPreview: canAccessPreviewRegions,
          });
          if (corridorRedirect) {
            this.scene.start(corridorRedirect, { spawn: initialSpawnRef.current });
            return;
          }
          const regionRedirect = overworldRegionRedirectScene(bootData, initialSpawnRef.current, {
            allowPreview: canAccessPreviewRegions,
          });
          if (regionRedirect) {
            this.scene.start(regionRedirect, { spawn: initialSpawnRef.current });
            return;
          }
          // ── 직행 재접속(문서 §4) — 저장 씬이 'city:<id>' 면 도시맵으로 바로 스폰 ──
          // 판별은 순수 함수 cityRedirectScene(session.js)에 위임한다(Codex P1-1): Phaser 3 는
          // autostart 초기 부팅에도 기본 데이터 `{}` 를 전달하므로 `!bootData` 로는 부팅을 못 가른다 —
          // 복귀 데이터(bootData.spawn) 유무로 가른다. 도시 데이터가 없으면 전국맵 폴백(계속 진행).
          {
            const redirect = cityRedirectScene(bootData, initialSpawnRef.current, (id) => !!CITY_DATA[id]);
            if (redirect) {
              this.scene.start(redirect, { spawn: initialSpawnRef.current });
              return;
            }
          }
          {
            const defaultNode = getNode('seoul');
            const defaultSpawn = defaultNode?.overworldTile
              ? {
                  scene: `overworld:${defaultNode.regionId}`,
                  x: defaultNode.overworldTile[0],
                  y: defaultNode.overworldTile[1],
                }
              : null;
            const redirect = defaultOverworldRegionSpawn(
              bootData,
              initialSpawnRef.current,
              defaultSpawn,
            );
            if (redirect) {
              this.scene.start(redirect.scene, { spawn: redirect });
              return;
            }
          }
          setActiveScene('plaza');
          setCorridorNear(null); setCorridorPrompt(null); setCorridorStatus(null);
          setRegionNearGate(null); setRegionGatePrompt(null); setRegionStatus(null);
          this.inputLocked = false;  // 리뷰 오버레이 중 이동 잠금
          this.enteringCity = false; // 도시 진입 페이드 가드(씬 인스턴스 재사용 — 복귀 시 리셋 필수)
          this.petJumpVal = 0;       // 퀘스트 완료 점프 연출값(0→1→0)

          this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
          this.cameras.main.setBackgroundColor(toneColor(BASE_TILE_PAL.grass1, this.mode));
          this.cameras.main.setZoom(ZOOM);
          this.cameras.main.setRoundPixels(true);

          // ── 지형 격자(한반도+일본 실비율 도트 맵) ──
          // build-map.mjs 가 구운 448×384 다치 격자를 디코드(0=sea·1=land·2=river·3=lake·4=fence·5=bridge).
          // 통행 차단은 isBlocked(sea·fence)만 — river·lake·bridge 는 걸어서 통과 가능(오너 스펙).
          // 스폰 광장 보장: 서울(스폰)~인천공항 일대의 "바다"만 land 로 메꾼다.
          //   목적이 광장이 바다에 잘리지 않게 하는 것뿐이므로 SEA 한정 — 무차별 LAND 강제는
          //   한강(RIVER 21타일)·영종대교(BRIDGE)·서측 철조망(FENCE 10타일)을 지워 국경이 뚫렸다.
          //   변환은 mapGeo.buildPlayableGrid(순수 함수)에 고정 — 관리자 뷰·미니맵과 동일 산출을
          //   보장하고(P2-6), mapData "수도권 광장 계약" 테스트가 실함수를 import해 계약을 게이트한다.
          this.grid = buildPlayableGrid(decodeMap());
          this.signTileX = POI.SEOUL.x + 3; this.signTileY = POI.SEOUL.y - 3;  // 퀘스트 팻말(스폰 곁)
          this.wasNearNodeId = null;

          // 공항 스토리에서 광장으로 복귀 시 create가 다시 도므로 스토리·노드 오버레이 상태를 초기화.
          setStoryActive(false); setStoryPhase('none'); setNearNode(null); setFerryPrompt(null); setChapterPrompt(null);
          setAirHubPrompt(null); setAirHubStatus(null);

          this.waterFrame = 0;
          this.decorFrame = 0;
          this.runHeld = false;     // B 홀드 달리기 플래그
          this.ferrying = false;    // 페리 항해 중(조작 잠금 · 노드 근접 판정 보류)
          this.airTravelPending = false;
          this.ferryBoat = null;    // 항해 중 캐릭터 아래 배 스프라이트
          this.decor = new Map();   // "tx,ty" → { kind, imgs:[] } — 카메라 주변만 생성/회수(상한 DECOR_CAP)

          // ── 지형 렌더 페이지 ── canonical .owc 256 저장 청크를 검증해 읽고,
          // 카메라 주변 32×32 RenderTexture만 굽는다. 충돌·노드 좌표는 마이그레이션 게이트 전까지
          // 기존 격자를 계속 사용하며, fixture 동일성 테스트가 두 표현의 셀 단위 일치를 보장한다.
          this.waterPool = [];
          this.waterSignature = null;
          this.terrainLoader = new OverworldChunkLoader({
            baseUrl: OVERWORLD_FIXTURE_BASE_URL,
            manifest: OVERWORLD_FIXTURE_MANIFEST,
          });
          this.terrainPages = new PhaserOverworldPageRenderer(this, {
            loader: this.terrainLoader,
            textureKeyAt: ({ globalX, globalY, surface }) => this.terrainTexKey(globalX, globalY, surface),
            fallbackTextureKey: 't_water0',
            tilePixels: TEX,
            worldScale: TSCALE,
            depth: 0,
          });
          this.overworldOverlay = new PhaserOverworldOverlayLayer(this, {
            routes: OVERWORLD_ROUTES,
            vehicleTextureKeyAt: () => 't_boat',
            tilePixels: TEX,
            worldScale: TSCALE,
          });
          this.overworldVehicles = [];
          this.lastOverworldVehicleUpdate = -Infinity;
          this.events.once('shutdown', () => {
            this.terrainPages?.destroy();
            this.terrainPages = null;
            this.overworldOverlay?.destroy();
            this.overworldOverlay = null;
            this.terrainLoader?.destroy();
            this.terrainLoader = null;
            for (const image of this.waterPool) image.destroy();
            this.waterPool.length = 0;
          });

          // 팻말 — 스폰 광장 곁.
          this.signX = this.signTileX * TILE + TILE / 2;
          this.signY = this.signTileY * TILE + TILE / 2;
          this.add.image(this.signX, this.signTileY * TILE + TILE, 't_sign').setOrigin(0.5, 1).setScale(TSCALE).setDepth(this.signY);

          // ── 장소 노드 마커 — kind별 절차 마커(비충돌). 이름 라벨은 없다(포켓몬처럼 깨끗한 화면). ──
          // 근접 시 A(말 걸기)로 설명 박스/게이트를 연다. 마커는 걸어서 통과 가능(스폰 도시가 막히지 않게).
          // 도시 소속 노드(city 필드 — 라멘 등)는 전국맵에 렌더하지 않는다(도시 정밀맵으로 이전).
          this.nodeViews = WORLD_NODES.filter((node) => !node.city).map((node) => {
            const [tx, ty] = node.tile;
            const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
            // npc→t_npc, gourmet(맛집)→t_gourmet, 명산(peak)→t_peak, 그 외 kind 마커.
            const markerKey = node.npc ? `t_npc_${node.npc}`
              : node.gourmet ? 't_gourmet'
                : node.peak ? `t_peak_${node.peak}` : `t_node_${node.kind}`;
            const marker = this.add.image(wx, (ty + 1) * TILE, markerKey)
              .setOrigin(0.5, 1).setScale(TSCALE).setDepth(wy);
            return { node, marker, wx, wy };
          });

          // 밤이면 팻말 곁 랜턴 불빛 하나(포인트 광원). additive로 은은하게 번지게.
          if (this.mode === 'night') {
            this.add.image(this.signX + TILE, this.signY, 't_lamp')
              .setScale(TSCALE).setDepth(this.signY + 1).setBlendMode(Phaser.BlendModes.ADD);
          }

          // 물 애니메이션 — 화면 안 sea 타일만 3프레임 물결 교체(전 바다 갱신은 불가).
          this.time.addEvent({ delay: 520, loop: true, callback: () => {
            this.waterFrame = (this.waterFrame + 1) % 3;
            this.animateWater();
          } });
          // 꽃·풀숲 흔들림 — 현재 스폰된 장식만 2프레임 교차(물결과 다른 주기).
          this.time.addEvent({ delay: 620, loop: true, callback: () => {
            this.decorFrame ^= 1;
            for (const [, d] of this.decor) {
              if (d.kind === 'flower') d.imgs[0].setTexture(`t_flower${this.decorFrame}`);
              else if (d.kind === 'bush') d.imgs[0].setTexture(`t_bush${this.decorFrame}`);
            }
          } });

          // ── 플레이어(그리드) — 재접속 스폰(저장된 자리) 또는 서울(68,208) 기본 ──
          // 저장된 좌표가 '광장(plaza)' 씬이고 맵 안·보행 가능이면 그 타일에서 스폰한다.
          //   · scene==='airport' 저장은 광장 씬에 직접 배치할 수 없어 단순화 — 기본(서울 허브)로
          //     스폰한다(공항은 게이트 노드로 다시 진입). 실제로 local:state 는 광장에서만 emit 하므로
          //     저장 씬은 사실상 항상 'plaza' 다(airport 분기는 방어적 폴백).
          //   · 무효(범위 밖·바다·울타리·팻말 타일)면 기본 서울로 폴백한다.
          let spawnTileX = POI.SEOUL.x;
          let spawnTileY = POI.SEOUL.y;
          // 스폰 우선순위: 씬 복귀(bootData.spawn — 도시 출구=도시 노드 앞 · 공항 출구=게이트 앞
          // returnSpawn) > 저장된 플라자 좌표 > 서울 허브.
          const savedSpawn = initialSpawnRef.current;
          const override = (bootData && bootData.spawn && bootData.spawn.scene === 'plaza') ? bootData.spawn
            : (savedSpawn && savedSpawn.scene === 'plaza' ? savedSpawn : null);
          if (
            override &&
            isSpawnTileValid(override.x, override.y, COLS, ROWS, (tx, ty) => !this.blocked(tx, ty))
          ) {
            spawnTileX = override.x;
            spawnTileY = override.y;
          }
          this.pTileX = spawnTileX; this.pTileY = spawnTileY;
          this.facing = 'down';
          this.moving = false;
          this.turnGrace = 0;
          const spawnX = this.pTileX * TILE + TILE / 2;
          const spawnY = this.pTileY * TILE + TILE / 2;
          // 16×16 스프라이트(한 칸): origin 0.5로 타일 중심에 정렬 — 골드 필드 스프라이트 배치.
          this.player = this.add.image(spawnX, spawnY, 'pc_down_n').setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);
          // 닉네임 라벨은 없다(포켓몬처럼 깨끗한 화면) — 피어도 동일.

          // ── 펫(그리드 추적) ──
          this.petTargetX = this.pTileX - 1; this.petTargetY = this.pTileY;
          this.petPX = this.petTargetX * TILE + TILE / 2;
          this.petPY = this.petTargetY * TILE + TILE / 2;
          this.petFlip = false;
          this.pet = this.add.image(this.petPX, this.petPY, this.petTexKey(0)).setScale(TSCALE * this.petLevelScale());

          this.cameras.main.centerOn(spawnX, spawnY);
          this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
          // Phaser centerOn은 scroll만 바꾸고 첫 preRender 전 worldView는 갱신하지 않는다.
          // 첫 화면은 스폰 중심 bounds를 직접 넘겨 좌상단 페이지가 잠깐 구워지는 일을 막는다.
          const initialViewWidth = VIEW_W / ZOOM;
          const initialViewHeight = VIEW_H / ZOOM;
          this.refreshTerrainPages(true, {
            x: Math.max(0, Math.min(WORLD_W - initialViewWidth, spawnX - initialViewWidth / 2)),
            y: Math.max(0, Math.min(WORLD_H - initialViewHeight, spawnY - initialViewHeight / 2)),
            width: initialViewWidth,
            height: initialViewHeight,
          });
          this.overworldOverlay.updateCamera({
            x: Math.max(0, Math.min(WORLD_W - initialViewWidth, spawnX - initialViewWidth / 2)),
            y: Math.max(0, Math.min(WORLD_H - initialViewHeight, spawnY - initialViewHeight / 2)),
            width: initialViewWidth,
            height: initialViewHeight,
          }, { force: true });

          // ── 입력: 방향키/WASD 스택(마지막 키 우선) + 탭-투-무브 ──
          this.heldDirs = [];
          this.tapTile = null;
          this.input.keyboard.on('keydown', (e) => {
            if (e.key === 'b' || e.key === 'B') { this.runHeld = true; return; } // 달리기 홀드
            if (this.inputLocked) return; // 리뷰 오버레이 중 이동 잠금
            const d = keyToDir(e.key);
            if (!d) return;
            this.tapTile = null;
            if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
          });
          this.input.keyboard.on('keyup', (e) => {
            if (e.key === 'b' || e.key === 'B') { this.runHeld = false; return; }
            const d = keyToDir(e.key);
            if (d) this.heldDirs = this.heldDirs.filter((x) => x !== d);
          });
          this.input.on('pointerdown', (p) => {
            if (this.inputLocked) return; // 리뷰 오버레이 중 탭-이동 잠금
            this.tapTile = { x: Math.floor(p.worldX / TILE), y: Math.floor(p.worldY / TILE) };
            this.heldDirs.length = 0;
          });

          // ── 원격 플레이어(그리드 스텝 렌더) ──
          // 버스 구독('peers:update'·'chat:msg' 등)은 컴포넌트 스코프에서 등록됨 — 여기선 상태만 준비.
          this.peers = new Map();   // peerId -> { sprite, label, nick, tileX, tileY, destTileX, destTileY, facing, moving }
          this.bubbles = new Map(); // userId -> { text, target, timer } — 3초 도트 말풍선

          // 도트 닉네임 폰트(Galmuri9) 로드 상태. 미로드 창엔 monospace 폴백으로 뜬 뒤,
          // load 완료 시 refreshPeerLabels()가 라벨·말풍선을 Galmuri9 로 다시 굽는다.
          this.fontReady = false;
          try {
            if (typeof document !== 'undefined' && document.fonts?.load) {
              const done = () => { this.fontReady = true; this.refreshPeerLabels?.(); };
              if (document.fonts.check("8px 'Galmuri9'")) done();
              else document.fonts.load("8px 'Galmuri9'").then(done).catch(() => {});
            }
          } catch { /* 폰트 API 미지원 — 폴백 유지 */ }

          this.lastEmit = 0;
          this.time.addEvent({ delay: 500, loop: true, callback: () => this.emitDistances() });

          // 기분 하트(happy/excited).
          this.time.addEvent({
            delay: 2600, loop: true, callback: () => {
              const mood = petRef.current?.mood;
              if (mood === 'happy' || mood === 'excited') this.spawnHeart();
            },
          });

          this.wasNear = false;
          this.lastWorldLightingUpdate = -Infinity;
          this.worldLightingOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x18254a, 1)
            .setOrigin(0, 0).setScrollFactor(0).setDepth(14000).setAlpha(0);

          // 씬 복귀(bootData.spawn — 도시 출구·공항 출구)면 페이드인으로 자연스럽게 등장.
          if (bootData && bootData.spawn) this.cameras.main.fadeIn(CITY_FADE_MS, 0, 0, 0);

          // 씬 전환 직후 피어 스냅샷 재적용 + 전체 키 거리 1회 emit(타 씬 음성 잔류 차단 — Codex P1-2).
          resetScenePeers();
        }

        // 전국맵 → 도시 정밀맵 진입(페이드 아웃 + 씬 전환). React 프롬프트 "들어가기"가 호출.
        enterCity(id) {
          if (!CITY_DATA[id] || this.enteringCity) return;
          this.enteringCity = true;
          this.inputLocked = true;
          this.heldDirs.length = 0; this.tapTile = null; this.runHeld = false;
          this.cameras.main.fadeOut(CITY_FADE_MS, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => { this.scene.start(`city:${id}`); });
        }

        // 퀘스트 채점 연출 — 정답이면 펫 자리에 하트 즉시.
        questScoredFx({ correct } = {}) {
          if (correct) this.spawnHeart();
        }

        // 퀘스트 완료 연출 — 펫 점프 + 하트 몇 개.
        questDoneFx() {
          if (!this.pet) return;
          this.tweens.add({ targets: this, petJumpVal: 1, duration: 220, ease: 'Quad.easeOut', yoyo: true, repeat: 1 });
          for (let i = 0; i < 3; i++) this.time.delayedCall(i * 120, () => this.spawnHeart());
        }

        petTexKey(frame) {
          const key = PET_KEYS.includes(petRef.current?.key) ? petRef.current.key : 'dog';
          return `pet_${key}_${frame}`;
        }

        petLevelScale() {
          const lv = petRef.current?.level || 1;
          return Math.min(1 + (lv - 1) * 0.06, 1.6);
        }

        // 타일 지형 코드(범위 밖 = 바다). 충돌·해안·물결·장식 판정 공용.
        tileCode(tx, ty) {
          if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return TERRAIN.SEA;
          return this.grid[ty * MAP_W + tx];
        }

        // 전역 타일 → 절차 텍스처. 페이지 경계에서도 전역 이웃을 조회해 해안·강 마스크가 이어진다.
        terrainTexKey(tx, ty, surface = this.tileCode(tx, ty)) {
          const c = surface;
          if (c === TERRAIN.RIVER) {
            const waterNeighbor = (x, y) => {
              const code = this.tileCode(x, y);
              return code === TERRAIN.RIVER || code === TERRAIN.LAKE || code === TERRAIN.SEA;
            };
            const mask = (waterNeighbor(tx, ty - 1) ? RIVER_N : 0)
              | (waterNeighbor(tx + 1, ty) ? RIVER_E : 0)
              | (waterNeighbor(tx, ty + 1) ? RIVER_S : 0)
              | (waterNeighbor(tx - 1, ty) ? RIVER_W : 0);
            return `t_river_${mask}`;
          }
          if (c === TERRAIN.LAKE) return 't_lake';
          if (c === TERRAIN.FENCE) return 't_fence';
          if (c === TERRAIN.BRIDGE) return 't_bridge';
          if (c === TERRAIN.MOUNTAIN) {
            const hash = tileHash(tx, ty);
            return hash < 0.34 ? 't_mountain' : hash < 0.67 ? 't_mountain_b' : 't_mountain_c';
          }
          if (c === TERRAIN.PEAK) return 't_peak';
          if (c !== TERRAIN.LAND && c !== TERRAIN.PLAIN) return 't_water0';
          const coast = this.isSea(tx - 1, ty) || this.isSea(tx + 1, ty)
            || this.isSea(tx, ty - 1) || this.isSea(tx, ty + 1);
          if (coast) return 't_sand';
          return c === TERRAIN.PLAIN ? 't_plain' : 't_grass';
        }

        // 바다 타일 여부(범위 밖 = 바다) — 물결 애니 대상. river·lake 는 바다가 아니다(정적).
        isSea(tx, ty) { return this.tileCode(tx, ty) === TERRAIN.SEA; }

        // 타일 충돌 판정: isBlocked(sea·fence) + 팻말 = 막힘.
        //   river·lake·bridge 는 통행 가능(오너 스펙 "넘어갈 수 있게"). 노드 마커는 비충돌.
        blocked(tx, ty) {
          if (isBlocked(this.tileCode(tx, ty))) return true;
          if (tx === this.signTileX && ty === this.signTileY) return true;
          return false;
        }

        // 카메라가 새 페이지로 넘어갈 때만 렌더 계획을 갱신한다. stale 요청은 pager가 폐기한다.
        refreshTerrainPages(force = false, cameraOrView = this.cameras.main) {
          if (!this.terrainPages) return Promise.resolve(null);
          const worldView = cameraOrView?.worldView ?? cameraOrView;
          const width = worldView?.width ?? (worldView?.right - worldView?.x);
          const height = worldView?.height ?? (worldView?.bottom - worldView?.y);
          if (![worldView?.x, worldView?.y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
            return Promise.resolve(null);
          }
          const vector = this.moving && DIRV[this.facing] ? DIRV[this.facing] : [0, 0];
          const update = this.terrainPages.updateCamera(cameraOrView, {
            direction: { x: vector[0], y: vector[1] },
            force,
          });
          update.catch(() => {});
          return update;
        }

        // 화면 안 sea 타일만 별도 스프라이트 풀로 물결 프레임을 덮는다.
        animateWater() {
          if (!this.waterPool) return;
          const v = this.cameras.main.worldView;
          const x0 = Math.max(0, Math.floor(v.x / TILE)), x1 = Math.min(COLS - 1, Math.ceil(v.right / TILE));
          const y0 = Math.max(0, Math.floor(v.y / TILE)), y1 = Math.min(ROWS - 1, Math.ceil(v.bottom / TILE));
          const signature = `${x0},${y0},${x1},${y1},${this.waterFrame}`;
          if (signature === this.waterSignature) return;
          this.waterSignature = signature;
          let used = 0;
          for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
              if (!this.isSea(tx, ty)) continue;
              let image = this.waterPool[used];
              if (!image) {
                image = this.add.image(0, 0, 't_water0').setOrigin(0, 0).setScale(TSCALE).setDepth(0.5);
                this.waterPool.push(image);
              }
              image.setTexture(`t_water${this.waterFrame}`)
                .setPosition(tx * TILE, ty * TILE)
                .setVisible(true);
              used += 1;
            }
          }
          for (let index = used; index < this.waterPool.length; index += 1) {
            this.waterPool[index].setVisible(false);
          }
        }

        // 타일 결정적 장식 종류(스폰 광장 근처·비육지는 비움). 'tree'|'flower'|'bush'|null.
        //   나무·풀숲은 land 계열에만 — 강·호수·교량·철조망·설산(PEAK) 위에는 나지 않는다.
        //   산지(MOUNTAIN)는 나무 확률↑(숲), 평야(PLAIN)는 확률↓(농지) — 간단 조정.
        decorKind(tx, ty) {
          const c = this.tileCode(tx, ty);
          if (c !== TERRAIN.LAND && c !== TERRAIN.MOUNTAIN && c !== TERRAIN.PLAIN) return null;
          if (Math.abs(tx - this.pTileX) <= PLAZA_R && Math.abs(ty - this.pTileY) <= PLAZA_R) return null;
          const r = tileHash(tx, ty);
          // 나무 임계: 산지 0.16(숲) · 육지 0.05 · 평야 0.02(드문 방풍림).
          const treeT = c === TERRAIN.MOUNTAIN ? 0.16 : c === TERRAIN.PLAIN ? 0.02 : 0.05;
          if (r < treeT) return 'tree';
          if (r < treeT + 0.022) return 'flower';
          if (r < treeT + 0.038) return 'bush';
          return null;
        }

        spawnDecor(kind, tx, ty) {
          const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
          if (kind === 'tree') {
            const img = this.add.image(cx, (ty + 1) * TILE, 't_tree').setOrigin(0.5, 1).setScale(TSCALE).setDepth((ty + 1) * TILE);
            return { kind, imgs: [img] };
          }
          if (kind === 'flower') {
            const img = this.add.image(cx, cy, `t_flower${this.decorFrame}`).setScale(TSCALE).setDepth(1);
            return { kind, imgs: [img] };
          }
          const img = this.add.image(cx, cy, `t_bush${this.decorFrame}`).setScale(TSCALE).setDepth(cy - 4);
          return { kind, imgs: [img] };
        }

        // 카메라 주변 land 타일에만 장식 생성/회수(상한 DECOR_CAP). 화면 밖은 즉시 파괴 → 무한 맵도 저비용.
        updateDecor() {
          const v = this.cameras.main.worldView;
          const m = TILE * 2; // 여유 마진(2타일) — 가장자리 팝인 완화
          const x0 = Math.max(0, Math.floor((v.x - m) / TILE)), x1 = Math.min(COLS - 1, Math.ceil((v.right + m) / TILE));
          const y0 = Math.max(0, Math.floor((v.y - m) / TILE)), y1 = Math.min(ROWS - 1, Math.ceil((v.bottom + m) / TILE));
          const need = new Set();
          for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
              const kind = this.decorKind(tx, ty);
              if (!kind) continue;
              const key = `${tx},${ty}`;
              need.add(key);
              if (!this.decor.has(key) && this.decor.size < DECOR_CAP) this.decor.set(key, this.spawnDecor(kind, tx, ty));
            }
          }
          for (const [key, d] of this.decor) {
            if (!need.has(key)) { for (const img of d.imgs) img.destroy(); this.decor.delete(key); }
          }
        }

        // 광장 → 공항 스토리 씬 전환(같은 Phaser 게임 내 씬 스위치).
        // 게이트 앞 타일(현재 플레이어 타일)을 returnSpawn 으로 실어 보낸다 — 공항 출구가
        // { spawn: returnSpawn } 으로 복귀해 cityRedirectScene 이 "초기 부팅"으로 오인하지 않게
        // (Codex 재검수 P1: 저장 씬이 city:* 인 사용자가 공항 출구에서 도시로 튕기던 회귀 차단).
        // 공항 진입 경로는 이 메서드 하나뿐이다(interact() A버튼·게이트 프롬프트 버튼 모두 여기로) —
        // returnSpawn 전달이 항상 보장된다.
        enterAirport() {
          setActiveScene('airport');
          setAirHubPrompt(null); setAirHubStatus(null);
          this.scene.start('airport', { returnSpawn: { scene: 'plaza', x: this.pTileX, y: this.pTileY } });
        }

        enterTranssib(stopId = 'vladivostok') {
          const spawn = corridorStopSpawn(stopId);
          if (!spawn) return;
          this.scene.start('transsib-corridor', { spawn });
        }

        enterOverworldRegion(regionId = 'asia-pacific') {
          const region = overworldRegionById(regionId);
          const spawn = overworldRegionSpawn(region);
          if (!region || !spawn) return;
          this.scene.start(region.sceneId, { spawn });
        }

        async flyToOverworldRegion(regionId) {
          if (this.airTravelPending) return false;
          const destination = overworldAirDestinationById(airDestinationsRef.current, regionId);
          if (!destination || !userId) return false;
          this.airTravelPending = true;
          this.inputLocked = true;
          this.heldDirs.length = 0;
          this.tapTile = null;
          setAirHubPrompt(null);
          setAirHubStatus({ phase: 'saving', destination });
          try {
            const response = await fetch('/api/world/position', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(destination.spawn), keepalive: true,
            });
            if (!response.ok) throw new Error('air destination save failed');
            setAirHubStatus(null);
            this.scene.start(destination.sceneId, { spawn: destination.spawn });
            return true;
          } catch {
            setAirHubStatus({
              phase: 'error',
              destination,
              message: '도착 위치를 저장하지 못했어요. 다시 시도해 주세요.',
            });
            this.inputLocked = false;
            return false;
          } finally {
            this.airTravelPending = false;
          }
        }

        // 페리 탑승 — "함께 보이는 항해". 순간이동 대신 물 위를 3~5초에 걸쳐 tween 이동한다.
        //   · 이동 중 캐릭터 아래 배 도트, 조작 잠금(this.ferrying), 카메라는 계속 플레이어 추적.
        //   · update() 의 local:state 는 항해 중에도 계속 스트림되므로(연속 좌표) 상대 화면에서도
        //     캐릭터가 바다를 건너는 게 보인다(applyPeers 8타일 스냅 임계 밑 → 자연 보간).
        // 경로는 출발점→도착 항구 인접 land 를 잇는 직선 보간(두 항구 사이는 바다 — 물 위 유지).
        ferryTo(destId) {
          const dest = getNode(destId);
          if (!dest || !this.player || this.ferrying) return;
          const [lx, ly] = this.findLandingTile(dest.tile[0], dest.tile[1]);
          this.heldDirs.length = 0; this.tapTile = null; this.runHeld = false;
          this.ferrying = true;
          // 출발 항구 프롬프트를 닫는다(항해 중 근접 판정을 멈추므로 stale 로 남지 않게).
          this.wasNearNodeId = null; setNearNode(null); setNearQuest(false);

          const fromX = this.player.x, fromY = this.player.y;
          const destX = lx * TILE + TILE / 2, destY = ly * TILE + TILE / 2;
          const dist = Math.hypot(destX - fromX, destY - fromY);
          const dur = Math.min(5000, Math.max(3000, dist * 2)); // 3~5초(거리 비례)
          // 진행 방향으로 몸을 돌린다(항해 내내 보행 애니).
          this.facing = Math.abs(destX - fromX) >= Math.abs(destY - fromY)
            ? (destX > fromX ? 'right' : 'left')
            : (destY > fromY ? 'down' : 'up');
          this.moving = true;

          if (this.ferryBoat) this.ferryBoat.destroy();
          this.ferryBoat = this.add.image(Math.round(fromX), Math.round(fromY) + 8, 't_boat')
            .setOrigin(0.5, 0.5).setScale(TSCALE).setDepth(fromY - 1);

          this.tweens.killTweensOf(this.player);
          this.tweens.add({
            targets: this.player, x: destX, y: destY, duration: dur, ease: 'Sine.easeInOut',
            onUpdate: () => {
              // 배는 캐릭터 발밑을 따라오고, 펫도 항해를 뒤따르게 목표 타일을 갱신한다.
              if (this.ferryBoat) this.ferryBoat.setPosition(Math.round(this.player.x), Math.round(this.player.y) + 8).setDepth(this.player.y - 1);
              this.petTargetX = Math.floor(this.player.x / TILE);
              this.petTargetY = Math.floor(this.player.y / TILE);
            },
            onComplete: () => {
              this.moving = false;
              if (this.ferryBoat) { this.ferryBoat.destroy(); this.ferryBoat = null; }
              this.ferrying = false;
              this.placePlayerAt(lx, ly);   // 최종 타일 스냅(펫·카메라 정렬)
            },
          });
        }

        // 목적 항구 타일 또는 그 4-이웃 중 걸을 수 있는 land 를 착지점으로 고른다(항구 위 바다 회피).
        findLandingTile(tx, ty) {
          const walkableLand = (x, y) => this.tileCode(x, y) === TERRAIN.LAND;
          if (walkableLand(tx, ty)) return [tx, ty];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (walkableLand(tx + dx, ty + dy)) return [tx + dx, ty + dy];
          }
          return [tx, ty]; // 폴백(계약상 항구 타일은 land)
        }

        // 플레이어·펫·카메라를 해당 타일로 스냅(이동 중단).
        placePlayerAt(tx, ty) {
          this.tweens.killTweensOf(this.player);
          this.pTileX = tx; this.pTileY = ty; this.moving = false;
          const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
          this.player.setPosition(wx, wy);
          this.petTargetX = tx; this.petTargetY = ty;
          this.petPX = wx; this.petPY = wy;
          if (this.pet) this.pet.setPosition(Math.round(wx), Math.round(wy));
          this.cameras.main.centerOn(wx, wy);
        }

        overworldRuntimeSnapshot() {
          if (!this.terrainPages) return null;
          const heapUsedBytes = Number(globalThis.performance?.memory?.usedJSHeapSize);
          return Object.freeze({
            ...this.terrainPages.snapshot({ heapUsedBytes }),
            tile: Object.freeze({ x: this.pTileX, y: this.pTileY }),
          });
        }

        async debugTeleportTo(tx, ty) {
          if (!isSpawnTileValid(tx, ty, COLS, ROWS, (x, y) => !this.blocked(x, y))) {
            throw new RangeError(`debug destination is not walkable: ${tx},${ty}`);
          }
          this.placePlayerAt(tx, ty);
          const width = VIEW_W / ZOOM;
          const height = VIEW_H / ZOOM;
          const wx = tx * TILE + TILE / 2;
          const wy = ty * TILE + TILE / 2;
          const update = await this.refreshTerrainPages(true, {
            x: Math.max(0, Math.min(WORLD_W - width, wx - width / 2)),
            y: Math.max(0, Math.min(WORLD_H - height, wy - height / 2)),
            width,
            height,
          });
          await update?.background;
          await this.terrainPages?.waitForIdle();
          return this.overworldRuntimeSnapshot();
        }

        // 한 타일 이동 시작(플레이어). B 홀드 중이면 2배속(달리기).
        startStep(dir) {
          const [dx, dy] = DIRV[dir];
          const prevX = this.pTileX, prevY = this.pTileY;
          this.pTileX += dx; this.pTileY += dy;
          this.moving = true;
          const dur = this.runHeld ? RUN_STEP_MS : STEP_MS; // B 홀드 한정 달리기
          const tx = this.pTileX * TILE + TILE / 2, ty = this.pTileY * TILE + TILE / 2;
          this.tweens.add({
            targets: this.player, x: tx, y: ty, duration: dur, ease: 'Linear',
            onComplete: () => { this.moving = false; this.petTargetX = prevX; this.petTargetY = prevY; },
          });
        }

        // 원격 목록 반영 — 광장 씬(scene==='plaza') 피어만 렌더한다(공용 헬퍼 · 공항 씬과 로직 공유).
        //   scene 필드가 아직 안 오면(Codex 병렬 추가 중) 'plaza' 로 간주 → 기존과 동일 동작(하위호환).
        applyPeers(incoming) {
          applyPeersToScene(this, incoming, { charPrefix: 'pr', sceneName: 'plaza' });
        }

        // 물 타일(바다·강·호수) 여부 — 물 위 피어에 배 도트를 붙이는 판정(updateScenePeers 에 주입).
        isWaterTile(tx, ty) {
          const c = this.tileCode(tx, ty);
          return c === TERRAIN.SEA || c === TERRAIN.RIVER || c === TERRAIN.LAKE;
        }

        // 폰트 로드 완료 후, 이미 떠 있는 라벨·말풍선을 Galmuri9 로 다시 굽는다(폴백→도트 교체).
        refreshPeerLabels() {
          for (const [, p] of this.peers) p.label?.setStyle(peerLabelStyle(this.fontReady));
          for (const [, b] of this.bubbles) b.text?.setFontFamily(this.fontReady ? "'Galmuri9', monospace" : 'monospace');
        }

        // 포켓몬 말풍선 — 해당 유저(자기=플레이어, 그 외=피어) 캐릭터 위에 3초 표시.
        // 크림 배경·잉크 텍스트의 도트 한 줄(최대 24자). 같은 유저의 새 메시지는 기존 말풍선을 대체.
        showChatBubble(userIdOfMsg, text) {
          const clean = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
          if (!clean) return;
          const isSelf = userIdOfMsg && userIdOfMsg === userId;
          const target = isSelf ? this.player : this.peers.get(userIdOfMsg)?.sprite;
          if (!target) return;
          const shown = clean.length > 24 ? `${clean.slice(0, 23)}…` : clean;
          const prev = this.bubbles.get(userIdOfMsg);
          if (prev) { prev.timer?.remove(); prev.text.destroy(); }
          const txt = this.add.text(target.x, target.y, shown, {
            fontFamily: this.fontReady ? "'Galmuri9', monospace" : 'monospace',
            fontSize: '8px', color: '#2a2118',
            backgroundColor: '#f6edcf', padding: { x: 3, y: 2 },
          }).setOrigin(0.5, 1).setDepth(PEER_LABEL_DEPTH + 1);
          const timer = this.time.delayedCall(3000, () => {
            txt.destroy();
            if (this.bubbles.get(userIdOfMsg)?.text === txt) this.bubbles.delete(userIdOfMsg);
          });
          this.bubbles.set(userIdOfMsg, { text: txt, target, timer });
        }

        // 근접 음성 거리 emit — 공용 헬퍼 위임(같은 씬 실거리 · 다른 씬 Infinity).
        // 페리 항해 중에도 광장 씬이므로 이 경로가 그대로 실거리를 실어, 배 위에서 지나치는
        // 상대와 대화가 이어진다(의도된 동작). 씬 전환·공항 피어 편입은 헬퍼가 처리한다.
        emitDistances() { emitPeerDistances(this, bus); }

        spawnHeart() {
          if (!this.pet) return;
          const h = this.add.image(this.pet.x, this.pet.y - 12, 't_heart').setScale(TSCALE).setDepth(10001);
          this.tweens.add({ targets: h, y: h.y - 26, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
        }

        // 그리디 축우선 스텝(탭 이동). 막히면 정지.
        tapStepDir() {
          if (!this.tapTile) return null;
          if (this.tapTile.x === this.pTileX && this.tapTile.y === this.pTileY) { this.tapTile = null; return null; }
          let dir = null;
          if (this.tapTile.x !== this.pTileX) dir = this.tapTile.x > this.pTileX ? 'right' : 'left';
          else if (this.tapTile.y !== this.pTileY) dir = this.tapTile.y > this.pTileY ? 'down' : 'up';
          return dir;
        }

        update(time, delta) {
          if (time - this.lastWorldLightingUpdate > 500) {
            this.lastWorldLightingUpdate = time;
            const phase = worldClockRef.current?.phase;
            this.worldLightingOverlay.setAlpha(['night', 'late-night'].includes(phase) ? 0.24
              : phase === 'dawn' || phase === 'evening' ? 0.1 : 0);
          }
          // 카메라 주변 장식 생성/회수(매 프레임 — 컬링·상한으로 저비용).
          this.refreshTerrainPages();
          const cameraView = this.cameras.main?.worldView;
          const cameraReady = cameraView
            && [cameraView.x, cameraView.y, cameraView.width, cameraView.height].every(Number.isFinite)
            && cameraView.width > 0 && cameraView.height > 0;
          if (cameraReady) this.overworldOverlay?.updateCamera(cameraView);
          this.animateWater();
          this.updateDecor();
          if (time - this.lastOverworldVehicleUpdate > 500) {
            this.lastOverworldVehicleUpdate = time;
            this.overworldVehicles = activeOverworldVehiclesAt(worldClockRef.current?.totalGameMinutes);
            if (cameraReady) this.overworldOverlay?.updateVehicles(this.overworldVehicles, cameraView);
          }

          // ── 플레이어 이동 상태기계 (facing→step→hold 연속) ──
          if (!this.moving && !this.inputLocked) {
            const held = this.heldDirs.length ? this.heldDirs[this.heldDirs.length - 1] : null;
            if (held) {
              if (this.facing !== held) {
                this.facing = held;               // 먼저 몸만 돌린다
                this.turnGrace = time + TURN_MS;  // 이 유예 안에 떼면 제자리 회전만
              } else if (time >= this.turnGrace) {
                const [dx, dy] = DIRV[held];
                if (!this.blocked(this.pTileX + dx, this.pTileY + dy)) this.startStep(held);
                // 막히면 facing만 유지(제자리 걸음 없음)
              }
            } else {
              const tdir = this.tapStepDir();
              if (tdir) {
                this.facing = tdir;
                const [dx, dy] = DIRV[tdir];
                if (!this.blocked(this.pTileX + dx, this.pTileY + dy)) this.startStep(tdir);
                else this.tapTile = null;         // 막히면 정지
              }
            }
          }

          // 달리기 중이면 보행 프레임도 2배속(RUN_ANIM_MS). 정지·걷기 판정은 moving 그대로.
          const charAnimMs = this.runHeld ? RUN_ANIM_MS : CHAR_ANIM_MS;
          this.setCharFrame(this.player, 'pc', this.facing, this.moving, time, charAnimMs);
          this.player.setDepth(this.player.y);

          // ── 펫: 목표 타일 중심으로 수동 그리드 추적 + 뒤뚱/바운스 ──
          const petObj = petRef.current || {};
          const tgx = this.petTargetX * TILE + TILE / 2, tgy = this.petTargetY * TILE + TILE / 2;
          const pdx = tgx - this.petPX, pdy = tgy - this.petPY;
          const pdist = Math.hypot(pdx, pdy);
          const petMoving = pdist > 0.5;
          if (petMoving) {
            // 플레이어가 달리면 펫도 같은 속도로 따라붙는다(뒤처짐 방지).
            const petStepMs = this.runHeld ? RUN_STEP_MS : STEP_MS;
            const stepPx = (TILE / petStepMs) * delta;
            const k = Math.min(1, stepPx / pdist);
            this.petPX += pdx * k; this.petPY += pdy * k;
            if (Math.abs(pdx) > Math.abs(pdy)) this.petFlip = pdx < 0;
          }
          // 이동 중엔 빠른 뒤뚱(WALK_MS), 정지 중엔 느긋한 idle(PET_IDLE_MS) — 둘 다 2프레임 스왑.
          const petFrameMs = petMoving ? WALK_MS : PET_IDLE_MS;
          this.pet.setTexture(this.petTexKey(Math.floor(time / petFrameMs) % 2));
          this.pet.setScale(TSCALE * this.petLevelScale());
          this.pet.setFlipX(this.petFlip);
          let petRenderY = this.petPY;
          if (petObj.mood === 'happy' || petObj.mood === 'excited') {
            petRenderY -= Math.abs(Math.sin(time / 1000 * 6)) * 4;
          }
          petRenderY -= (this.petJumpVal || 0) * 18; // 퀘스트 완료 점프 연출
          this.pet.setPosition(Math.round(this.petPX), Math.round(petRenderY));
          this.pet.setDepth(this.petPY);

          // ── 원격 플레이어: 목적 타일까지 그리드 스텝 + 라벨/배 추적(공용 헬퍼) ──
          // 물 위(바다·강·호수) 피어엔 배 도트를 붙인다 — 페리 항해 중인 상대가 바다를 건너는 게 보인다.
          updateScenePeers(this, time, { charPrefix: 'pr', isWater: (tx, ty) => this.isWaterTile(tx, ty) });

          // ── 말풍선: 대상 캐릭터(플레이어/피어) 위로 따라붙인다. 대상이 사라졌으면 정리. ──
          for (const [uid, b] of this.bubbles) {
            if (!b.text || !b.target || !b.target.active) { b.timer?.remove(); b.text?.destroy(); this.bubbles.delete(uid); continue; }
            b.text.setPosition(Math.round(b.target.x), Math.round(b.target.y) - PEER_LABEL_DY - 12);
          }

          // ── local:state — ~100ms 스로틀 (좌표는 예전과 동일 스케일의 월드 px) ──
          // scene:'plaza' 를 실어 WorldPage 가 저장 씬을 구분한다(공항 씬은 자체 emit).
          // ── persistable 계약(session.js isPersistablePosition 참고) ──
          //   페리 항해 중(this.ferrying)이거나 물 타일 위 좌표는 persistable:false 로 표시한다.
          //   이 좌표들은 재접속 스폰 검증(plaza 보행 타일만 통과)을 못 넘겨 서울 폴백을 유발하므로,
          //   WorldPage 위치 기록기가 저장·livePosRef 갱신에서 제외한다(마지막 유효 플라자 좌표 유지).
          //   네트워크 송신(net.sendState)에는 계속 실려 상대 화면엔 바다를 건너는 연출이 보인다.
          if (time - this.lastEmit > 100) {
            this.lastEmit = time;
            const onWater = this.isWaterTile(Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE));
            bus.emit('local:state', {
              x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.facing, scene: 'plaza',
              persistable: !this.ferrying && !onWater,
            });
          }

          // 페리 항해 중엔 근접 판정을 보류한다(바다를 지나며 항구 프롬프트가 튀지 않게).
          if (this.ferrying) return;

          // 표지판 근접 → React 오버레이 토글.
          const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.signX, this.signY) < QUEST_RANGE;
          if (near !== this.wasNear) { this.wasNear = near; setNearQuest(near); }

          // ── 장소 노드/명산 근접: 가장 가까운 노드(게이트 유무 무관)를 React 로 통지. ──
          // 라벨은 없다 — A(말 걸기)로 gate(우선) 또는 desc 설명 박스를 연다. desc/gate 는 노드 데이터에서.
          let nearest = null, nearestD = NODE_TALK_RANGE;
          for (const v of this.nodeViews) {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, v.wx, v.wy);
            if (d < nearestD) { nearest = v.node; nearestD = d; }
          }
          const nid = nearest ? nearest.id : null;
          if (nid !== this.wasNearNodeId) {
            this.wasNearNodeId = nid;
            setNearNode(toInteractiveNode(nearest));
          }
        }
      }

      // 공항 스토리 씬 — 같은 게임에 등록(WorldScene가 autostart, airport는 게이트 진입 시 start).
      // ctx: 씬 ↔ React 브리지(페이즈 통지·sceneRef 바인딩·펫/닉네임 소스). 신규 bus 이벤트 없음.
      const airportCtx = {
        petRef, nickRef, avatarRef,
        bindScene: (s) => { sceneRef.current = s; },
        // create 말미 — 피어 스냅샷 재적용 + 전체 키 거리 1회 emit(씬 전환 음성 잔류 차단, Codex P1-2).
        onReady: () => resetScenePeers(),
        notifyPhase: (phase) => {
          if (phase === 'walking') { setStoryActive(true); setStoryPhase('walking'); setStoryIdx(0); setShowKo(false); }
          else if (phase === 'arrived') { setStoryPhase('dialogue'); setStoryIdx(0); setShowKo(false); }
        },
      };
      const AirportScene = buildAirportScene(Phaser, airportCtx);
      const MsmAbbeyScene = buildMsmAbbeyScene(Phaser, {
        bindScene: (scene) => { sceneRef.current = scene; },
        onEnter: () => {
          setActiveScene(MSM_ABBEY_SCENE_KEY);
          setNearNode(null); setDescOpen(false); setMinimapOpen(false);
          setNearStation(null); setStationSelect(null); setTransitStatus(null);
        },
        onReturn: (scene) => setActiveScene(scene),
      });

      const corridorCtx = {
        userId, avatarRef, worldClockRef,
        bindScene: (scene) => { sceneRef.current = scene; },
        onEnter: () => {
          setActiveScene('transsib-corridor');
          setNearNode(null); setNearQuest(false); setDescOpen(false); setMinimapOpen(false);
          setNearStation(null); setStationSelect(null); setTransitStatus(null);
          setCorridorPrompt(null); setCorridorStatus(null);
          setRegionNearGate(null); setRegionGatePrompt(null); setRegionStatus(null);
        },
        setNearStop: (stop) => setCorridorNear(stop),
        setStatus: (status) => setCorridorStatus(status),
        requestBoarding: (prompt) => setCorridorPrompt(prompt),
        persistPosition: async (position) => {
          if (!userId || !position) return false;
          try {
            const response = await fetch('/api/world/position', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(position), keepalive: true,
            });
            return response.ok;
          } catch { return false; }
        },
        onReady: () => resetScenePeers(),
      };
      const TranssibCorridorScene = buildTranssibCorridorScene(Phaser, corridorCtx);

      const regionScenes = OVERWORLD_REGION_LIST.map((region) => buildOverworldRegionScene(Phaser, region, {
        userId, avatarRef, canAccessPreviewRegionsRef,
        bindScene: (scene) => { sceneRef.current = scene; },
        onEnter: () => {
          setActiveScene(region.sceneId);
          setNearNode(null); setNearQuest(false); setDescOpen(false); setMinimapOpen(false);
          setNearStation(null); setStationSelect(null); setTransitStatus(null);
          setCorridorNear(null); setCorridorPrompt(null); setCorridorStatus(null);
          setRegionNearGate(null); setRegionGatePrompt(null); setRegionStatus(null);
          setAirHubPrompt(null); setAirHubStatus(null);
        },
        worldNodes: WORLD_NODES,
        hasCity: (cityId) => !!CITY_DATA[cityId],
        setNearGate: (gate) => setRegionNearGate(gate),
        setNearNode: (node) => setNearNode(toInteractiveNode(node)),
        setStatus: (status) => setRegionStatus(status),
        requestGate: (prompt) => setRegionGatePrompt(prompt),
        requestNode: (node) => {
          const interactive = toInteractiveNode(node);
          if (!interactive?.noStamp) collectStampRef.current?.(interactive);
          if (interactive?.gate?.type === 'city') {
            setCityPrompt({ to: interactive.gate.to, name: interactive.name });
          } else if (interactive?.gate?.type === 'ferry') {
            const destination = getNode(interactive.gate.to);
            setFerryPrompt({ toId: interactive.gate.to, toName: destination?.name || '' });
          } else if (interactive?.gate?.type === 'story-scene' && interactive.gate.scene === 'airport') {
            sceneRef.current?.enterAirport?.();
          } else if (interactive) setDescOpen(true);
        },
        onAirportEnter: () => {
          setActiveScene('airport');
          setNearNode(null); setRegionNearGate(null); setRegionGatePrompt(null); setRegionStatus(null);
          setAirHubPrompt(null); setAirHubStatus(null);
        },
        airReturnSpawn: () => {
          const airport = getNode('incheon-airport');
          return airport ? { scene: 'plaza', x: airport.tile[0], y: airport.tile[1] } : null;
        },
        persistPosition: async (position) => {
          if (!userId || !position) return false;
          try {
            const response = await fetch('/api/world/position', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(position), keepalive: true,
            });
            return response.ok;
          } catch { return false; }
        },
        onReady: () => resetScenePeers(),
      }));

      // 🏙️ 도시 정밀맵 씬(들) — CityScene 은 1개 팩토리를 cityId 로 파라미터화. 씬 키 'city:<id>'.
      // ctx: 씬 ↔ React 브리지(sceneRef 바인딩 · 근접 노드 통지 · 진입 통지 · 전국맵 복귀 스폰).
      const cityScenes = Object.values(CITY_DATA).map((cityData) => {
        const rn = getNode(cityData.returnNode);
        const cityCtx = {
          userId, petRef, nickRef, avatarRef,
          bindScene: (s) => { sceneRef.current = s; },
          onEnter: () => {
            setActiveScene(`city:${cityData.id}`);
            setNearNode(null); setNearQuest(false); setCityPrompt(null); setChapterPrompt(null); setDescOpen(false); setMinimapOpen(false);
            setNearStation(null); setStationSelect(null); setStationToast(null); setTransitStatus(null);
            setCorridorNear(null); setCorridorPrompt(null); setCorridorStatus(null);
            setRegionNearGate(null); setRegionGatePrompt(null); setRegionStatus(null);
          },
          setNear: (node) => setNearNode(node),
          setNearStation: (st) => setNearStation(st),           // 🚃 역 근접 → 행선지 프롬프트
          arrivedStation: (st) => setStationToast(st),          // 🚃 정기 교통 도착 확인 토스트
          setTransitStatus: (status) => setTransitStatus(status),
          worldClockRef,
          travelBlocked: () => setStationToast({ icon: '⚠', nameJa: '지금은 이동할 수 없어요', yomi: '' }), // P1: 도착 불가 취소
          // create 말미 — 피어 스냅샷 재적용 + 전체 키 거리 1회 emit(씬 전환 음성 잔류 차단, Codex P1-2).
          onReady: () => resetScenePeers(),
          onStoryEnter: (sceneId) => setActiveScene(sceneId),
          worldReturn: {
            scene: 'plaza',
            x: rn ? rn.tile[0] : POI.SEOUL.x,
            y: rn ? rn.tile[1] : POI.SEOUL.y,
          },
        };
        return buildCityScene(Phaser, cityData, cityCtx);
      });

      // Scale.NONE — Phaser 내부 드로잉 버퍼를 320×288(2배 백킹)로 고정하고, 화면 확대는 CSS로 직접 제어한다.
      // (Phaser의 FIT/RESIZE는 비정수 배율을 허용해 도트가 뭉개진다. 정수 배율만 보장하려면
      //  CSS width/height를 320·288의 정수배로 세팅하고 image-rendering:pixelated로 굽는 편이 견고하다.)
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        backgroundColor: '#7fb060',
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.NONE, width: VIEW_W, height: VIEW_H },
        scene: [WorldScene, AirportScene, MsmAbbeyScene, TranssibCorridorScene, ...regionScenes, ...cityScenes],
      });
      gameRef.current = game;
      if (game.canvas) game.canvas.style.imageRendering = 'pixelated';
      if (localWorldDebugEnabled()) {
        debugBridge = Object.freeze({
          snapshot: () => sceneRef.current?.overworldRuntimeSnapshot?.() ?? null,
          teleport: (x, y) => sceneRef.current?.debugTeleportTo?.(x, y)
            ?? Promise.reject(new Error('world scene is not ready')),
          enterTranssib: (stopId) => sceneRef.current?.enterTranssib?.(stopId),
          enterRegion: (regionId) => sceneRef.current?.enterOverworldRegion?.(regionId),
        });
        window.__MANABI_WORLD_DEBUG__ = debugBridge;
      }

      // ── 정수 배율 피팅 — 컨테이너(셸 화면 영역)에 맞춰 ×floor(min(w/320,h/288)), 최소 ×1 ──
      // (백킹이 예전 160×144의 2배가 됐으므로 ×1이 예전 ×2와 동일한 화면 크기를 만든다.)
      const fitCanvas = () => {
        const host = hostRef.current;
        const canvas = gameRef.current?.canvas;
        if (!host || !canvas) return;
        const w = host.clientWidth, h = host.clientHeight;
        let s = Math.floor(Math.min(w / VIEW_W, h / VIEW_H));
        if (!Number.isFinite(s) || s < MIN_SCALE) s = MIN_SCALE;
        canvas.style.width = `${VIEW_W * s}px`;
        canvas.style.height = `${VIEW_H * s}px`;
      };
      fitCanvas();
      if (typeof ResizeObserver !== 'undefined' && hostRef.current) {
        ro = new ResizeObserver(fitCanvas);
        ro.observe(hostRef.current);
      }

      if (destroyed) { if (ro) { ro.disconnect(); ro = null; } game.destroy(true); gameRef.current = null; }
    })();

    return () => {
      destroyed = true;
      // 버스 off를 파이저 lifecycle과 무관하게 여기서 확실히 수행(재방문 누수 차단).
      bus.off('peers:update', onPeers);
      bus.off('quest:scored', onQuestScored);
      bus.off('quest:done', onQuestDone);
      bus.off('chat:msg', onChatMsg);
      if (ro) { ro.disconnect(); ro = null; }
      if (debugBridge && window.__MANABI_WORLD_DEBUG__ === debugBridge) {
        delete window.__MANABI_WORLD_DEBUG__;
      }
      sceneRef.current = null;
      if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }
    };
  }, []);

  const activeOverworldRegion = overworldRegionByScene(activeScene);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0b0d08' }}>
      {/* 캔버스(320×288, 2배 백킹)를 정수 배율로 확대한 뒤 화면 영역 중앙에 배치. 도트는 pixelated로 보존. */}
      <div ref={hostRef} style={{
        width: '100%', height: '100%',
        display: 'grid', placeItems: 'center', imageRendering: 'pixelated',
      }} />

      <div style={{
        position: 'absolute', left: 6, top: 6, zIndex: 5, pointerEvents: 'none',
        fontFamily: GBC.font, fontSize: '0.62rem', color: GBC.ink,
        background: GBC.cream, border: `2px solid ${GBC.border}`,
        boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
        padding: '3px 6px', lineHeight: 1.35,
      }}>
        🕰 {formatWorldTime(worldClock)}
        {activeScene.startsWith('city:') && (() => {
          const cityId = activeScene.slice(5);
          const weather = cityWeatherAt(cityId, worldClock);
          const event = worldEventAt(cityId, worldClock);
          return <span style={{ display: 'block', opacity: 0.78 }}>{weather.icon} {weather.label} · {event.label}</span>;
        })()}
        {activeScene === 'transsib-corridor' && <span style={{ display: 'block', opacity: 0.78 }}>🚆 횡단열차 회랑</span>}
        {activeScene.startsWith('overworld:') && (
          <span style={{ display: 'block', opacity: 0.78 }}>🌍 {activeOverworldRegion?.label}</span>
        )}
      </div>

      {activeOverworldRegion?.boundaryNotice && (
        <div
          role="note"
          style={{
            position: 'absolute', right: 6, top: 6, zIndex: 4, pointerEvents: 'none',
            width: 'min(62%, 280px)', fontFamily: GBC.font, fontSize: '0.5rem',
            color: GBC.ink, background: 'rgba(245, 238, 202, 0.88)',
            border: `1px solid ${GBC.border}`, borderRadius: 2,
            padding: '3px 5px', lineHeight: 1.4,
          }}
        >
          경계 표기 안내 · {activeOverworldRegion.boundaryNotice}
        </div>
      )}

      {/* 조작 힌트 — GBC 다이얼로그 문법(크림 칩, 하드 엣지). */}
      <div style={{
        position: 'absolute', left: 6, bottom: 6, pointerEvents: 'none',
        fontFamily: GBC.font, fontSize: '0.6rem', color: GBC.ink,
        background: GBC.cream, border: `2px solid ${GBC.border}`,
        boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`,
        padding: '3px 6px', borderRadius: 2, lineHeight: 1.35,
      }}>
        {activeScene === 'transsib-corridor'
          ? '✚ 플랫폼 이동 · Ⓐ 탑승/하차 · Ⓑ 닫기'
          : activeScene.startsWith('overworld:')
            ? '✚ 지역 이동 · Ⓐ 역 이용 · Ⓑ 닫기'
            : '✚ 이동 · Ⓐ 말 걸기 · Ⓑ 닫기 · Ⓑ홀드 달리기'}
      </div>

      {/* 표지판 근접 → '말 걸기' 프롬프트. Phaser 내 DOM 금지 → React 오버레이. (오너 지시: 게임 내에서 진행) */}
      {nearQuest && !reviewOpen && !storyActive && !chapterPrompt && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          ...gbcPanel, width: 'min(90%, 360px)', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🪧</span>
          <span style={{ flex: 1, fontSize: '0.8rem', lineHeight: 1.5 }}>
            표지판이 말을 걸어와요 — 지금 복습하면 펫이 자라요.
          </span>
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap' }}
          >
            말 걸기
          </button>
        </div>
      )}

      {/* 우상단 미니맵 버튼(GBC 칩) — 셸 START/SELECT와 충돌 없게 게임 화면 안에 별도 배치. */}
      {activeScene !== 'transsib-corridor' && !activeScene.startsWith('overworld:') && !reviewOpen && !storyActive && !ferryPrompt && !cityPrompt && !chapterPrompt && !albumOpen && !gameMenuOpen && (
        <button
          type="button"
          aria-label={minimapOpen ? '지도 닫기' : '지도 열기'}
          onClick={() => setMinimapOpen((v) => !v)}
          style={{
            position: 'absolute', top: 6, right: 6, zIndex: 5,
            fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink, cursor: 'pointer',
            background: minimapOpen ? GBC.creamHi : GBC.cream, border: `2px solid ${GBC.border}`,
            boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
            padding: '3px 6px', lineHeight: 1,
          }}
        >
          🗺
        </button>
      )}

      {/* 📒 공통 게임 메뉴 — 캐릭터·가방·도감·임무를 한 진입점으로 묶는다. */}
      {!reviewOpen && !storyActive && !ferryPrompt && !cityPrompt && !chapterPrompt && !minimapOpen && !albumOpen && !gameMenuOpen
        && !descOpen && !npcDialog && !stationSelect && (
        <button
          type="button"
          aria-label="여행 수첩 열기"
          onClick={() => setGameMenuOpen(true)}
          style={{
            position: 'absolute', top: 6, right: 36, zIndex: 5,
            fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink, cursor: 'pointer',
            background: GBC.cream, border: `2px solid ${GBC.border}`,
            boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
            padding: '3px 6px', lineHeight: 1,
          }}
        >
          📒
        </button>
      )}

      {/* 미니맵 오버레이 — 전국(다운샘플 4색) 또는 도시(구역 라벨) + 플레이어/노드 점. B로도 닫힘. */}
      {minimapOpen && (
        <Minimap sceneRef={sceneRef} activeScene={activeScene} onClose={() => setMinimapOpen(false)} />
      )}

      {/* 장소 게이트 근접 → 상호작용 프롬프트(story-scene: 공항 진입 · ferry: 페리 · city: 도시 진입). 설명 병기. */}
      {nearNode?.gate && !storyActive && !reviewOpen && !ferryPrompt && !cityPrompt && !chapterPrompt && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          ...gbcPanel, width: 'min(90%, 360px)', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>
            {nearNode.gate.type === 'ferry' ? '⚓'
              : nearNode.gate.type === 'city' ? '🏙️'
                : nearNode.gate.scene === 'airport' ? '✈' : '🏛️'}
          </span>
          <span style={{ flex: 1, fontSize: '0.8rem', lineHeight: 1.5 }}>
            {nearNode.name} {nearNode.gate.label || ''} — {nearNode.gate.type === 'ferry' ? '페리를 탈까요?'
              : nearNode.gate.type === 'city' ? '시내로 들어갈까요?'
                : nearNode.gate.scene === 'airport' ? '탑승할까요?' : '들어갈까요?'}
            {nearNode.desc && (
              <span style={{ display: 'block', fontSize: '0.68rem', opacity: 0.82, marginTop: 3, lineHeight: 1.45 }}>
                {nearNode.desc}
              </span>
            )}
            {newStamp?.id === nearNode.id && (
              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 'bold', color: '#2f7a2a', marginTop: 4 }}>
                🗾 {nearNode.name} 기념 스탬프!
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              collectStampRef.current?.(nearNode); // 마우스 클릭 경로도 스탬프 수집
              if (nearNode.gate.type === 'ferry') {
                const dest = getNode(nearNode.gate.to);
                setFerryPrompt({ toId: nearNode.gate.to, toName: dest?.name || '' });
              } else if (nearNode.gate.type === 'city') {
                setCityPrompt({ to: nearNode.gate.to, name: nearNode.name });
              } else if (nearNode.gate.scene === 'airport') {
                sceneRef.current?.enterAirport?.();
              } else {
                sceneRef.current?.enterStoryScene?.(nearNode.gate.scene);
              }
            }}
            style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap' }}
          >
            {nearNode.gate.type === 'ferry' ? '타기' : '들어가기'}
          </button>
        </div>
      )}

      {/* 도시 진입 확인 다이얼로그 — 페이드 후 도시 정밀맵으로 전환. B(cancel)로 닫힘(페리와 동일 문법). */}
      {cityPrompt && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center',
          background: 'rgba(11,13,8,0.55)',
        }}>
          <div style={{ ...gbcPanel, width: 'min(86%, 320px)', padding: '16px 16px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', lineHeight: 1, marginBottom: 8 }}>🏙️</div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 14px' }}>
              {cityPrompt.name} 시내로 들어갈까요?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => { const to = cityPrompt.to; setCityPrompt(null); sceneRef.current?.enterCity?.(to); }}
                style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap' }}
              >
                들어가기
              </button>
              <button
                type="button"
                onClick={() => setCityPrompt(null)}
                style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap', background: GBC.cream, color: GBC.ink }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학습 도어 확인 — 문화 챕터/장소 독해 A → 확인 후 안전 경로로 이동. B(cancel)로 닫힘. */}
      {chapterPrompt && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center',
          background: 'rgba(11,13,8,0.55)',
        }}>
          <div style={{ ...gbcPanel, width: 'min(86%, 320px)', padding: '16px 16px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', lineHeight: 1, marginBottom: 8 }}>🚪</div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 14px' }}>
              {chapterPrompt.reading
                ? `${chapterPrompt.node.name}에서 이어지는 이야기를 읽을까요?`
                : `${chapterPrompt.node.name} 문화 챕터를 시작할까요?`}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  const { chapter, reading, node } = chapterPrompt;
                  setChapterPrompt(null);
                  if (!node.noStamp) collectStampRef.current?.(node);
                  if (reading) onOpenReading?.(reading);
                  else onOpenChapter?.(chapter);
                }}
                style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap' }}
              >
                {chapterPrompt.reading ? '읽기' : '시작'}
              </button>
              <button
                type="button"
                onClick={() => setChapterPrompt(null)}
                style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap', background: GBC.cream, color: GBC.ink }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {airHubPrompt && activeScene === 'plaza' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 8, display: 'grid', placeItems: 'center',
          background: 'rgba(11,13,8,0.62)',
        }}>
          <div style={{ ...gbcPanel, width: 'min(90%, 350px)', padding: '14px 14px 12px' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 'bold', textAlign: 'center', marginBottom: 4 }}>
              ✈️ {airHubPrompt.node.name} 여행 터미널
            </div>
            <div style={{ fontSize: '0.66rem', opacity: 0.75, textAlign: 'center', marginBottom: 10 }}>
              도착 위치를 먼저 안전하게 저장한 뒤 출발해요
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {airHubPrompt.destinations.map((destination) => (
                <button
                  key={destination.id}
                  type="button"
                  onClick={() => sceneRef.current?.flyToOverworldRegion?.(destination.id)}
                  style={{ ...gbcButtonPrimary, textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 8 }}
                >
                  <span>{destination.label}</span>
                  <span style={{ opacity: 0.72 }}>{destination.preview ? '관리자 미리보기' : '항공편'}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAirHubPrompt(null);
                  sceneRef.current?.enterAirport?.();
                }}
                style={{ ...gbcButtonPrimary, textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 8 }}
              >
                <span>하네다 입국심사 학습</span><span style={{ opacity: 0.72 }}>스토리</span>
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setAirHubPrompt(null)}
                style={{ ...gbcButtonPrimary, background: GBC.cream, color: GBC.ink, fontSize: '0.7rem', padding: '3px 10px' }}
              >
                취소 Ⓑ
              </button>
            </div>
          </div>
        </div>
      )}

      {airHubStatus && activeScene === 'plaza' && (
        <div style={{
          position: 'absolute', left: '50%', top: 42, transform: 'translateX(-50%)', zIndex: 9,
          fontFamily: GBC.font, fontSize: '0.68rem', color: GBC.ink, textAlign: 'center',
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '6px 11px', lineHeight: 1.5, minWidth: 220,
        }}>
          {airHubStatus.phase === 'saving' && <>💾 {airHubStatus.destination.label} 도착 위치 저장 중…</>}
          {airHubStatus.phase === 'error' && (
            <>
              ⚠ {airHubStatus.message}
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setAirHubStatus(null)}
                  style={{ ...gbcButtonPrimary, fontSize: '0.66rem', padding: '2px 8px' }}
                >
                  닫기 Ⓑ
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {corridorNear && !corridorPrompt && !corridorStatus && activeScene === 'transsib-corridor' && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink,
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '4px 10px', lineHeight: 1.2, whiteSpace: 'nowrap',
        }}>
          🚆 Ⓐ {corridorNear.name} 횡단열차
        </div>
      )}

      {corridorPrompt && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 8, display: 'grid', placeItems: 'center',
          background: 'rgba(11,13,8,0.62)',
        }}>
          <div style={{ ...gbcPanel, width: 'min(88%, 340px)', padding: '14px 14px 12px' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 'bold', textAlign: 'center', marginBottom: 4 }}>
              🚆 {corridorPrompt.stop.name} 출발
            </div>
            <div style={{ fontSize: '0.66rem', opacity: 0.75, textAlign: 'center', marginBottom: 10 }}>
              탑승 전에 종착 플랫폼을 안전하게 저장해요
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {corridorPrompt.options.map((terminal) => (
                <button
                  key={terminal.id}
                  type="button"
                  onClick={() => {
                    setCorridorPrompt(null);
                    sceneRef.current?.boardTo?.(terminal.id);
                  }}
                  style={{ ...gbcButtonPrimary, textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>{terminal.name}행</span><span style={{ opacity: 0.72 }}>직접 하차</span>
                </button>
              ))}
              {corridorPrompt.regionGate && (
                <button
                  type="button"
                  onClick={() => {
                    setCorridorPrompt(null);
                    sceneRef.current?.leaveToRegion?.();
                  }}
                  style={{ ...gbcButtonPrimary, textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>{corridorPrompt.regionGate.label}로 나가기</span><span style={{ opacity: 0.72 }}>지역 진입</span>
                </button>
              )}
            </div>
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setCorridorPrompt(null)}
                style={{ ...gbcButtonPrimary, background: GBC.cream, color: GBC.ink, fontSize: '0.7rem', padding: '3px 10px' }}
              >
                취소 Ⓑ
              </button>
            </div>
          </div>
        </div>
      )}

      {corridorStatus && activeScene === 'transsib-corridor' && (
        <div style={{
          position: 'absolute', left: '50%', top: 42, transform: 'translateX(-50%)', zIndex: 7,
          fontFamily: GBC.font, fontSize: '0.68rem', color: GBC.ink, textAlign: 'center',
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '6px 11px', lineHeight: 1.5, minWidth: 220,
        }}>
          {corridorStatus.phase === 'saving' && <>💾 종착 플랫폼 저장 중…</>}
          {corridorStatus.phase === 'saving-stop' && <>💾 하차 위치 저장 중…</>}
          {corridorStatus.phase === 'saving-region' && <>💾 지역 진입 위치 저장 중…</>}
          {corridorStatus.phase === 'waiting' && (
            <>🚉 {corridorStatus.terminal?.name}행<br />
              {formatTransitMinute(corridorStatus.departureMinute)} 출발 · 현실 약 {Math.max(0, Math.ceil((corridorStatus.departureMinute - worldClock.totalGameMinutes) * 60 / WORLD_TIME_SCALE))}초
            </>
          )}
          {corridorStatus.phase === 'riding' && <>🚆 {corridorStatus.terminal?.name} 방면 이동 중</>}
          {corridorStatus.phase === 'stopped' && (
            <>🚉 {corridorStatus.stop?.name} 정차 · Ⓐ 지금 내리기<br /><span style={{ opacity: 0.72 }}>내리지 않으면 다음 구간으로 계속 가요</span></>
          )}
          {corridorStatus.phase === 'terminal' && (
            <>🚉 {corridorStatus.stop?.name} 종착 · Ⓐ 내리기<br /><span style={{ opacity: 0.72 }}>종착 플랫폼은 이미 안전하게 저장됐어요</span></>
          )}
          {corridorStatus.phase === 'error' && (
            <>
              ⚠ {corridorStatus.message || '요청을 완료하지 못했어요.'}
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setCorridorStatus(null)}
                  style={{ ...gbcButtonPrimary, fontSize: '0.66rem', padding: '2px 8px' }}
                >
                  닫기 Ⓑ
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {regionNearGate && !regionGatePrompt && !regionStatus && activeScene.startsWith('overworld:') && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink,
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '4px 10px', lineHeight: 1.2, whiteSpace: 'nowrap',
        }}>
          {regionNearGate.gate.type === 'air-gate' ? '✈️' : '🚆'} Ⓐ {regionNearGate.gate.label}
        </div>
      )}

      {regionGatePrompt && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 8, display: 'grid', placeItems: 'center',
          background: 'rgba(11,13,8,0.62)',
        }}>
          <div style={{ ...gbcPanel, width: 'min(88%, 340px)', padding: '14px 14px 12px' }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 'bold', textAlign: 'center', marginBottom: 4 }}>
              {regionGatePrompt.gate.type === 'air-gate' ? '✈️' : '🚆'} {regionGatePrompt.gate.label}
            </div>
            <div style={{ fontSize: '0.66rem', opacity: 0.75, textAlign: 'center', marginBottom: 10 }}>
              {regionGatePrompt.gate.type === 'air-gate'
                ? '인천공항으로 돌아갈까요?'
                : regionGatePrompt.gate.type === 'rail-hub'
                  ? '관리자 미리보기 · 실제 운행 시간은 아직 확정되지 않았어요.'
                  : '횡단열차 회랑 플랫폼으로 이동할까요?'}
            </div>
            {regionGatePrompt.gate.type === 'rail-hub' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 210, overflowY: 'auto' }}>
                {regionGatePrompt.options.length === 0 && (
                  <div style={{ fontSize: '0.64rem', lineHeight: 1.5, textAlign: 'center', opacity: 0.78 }}>
                    영불해협 철도 연결 방식이 확정될 때까지 이 허브의 대륙 노선은 운행하지 않아요.
                  </div>
                )}
                {regionGatePrompt.options.map((destination) => (
                  <button
                    key={destination.id}
                    type="button"
                    onClick={() => {
                      setRegionGatePrompt(null);
                      sceneRef.current?.boardRailTo?.(destination.id);
                    }}
                    style={{ ...gbcButtonPrimary, textAlign: 'left' }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{destination.label}행</strong>
                      <span style={{ opacity: 0.72 }}>{destination.stopIds.length - 1}구간</span>
                    </span>
                    <span style={{ display: 'block', marginTop: 3, fontSize: '0.6rem', opacity: 0.72 }}>
                      {destination.stopLabels.join(' → ')}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
                <button
                  type="button"
                  onClick={() => {
                    setRegionGatePrompt(null);
                    if (regionGatePrompt.gate.type === 'air-gate') sceneRef.current?.leaveByAir?.();
                    else sceneRef.current?.enterCorridor?.();
                  }}
                  style={gbcButtonPrimary}
                >
                  이동
                </button>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setRegionGatePrompt(null)}
                style={{ ...gbcButtonPrimary, background: GBC.cream, color: GBC.ink }}
              >
                취소 Ⓑ
              </button>
            </div>
          </div>
        </div>
      )}

      {regionStatus && activeScene.startsWith('overworld:') && (
        <div style={{
          position: 'absolute', left: '50%', top: 42, transform: 'translateX(-50%)', zIndex: 7,
          fontFamily: GBC.font, fontSize: '0.68rem', color: GBC.ink, textAlign: 'center',
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '6px 11px', lineHeight: 1.5, minWidth: 220,
        }}>
          {regionStatus.phase === 'loading' && <>🌍 지역 지형 불러오는 중…</>}
          {regionStatus.phase === 'saving-gate' && <>💾 횡단열차 플랫폼 저장 중…</>}
          {regionStatus.phase === 'saving-air' && <>💾 귀환 공항 저장 중…</>}
          {regionStatus.phase === 'saving-ferry' && <>💾 도착 항구 저장 중…</>}
          {regionStatus.phase === 'saving-rail' && <>💾 종착 철도 허브 저장 중…</>}
          {regionStatus.phase === 'saving-rail-stop' && <>💾 {regionStatus.stopHub?.label || '철도 허브'} 하차 위치 저장 중…</>}
          {regionStatus.phase === 'riding' && regionStatus.preview && (
            <>
              🚆 {regionStatus.toHub?.label} 방면 이동 중
              <br /><span style={{ opacity: 0.72 }}>관리자 수동 진행 · 실제 운행 시간 미확정</span>
              <div style={{ marginTop: 6 }}>
                <button type="button" onClick={() => sceneRef.current?.advanceRailPreview?.()} style={gbcButtonPrimary}>
                  다음 역 도착
                </button>
              </div>
            </>
          )}
          {regionStatus.phase === 'stopped' && regionStatus.preview && (
            <>
              🚉 {regionStatus.stopHub?.label} 정차
              <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 6 }}>
                <button type="button" onClick={() => sceneRef.current?.disembarkRailPreview?.()} style={gbcButtonPrimary}>
                  지금 내리기
                </button>
                <button type="button" onClick={() => sceneRef.current?.continueRailPreview?.()} style={gbcButtonPrimary}>
                  다음 구간
                </button>
              </div>
            </>
          )}
          {regionStatus.phase === 'terminal' && regionStatus.preview && (
            <>
              🚉 {regionStatus.stopHub?.label} 종착
              <div style={{ marginTop: 6 }}>
                <button type="button" onClick={() => sceneRef.current?.disembarkRailPreview?.()} style={gbcButtonPrimary}>
                  내리기
                </button>
              </div>
            </>
          )}
          {regionStatus.phase === 'error' && (
            <>
              ⚠ {regionStatus.message || '요청을 완료하지 못했어요.'}
              <div style={{ marginTop: 6 }}>
                {regionStatus.preview && regionStatus.canDisembark ? (
                  <button
                    type="button"
                    onClick={() => sceneRef.current?.disembarkRailPreview?.()}
                    style={{ ...gbcButtonPrimary, fontSize: '0.66rem', padding: '2px 8px' }}
                  >
                    하차 저장 다시 시도
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRegionStatus(null)}
                    style={{ ...gbcButtonPrimary, fontSize: '0.66rem', padding: '2px 8px' }}
                  >
                    닫기 Ⓑ
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 🚃 역 근접 → "Ⓐ 전철 타기" 프롬프트. A로 행선지 선택 오버레이를 연다. */}
      {nearStation && !transitStatus && !stationSelect && !nearNode && !npcDialog && !storyActive && !reviewOpen && !ferryPrompt && !cityPrompt && !chapterPrompt && !minimapOpen && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink,
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '4px 10px', lineHeight: 1.2, whiteSpace: 'nowrap',
        }}>
          🚃 Ⓐ {nearStation.nameJa} 전철 타기
        </div>
      )}

      {/* 🚃 현재 역에서 직통으로 갈 수 있는 다음 운행편. 선택 후 실제 출발 시각까지 기다린다. */}
      {stationSelect && (() => {
        const cityData = CITY_DATA[stationSelect.cityId];
        const dests = directTransitDestinations(cityData?.transit, cityData?.stations, stationSelect.fromId);
        return (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center',
            background: 'rgba(11,13,8,0.55)',
          }}>
            <div style={{ ...gbcPanel, width: 'min(88%, 340px)', padding: '14px 14px 12px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 'bold', textAlign: 'center', marginBottom: 2 }}>
                🚃 시간표 — 행선지
              </div>
              <div style={{ fontSize: '0.66rem', opacity: 0.72, textAlign: 'center', marginBottom: 10 }}>
                지금 「{stationSelect.fromName}」 · 출발 시각까지 역에서 기다려요
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {dests.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      const scene = sceneRef.current;
                      setStationSelect(null);
                      scene?.reserveTransit?.(stationSelect.fromId, st.id);
                    }}
                    style={{
                      ...gbcButtonPrimary, textAlign: 'left', whiteSpace: 'nowrap',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 'bold' }}>{st.nameJa}</span>
                    <span style={{ fontSize: '0.66rem', opacity: 0.82 }}>
                      {st.yomi}{st.line ? ` · ${st.line}` : ''}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ textAlign: 'right', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setStationSelect(null)}
                  style={{ ...gbcButtonPrimary, fontSize: '0.7rem', padding: '3px 10px', background: GBC.cream, color: GBC.ink }}
                >
                  닫기 Ⓑ
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {transitStatus && (
        <div style={{
          position: 'absolute', left: '50%', top: 42, transform: 'translateX(-50%)', zIndex: 7,
          fontFamily: GBC.font, fontSize: '0.66rem', color: GBC.ink, textAlign: 'center',
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '5px 10px', lineHeight: 1.45, minWidth: 190,
        }}>
          {transitStatus.state === 'waiting' && (
            <>
              🚉 {transitStatus.line} · {transitStatus.to}<br />
              {formatTransitMinute(transitStatus.departureMinute)} 출발 · 현실 약 {Math.max(0, Math.ceil((transitStatus.departureMinute - worldClock.totalGameMinutes) * 60 / WORLD_TIME_SCALE))}초
            </>
          )}
          {transitStatus.state === 'riding' && <>🚃 {transitStatus.line} 이동 중 · {transitStatus.to}행</>}
          {transitStatus.state === 'arrived' && <>✅ {transitStatus.message}</>}
          {transitStatus.state === 'missed' && <>⚠ {transitStatus.message}</>}
        </div>
      )}

      {/* 🚃 정기 교통 도착 확인 토스트 — "🚃 博多駅"(요미 병기). 잠시 뒤 자동 소멸. */}
      {stationToast && (
        <div style={{
          position: 'absolute', left: '50%', top: 16, transform: 'translateX(-50%)',
          fontFamily: GBC.font, fontSize: '0.74rem', color: GBC.ink,
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '5px 12px', lineHeight: 1.2, whiteSpace: 'nowrap', zIndex: 7,
        }}>
          {stationToast.icon || '🚃'} {stationToast.nameJa}
          {stationToast.yomi && <span style={{ fontSize: '0.62rem', opacity: 0.75 }}> {stationToast.yomi}</span>}
        </div>
      )}

      {/* A-2 장소 독해 도어 — 관리자 파일럿 콜백이 있을 때만 노출한다. */}
      {nearNode?.reading && onOpenReading && !chapterPrompt && !npcDialog && !storyActive && !reviewOpen && !ferryPrompt && !cityPrompt && !minimapOpen && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink,
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '4px 10px', lineHeight: 1.2, whiteSpace: 'nowrap',
        }}>
          📖 Ⓐ 이 장소의 이야기 읽기
        </div>
      )}

      {/* 문화 도어 근접 → 챕터 확인 프롬프트. NPC 필드가 함께 있어도 문화 도어가 우선한다. */}
      {nearNode?.chapter && !chapterPrompt && !npcDialog && !storyActive && !reviewOpen && !ferryPrompt && !cityPrompt && !minimapOpen && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink,
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '4px 10px', lineHeight: 1.2, whiteSpace: 'nowrap',
        }}>
          🚪 Ⓐ {nearNode.name} 문화 챕터
        </div>
      )}

      {/* NPC 노드 근접 → "Ⓐ 말 걸기" 프롬프트. chapter 없는 NPC만 대화 오버레이를 연다. */}
      {nearNode?.npc && !nearNode.chapter && !(nearNode.reading && onOpenReading) && !npcDialog && !storyActive && !reviewOpen && !ferryPrompt && !chapterPrompt && !minimapOpen && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink,
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '4px 10px', lineHeight: 1.2, whiteSpace: 'nowrap',
        }}>
          💬 Ⓐ {nearNode.name}에게 말 걸기
        </div>
      )}

      {/* 게이트 없는 노드/명산 근접 → "Ⓐ 살펴보기" 프롬프트(라벨 대신). A로 설명 박스를 연다. */}
      {nearNode && !nearNode.gate && !nearNode.npc && !nearNode.chapter && !(nearNode.reading && onOpenReading) && !descOpen && !storyActive && !reviewOpen && !ferryPrompt && !chapterPrompt && !minimapOpen && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          fontFamily: GBC.font, fontSize: '0.7rem', color: GBC.ink,
          background: GBC.cream, border: `2px solid ${GBC.border}`,
          boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`, borderRadius: 2,
          padding: '4px 10px', lineHeight: 1.2, whiteSpace: 'nowrap',
        }}>
          Ⓐ {nearNode.name} 살펴보기
        </div>
      )}

      {/* GBC 설명 박스 — A로 열고 B(또는 A)로 닫는다. 노드/명산 이름 + desc 1~2문장. */}
      {descOpen && nearNode && !nearNode.gate && !nearNode.chapter && !(nearNode.reading && onOpenReading) && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          ...gbcPanel, width: 'min(92%, 380px)', padding: '12px 14px',
        }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: 6 }}>{nearNode.name}</div>
          <p style={{ fontSize: '0.78rem', lineHeight: 1.6, margin: 0 }}>{nearNode.desc}</p>
          {/* 🗾 스탬프 — 방금 획득이면 강조 한 줄, 이미 수집했으면 도장 자국(은은한 한 줄). */}
          {newStamp?.id === nearNode.id ? (
            <div style={{ marginTop: 8, fontSize: '0.76rem', fontWeight: 'bold', color: '#2f7a2a' }}>
              🗾 {nearNode.name} 기념 스탬프!
            </div>
          ) : stamps.has(nearNode.id) ? (
            <div style={{ marginTop: 8, fontSize: '0.68rem', opacity: 0.68 }}>· 🗾 기념 스탬프 ·</div>
          ) : null}
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setDescOpen(false)}
              style={{ ...gbcButtonPrimary, fontSize: '0.7rem', padding: '3px 10px' }}
            >
              닫기 Ⓑ
            </button>
          </div>
        </div>
      )}

      {/* 페리 확인 다이얼로그 — A→여기, 확인 시 페이드 후 상대 항구로 이동. B(cancel)로 닫힘. */}
      {ferryPrompt && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center',
          background: 'rgba(11,13,8,0.55)',
        }}>
          <div style={{ ...gbcPanel, width: 'min(86%, 320px)', padding: '16px 16px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', lineHeight: 1, marginBottom: 8 }}>⚓</div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 14px' }}>
              {ferryPrompt.toName}행 페리를 탈까요?
              {newStamp && (
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 'bold', color: '#2f7a2a', marginTop: 6 }}>
                  🗾 {newStamp.name} 기념 스탬프!
                </span>
              )}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => { const toId = ferryPrompt.toId; setFerryPrompt(null); sceneRef.current?.ferryTo?.(toId); }}
                style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap' }}
              >
                탑승
              </button>
              <button
                type="button"
                onClick={() => setFerryPrompt(null)}
                style={{ ...gbcButtonPrimary, whiteSpace: 'nowrap', background: GBC.cream, color: GBC.ink }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 인게임 즉석 리뷰 — 캔버스 위 HTML, 열리면 게임 입력 잠금(useEffect). */}
      {reviewOpen && (
        <QuestReview userId={userId} onClose={() => setReviewOpen(false)} />
      )}

      {/* 🗾 여행 스탬프 앨범 — 수집한 방문 기념 배지 케이스. A 입력 잠금(interact 가드) + B/ESC로 닫기. */}
      {albumOpen && (
        <StampAlbum stamps={stamps} onClose={() => setAlbumOpen(false)} />
      )}

      {gameMenuOpen && (
        <WorldGameMenu
          avatar={avatar}
          stamps={stamps}
          totalPlaces={WORLD_NODES.filter((node) => !node.noStamp).length}
          onApplyAvatar={(next) => onAvatarChange?.(next)}
          onClose={() => setGameMenuOpen(false)}
          onOpenStampAlbum={() => { setGameMenuOpen(false); setAlbumOpen(true); }}
          onOpenReview={() => { setGameMenuOpen(false); setReviewOpen(true); }}
          onOpenDictionary={() => onOpenDictionary?.()}
        />
      )}

      {/* 공항 스토리 — 텍스트박스(대사) → 심사관 문답(통과 시 출구 개방). */}
      {storyActive && storyPhase === 'dialogue' && (
        <StoryTextbox
          step={STORY_STEPS[storyIdx]}
          index={storyIdx}
          total={STORY_STEPS.length}
          showKo={showKo}
          onToggleKo={() => setShowKo((v) => !v)}
          onNext={() => advanceStoryRef.current?.()}
          onExit={() => sceneRef.current?.returnPlaza?.()}
        />
      )}
      {storyActive && (storyPhase === 'quiz' || storyPhase === 'passed') && STORY_TEXT && (
        <AirportQuiz
          text={STORY_TEXT}
          onPass={(events) => recordPass(events)}
          onExit={() => sceneRef.current?.returnPlaza?.()}
        />
      )}

      {/* NPC 도트 대화(chapter 없는 NPC) — 캔버스 위 HTML, 열리면 게임 입력 잠금(useEffect).
          완주(onComplete) 시 노드 스탬프 1회 수집(collectStampRef Set 가드 — 재대화해도 중복 없음).
          단 noStamp 노드(WORLD_NODES 밖 도시 NPC — 편의점·이자카야)는 수집하지 않는다: 서버는
          실존 노드(getNode)만 upsert 하므로 미등록 id 는 400 이 되고, 낙관 갱신이 유령 스탬프를
          남긴다. noStamp 를 여기서도 존중해 도시 학습 NPC 는 대화 경험만 준다. */}
      {npcDialog && (
        <NpcDialog
          npcKey={npcDialog.key}
          npcName={npcDialog.node?.name}
          actionRef={npcActionRef}
          cancelRef={npcCancelRef}
          onComplete={() => { if (!npcDialog.node?.noStamp) collectStampRef.current?.(npcDialog.node); }}
          onExit={() => setNpcDialog(null)}
        />
      )}
    </div>
  );
}
