// 🏙️ 학습 월드 — 파라미터화된 "도시 정밀맵" 씬 (CityScene).
//
// 설계 문서: docs/world-city-maps.md. 전국맵(WorldScene 'plaza')의 도시 노드 → 이 씬('city:<id>').
// **CityScene 은 1개, cityId 로 파라미터화** — 도시 정의는 데이터 파일(cities/<id>.js). 도시 추가 = 데이터 1개.
//
// ── 아키텍처 결정(근거) ──
//   · airportScene.js(buildAirportScene) 팩토리 패턴을 그대로 따른다: Phaser 는 동적 import 라
//     팩토리가 클래스를 주입받는다. 도시는 광장처럼 자유 로밍이라 이동·충돌·카메라·달리기·펫 동행·
//     멀티 피어·근접 음성·채팅 말풍선을 광장(WorldScene)과 동일 계약으로 갖춘다.
//   · **공용화 판단**: 원격 피어 렌더·닉네임 라벨·그리드 보간(applyPeersToScene/updateScenePeers)과
//     근접 음성 거리 emit(emitPeerDistances), 캐릭터/펫/NPC 도트 굽기는 sprites.js 공용 헬퍼로 이미
//     추출돼 있어 그대로 재사용한다. 이동 상태기계·펫 추적·입력 스택은 WorldScene 이 GameCanvas
//     useEffect 클로저 안에 인라인 정의돼(모듈 밖으로 못 뺌) 있고, airportScene 도 이미 이 골격을
//     복제한 선례가 있다. BaseScene 로 추출하려면 검증된 광장 배선을 클로저 밖으로 끌어내야 해
//     회귀 위험이 크므로, 파일럿에서는 airport 선례대로 "골격 최소 복제 + 공용 헬퍼 재사용"으로 둔다.
//   · 좌표 스케일(1타일=32 월드 px, 소스16, 배율2, zoom1)은 광장·공항과 완전히 동일.
//
// 접합(문서 §2): local:state(scene:'city:<id>', persistable:true — 도시 내 위치는 저장 대상),
//   applyPeers(도시 scene 필터), emitPeerDistances(500ms), 채팅 말풍선 전역 채널. 물 위 배 표시는
//   도시맵엔 불필요(updateScenePeers 에 isWater 미주입). net.js 무수정 — scene 값만 흘리면 자동 분리.

import {
  CHAR_ORIGIN_Y,
  CHAR_DIRS, CHAR_POSES, charFrameRows,
  PET_KEYS, petFrameRows, PET_W, PET_H,
  CHAR_PAL_LOCAL, CHAR_PAL_REMOTE, PET_PAL,
  NPC_KEYS, NPC_PAL, NPC_W, NPC_H, npcMarkerRows,
  tonePalette, toneColor,
  applyPeersToScene, updateScenePeers, peerLabelStyle, emitPeerDistances,
} from './sprites';
import { GBC } from './QuestReview';
import bus from './bus';
// 🗺️ 표준 지형 코드·충돌 — 공용 단일 진실원(cities/terrain.js, docs §6.4). 렌더·충돌 공용.
import { CITY_TILE as TERRAIN, isCityBlocked, isCityWater, resolveArrivalTile, resolveRespawnTile } from './cities/terrain';
import { cityMetersPerTile, cityScaleTier } from './cities/scale';
// 🧱 청크 RenderTexture 렌더의 순수 로직(가시성·용량·LRU) — docs §6.3. 대형 맵 메모리 상한.
import { CHUNK_TILES, chunkDims, chunkTileBounds, visibleChunks, chunkCapacity, ChunkLRU, planChunkUpdate } from './cityChunks';
import { toInteractiveNode } from './cultureDoors';
import { activeVehiclesAt, planTransitTrip, tripStateAt } from '../../lib/world/transit';
import { cityWeatherAt, nodeLifeAt } from '../../lib/world/worldLife';
import { avatarPalette } from '../../lib/world/avatar';
import { worldSceneReturnTarget } from '../../lib/world/worldSceneReturn';
import { cityBeachTextureKey } from './cityTileSkins';

// ── 좌표 스케일 (광장·공항과 동일 불변) ──
const TILE = 32;
const TEX = 16;
const TSCALE = TILE / TEX;   // = 2
const ZOOM = 1;
const STEP_MS = 200;
const RUN_STEP_MS = 100;
const RUN_ANIM_MS = 50;
const TURN_MS = 90;
const CHAR_ANIM_MS = 100;
const WALK_MS = 110;
const PET_IDLE_MS = 480;
const LABEL_DY = 18;
const PEER_LABEL_DY = 30;
const PEER_LABEL_DEPTH = 15000;
const NODE_TALK_RANGE = 88;  // 노드 A(말 걸기) 근접 반경(px)
const FADE_MS = 260;

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const VALID_DIR = new Set(['up', 'down', 'left', 'right']);

function keyToDir(key) {
  switch (key) {
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    default: return null;
  }
}

// 도시 타일 코드 → 통행 차단(데이터 파일과 동일 규칙 — 물·건물만 막힘).
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
function tileHash(tx, ty) {
  let n = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) >>> 0;
  n ^= n >>> 13; n = Math.imul(n, 0x5bd1e995) >>> 0; n ^= n >>> 15;
  return (n >>> 0) / 0xffffffff;
}

/**
 * 도시 씬 클래스를 빌드한다(Phaser 는 동적 import 라 팩토리로 주입).
 * city: cities/<id>.js 의 데이터 객체({ id, name, cols, rows, entrance, returnNode, zones, nodes, props, CITY_TILE, buildGrid }).
 * ctx: {
 *   userId, petRef, nickRef,
 *   bindScene(scene|null),           씬 → sceneRef.current 갱신(입력 잠금·버스 위임 대상)
 *   onEnter(),                       씬 진입 통지(React 오버레이 초기화 · activeScene 갱신)
 *   onReady?(),                      create 말미 통지 — 피어 스냅샷 재적용 + 전체 키 거리 1회 emit(P1-2)
 *   setNear(node|null),              근접 노드 → React(nearNode) — { id, name, desc, npc?, noStamp?, chapter? }
 *   setNearStation?(station|null),   🚃 근접 역 → React(nearStation) — { id, nameJa, yomi, line? }
 *   arrivedStation?({ nameJa, yomi }),  🚃 정기 교통 도착 확인 토스트("🚃 博多駅")
 *   worldReturn: { scene:'plaza', x, y },   기본 전국맵 복귀 스폰(도시 노드 앞)
 * }
 */
export function buildCityScene(Phaser, city, ctx) {
  const T = city.CITY_TILE;
  const COLS = city.cols;
  const ROWS = city.rows;
  const SCENE_KEY = `city:${city.id}`;
  const METERS_PER_TILE = cityMetersPerTile(city);
  const SCALE_TIER = cityScaleTier(METERS_PER_TILE).id;

  return class CityScene extends Phaser.Scene {
    constructor() {
      super(SCENE_KEY);
      this.metersPerTile = METERS_PER_TILE;
      this.scaleTier = SCALE_TIER;
    }

    // ── 도트 굽기 유틸 ──
    drawMap(g, rows, pal) {
      for (let y = 0; y < rows.length; y++) {
        const row = rows[y];
        for (let x = 0; x < row.length; x++) {
          const col = pal[row[x]];
          if (col == null) continue;
          g.fillStyle(col, 1); g.fillRect(x, y, 1, 1);
        }
      }
    }
    makeTex(key, rows, pal, w, h) {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ add: false });
      this.drawMap(g, rows, pal);
      g.generateTexture(key, w, h); g.destroy();
    }
    bakeTile(key, draw, w = TEX, h = TEX) {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ add: false });
      draw(g);
      g.generateTexture(key, w, h); g.destroy();
    }

    preload() {
      // 지형은 항상 주간 원색으로 굽고, 시간대는 update의 전역 조명 오버레이로 표현한다.
      // 한 씬에 오래 머물러도 새벽/낮/밤 경계가 즉시 바뀌어 서버 월드 시계와 어긋나지 않는다.
      this.mode = 'day';
      const C = (hex) => toneColor(hex, this.mode);

      // ── 지면 타일(도로·보도·횡단보도·광장·공원·다리·부두·출구·수면) ──
      // 도로 — 방향별 차선으로 보행면과 즉시 구분한다.
      const roadBase = (g) => {
        g.fillStyle(C(0x4a4d55), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0x3d4048), 1); for (const [x, y] of [[2, 3], [11, 5], [5, 12], [13, 10]]) g.fillRect(x, y, 1, 1);
      };
      this.bakeTile('ct_road_v', (g) => {
        roadBase(g);
        g.fillStyle(C(0xd9d2b0), 0.9); g.fillRect(7, 1, 2, 4); g.fillRect(7, 11, 2, 4);
        g.fillStyle(C(0x777a82), 1); g.fillRect(0, 0, 1, TEX); g.fillRect(TEX - 1, 0, 1, TEX);
      });
      this.bakeTile('ct_road_h', (g) => {
        roadBase(g);
        g.fillStyle(C(0xd9d2b0), 0.9); g.fillRect(1, 7, 4, 2); g.fillRect(11, 7, 4, 2);
        g.fillStyle(C(0x777a82), 1); g.fillRect(0, 0, TEX, 1); g.fillRect(0, TEX - 1, TEX, 1);
      });
      this.bakeTile('ct_road_x', (g) => { roadBase(g); });
      // 보도 — 밝은 웜 그레이 + 이음새 격자.
      this.bakeTile('ct_sidewalk', (g) => {
        g.fillStyle(C(0xcfc7b4), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0xbdb39c), 0.6); g.fillRect(0, 7, TEX, 1); g.fillRect(7, 0, 1, TEX);
        g.fillStyle(C(0xdcd5c4), 0.5); g.fillRect(1, 1, 5, 5); g.fillRect(9, 9, 5, 5);
      });
      // 횡단보도 — 도로 바탕 + 흰 지브라.
      this.bakeTile('ct_crosswalk_v', (g) => {
        g.fillStyle(C(0x4a4d55), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0xeae4d2), 0.92); for (const x of [1, 5, 9, 13]) g.fillRect(x, 0, 2, TEX);
      });
      this.bakeTile('ct_crosswalk_h', (g) => {
        g.fillStyle(C(0x4a4d55), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0xeae4d2), 0.92); for (const y of [1, 5, 9, 13]) g.fillRect(0, y, TEX, 2);
      });
      // 광장 — 웜 탠 포석.
      this.bakeTile('ct_plaza', (g) => {
        g.fillStyle(C(0xe0cf9e), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0xd0bd85), 0.6); g.fillRect(0, 0, TEX, 1); g.fillRect(0, 8, TEX, 1); g.fillRect(0, 0, 1, TEX); g.fillRect(8, 0, 1, TEX);
      });
      // 공원 — 잔디 + 미세 얼룩.
      this.bakeTile('ct_park', (g) => {
        const rng = makeRng(0x77);
        g.fillStyle(C(0x8cc152), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0x6fa63a), 1); for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) if (rng() < 0.14) g.fillRect(x, y, 1, 1);
        g.fillStyle(C(0xb2db6e), 1); g.fillRect(3, 4, 1, 2); g.fillRect(11, 9, 1, 2);
      });
      // 산지 — 짙은 수림 능선(차단·배경).
      this.bakeTile('ct_mountain', (g) => {
        const rng = makeRng(0x91);
        g.fillStyle(C(0x526b43), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0x3f5635), 1);
        for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) if (rng() < 0.16) g.fillRect(x, y, 1, 1);
        g.fillStyle(C(0x71845a), 0.8); g.fillRect(2, 11, 5, 1); g.fillRect(9, 6, 5, 1);
      });
      // 다리 — 목조 데크(나카강 위).
      this.bakeTile('ct_bridge', (g) => {
        g.fillStyle(C(0xb89058), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0x8a6538), 1); for (let y = 2; y < TEX; y += 4) g.fillRect(0, y, TEX, 1);
        g.fillStyle(C(0x6f4a28), 1); g.fillRect(0, 0, 1, TEX); g.fillRect(TEX - 1, 0, 1, TEX);
      });
      // 부두 데크 — 짙은 목판.
      this.bakeTile('ct_dock', (g) => {
        g.fillStyle(C(0x9a6a3a), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0x744e28), 1); for (let y = 3; y < TEX; y += 4) g.fillRect(0, y, TEX, 1);
        g.fillStyle(C(0x6a4622), 1); g.fillRect(0, 0, 1, TEX); g.fillRect(TEX - 1, 0, 1, TEX);
      });
      // 출구(선착장) — 부두 판 + 녹색 승선 표식.
      this.bakeTile('ct_exit', (g) => {
        g.fillStyle(C(0x9a6a3a), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0x744e28), 1); for (let y = 3; y < TEX; y += 4) g.fillRect(0, y, TEX, 1);
        g.fillStyle(C(0x5f9a46), 1); g.fillRect(5, 4, 6, 8);
        g.fillStyle(C(0xeef3e6), 1); g.fillRect(7, 3, 2, 3); g.fillRect(6, 6, 4, 1); // ↑ 표식
      });
      // 수면 3프레임(나카강·항만) — 청록 + 흐르는 물결.
      const water = (key, base, shift) => this.bakeTile(key, (g) => {
        g.fillStyle(C(base), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0xd6f0fb), 0.85);
        const y1 = 3 + shift, y2 = 10 + shift;
        g.fillRect(2, y1, 5, 1); g.fillRect(9, y1 + 1, 4, 1);
        g.fillRect(6, y2, 5, 1); g.fillRect(1, y2 + 1, 3, 1);
      });
      water('ct_water0', 0x3a86b0, 0);
      water('ct_water1', 0x3e93c4, 1);
      water('ct_water2', 0x347ba0, 2);
      // 강·운하(RIVER) — 바다보다 탁한 청록 강 톤(WATER 와 시각 구분).
      water('ct_river0', 0x3f7a6a, 0);
      water('ct_river1', 0x468a76, 1);
      water('ct_river2', 0x386e60, 2);

      // 해변(BEACH · 보행 가능) — 젖은 모래 + 잔물결 자국.
      this.bakeTile('ct_beach', (g) => {
        g.fillStyle(C(0xe8d6a6), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0xd8c48a), 1); for (const [x, y] of [[3, 4], [10, 6], [6, 11], [13, 12]]) g.fillRect(x, y, 2, 1);
        g.fillStyle(C(0xf2e6c2), 0.7); g.fillRect(0, 13, TEX, 1);
      });
      // 몽생미셸 대면적 갯벌 — 기존 BEACH 코드·모래 스킨은 유지하고 도시 선택 필드로만 분기한다.
      this.bakeTile('ct_beach_mudflat', (g) => {
        const rng = makeRng(0x4d534d);
        g.fillStyle(C(0xc7b89b), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0xb3a284), 1); for (const [x, y] of [[3, 4], [10, 6], [6, 11], [13, 12]]) g.fillRect(x, y, 2, 1);
        g.fillStyle(C(0xd6cbb2), 0.7); g.fillRect(0, 13, TEX, 1);
        g.fillStyle(C(0x8fa5a8), 0.8);
        const speckleCount = 2 + Number(rng() >= 0.5);
        for (let index = 0; index < speckleCount; index += 1) {
          g.fillRect(Math.floor(rng() * (TEX - 1)), 2 + Math.floor(rng() * (TEX - 4)), 2, 1);
        }
      });

      // 섬 실루엣(하카타만 노코노시마/시카노시마 · 오호리 연못 섬) — 초지 + 기슭(차단·배경).
      this.bakeTile('ct_island', (g) => {
        g.fillStyle(C(0x6fa63a), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0x4a8a2a), 1);
        for (const [x, y] of [[2, 3], [6, 2], [10, 4], [12, 9], [4, 11], [8, 12]]) g.fillRect(x, y, 2, 2);
        g.fillStyle(C(0x8cc152), 1); g.fillRect(3, 5, 3, 2); g.fillRect(9, 7, 3, 2);
        g.fillStyle(C(0xd8c48a), 1); g.fillRect(0, TEX - 2, TEX, 2); // 모래 기슭
      });

      // 건물은 창문 반복 대신 하나의 어두운 지붕 덩어리로 묶고 외곽선만 강조한다.
      for (let mask = 0; mask < 16; mask++) {
        this.bakeTile(`ct_bldg_${mask}`, (g) => {
          g.fillStyle(C(0x716d68), 1); g.fillRect(0, 0, TEX, TEX);
          g.fillStyle(C(0x827d76), 1); g.fillRect(2, 2, TEX - 4, TEX - 4);
          g.fillStyle(C(0x5a5652), 1);
          if (mask & 1) g.fillRect(0, 0, TEX, 2);
          if (mask & 2) g.fillRect(TEX - 2, 0, 2, TEX);
          if (mask & 4) g.fillRect(0, TEX - 2, TEX, 2);
          if (mask & 8) g.fillRect(0, 0, 2, TEX);
          if ((mask & 15) === 0 && tileHash(mask, 7) > 0.5) {
            g.fillStyle(C(0x969088), 1); g.fillRect(6, 6, 4, 4);
          }
        });
      }

      this.bakeTile('ct_rail_area', (g) => {
        // OSM 철도 마스크는 역 구내의 다수 선로까지 포함한다. 선로·침목을 개별 타일에
        // 반복하지 않고 투명한 철도 부지 색으로만 표시해 정확한 위치와 보행 판독을 함께 지킨다.
        g.fillStyle(C(0xcbb46c), 0.18); g.fillRect(0, 0, TEX, TEX);
      });

      this.bakeTile('ct_vehicle_train', (g) => {
        g.fillStyle(C(0xf0ead4), 1); g.fillRect(2, 4, 12, 8);
        g.fillStyle(C(0x4f96c8), 1); g.fillRect(3, 6, 10, 3);
        g.fillStyle(C(0x2c3038), 1); g.fillRect(4, 11, 3, 2); g.fillRect(9, 11, 3, 2);
      });
      this.bakeTile('ct_vehicle_bus', (g) => {
        g.fillStyle(C(0x4f8f62), 1); g.fillRect(2, 3, 12, 10);
        g.fillStyle(C(0xe7eadb), 1); g.fillRect(4, 5, 8, 3);
      });
      this.bakeTile('ct_vehicle_ferry', (g) => {
        g.fillStyle(C(0xf4f0d0), 1); g.fillRect(2, 8, 12, 5);
        g.fillStyle(C(0xd95f4f), 1); g.fillRect(6, 3, 5, 5);
        g.fillStyle(C(0x345a78), 1); g.fillRect(3, 13, 10, 2);
      });
      this.bakeTile('ct_player_halo', (g) => {
        g.fillStyle(C(0xffe36a), 0.9); g.fillCircle(8, 8, 7);
        g.fillStyle(C(0x4d4222), 0.85); g.fillCircle(8, 8, 4);
      });

      // (지형은 청크 RenderTexture 로 굽는다 — tilemap/아틀라스 폐기. 개별 ct_* 텍스처를 청크에 draw.)

      // 가로수(2타일 높이 · 16×32).
      this.bakeTile('ct_tree', (g) => {
        g.fillStyle(C(0x2f7a2a), 1); g.fillRect(2, 3, 12, 12);
        g.fillStyle(C(0x4aa63a), 1); g.fillRect(3, 2, 10, 11);
        g.fillStyle(C(0x74c84e), 1); g.fillRect(4, 2, 4, 4); g.fillRect(9, 5, 3, 3);
        g.fillStyle(C(0x6f4420), 1); g.fillRect(6, 15, 4, 15);
        g.fillStyle(C(0x9a5f2a), 1); g.fillRect(7, 15, 2, 15);
      }, TEX, TEX * 2);

      // ── 프리팹 파사드(노렌·간판·돈키) — 프론티지 위 소품 ──
      // 노렌(붉은 천 + 초롱) 16×16.
      this.bakeTile('ct_prop_noren', (g) => {
        g.fillStyle(C(0xc14b38), 1); g.fillRect(2, 5, 12, 6);
        g.fillStyle(C(0x8a2f24), 1); for (const x of [4, 7, 10]) g.fillRect(x, 5, 1, 6);
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(2, 4, 12, 1);
        g.fillStyle(C(0xf2a54a), 1); g.fillRect(3, 11, 3, 4); g.fillStyle(C(0x8a2f24), 1); g.fillRect(3, 11, 3, 1); // 초롱
      });
      // 간판(보드 + 지주) 16×16.
      this.bakeTile('ct_prop_sign', (g) => {
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(2, 2, 12, 8);
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(3, 3, 10, 6);
        g.fillStyle(C(0xc14b38), 1); g.fillRect(4, 5, 8, 1); g.fillRect(4, 7, 6, 1);
        g.fillStyle(C(0x6f4420), 1); g.fillRect(7, 10, 2, 6);
      });
      // 돈키호테 파사드/간판(노란 대형 간판) — 24×24, 노드 마커 겸용(발밑 정렬).
      this.bakeTile('ct_prop_donki', (g) => {
        g.fillStyle(C(0xb9b2a4), 1); g.fillRect(2, 6, 20, 18);        // 건물 몸통
        g.fillStyle(C(0x8f887a), 1); g.fillRect(2, 22, 20, 2);
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(1, 1, 22, 6);         // 간판 테
        g.fillStyle(C(0xf2c400), 1); g.fillRect(2, 2, 20, 4);        // 노란 간판
        g.fillStyle(C(0xc14b38), 1); for (const x of [4, 9, 14, 19]) g.fillRect(x, 3, 2, 2); // 붉은 글자 힌트
        g.fillStyle(C(0x8fb8d0), 1); for (const x of [4, 10, 16]) g.fillRect(x, 10, 4, 4); g.fillRect(4, 16, 16, 4); // 유리 파사드/입구
      }, NPC_W, NPC_H);

      // 신사 토리이(櫛田神社) 16×16 — 붉은 문.
      this.bakeTile('ct_prop_torii', (g) => {
        g.fillStyle(C(0xc1352b), 1);
        g.fillRect(2, 3, 12, 2);                                   // 카사기(상단 보)
        g.fillRect(3, 6, 10, 1);                                   // 시마기
        g.fillRect(4, 3, 2, 12); g.fillRect(10, 3, 2, 12);         // 두 기둥
        g.fillStyle(C(0x8a221b), 1); g.fillRect(2, 3, 12, 1);
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(6, 8, 4, 1);       // 편액
      });
      // 운하 분수(キャナルシティ) 16×16 — 수반 + 물줄기.
      this.bakeTile('ct_prop_fountain', (g) => {
        g.fillStyle(C(0x9aa7b0), 1); g.fillRect(3, 10, 10, 5);     // 수반
        g.fillStyle(C(0x7d8890), 1); g.fillRect(3, 14, 10, 1);
        g.fillStyle(C(0x3e93c4), 1); g.fillRect(5, 11, 6, 3);      // 고인 물
        g.fillStyle(C(0xd6f0fb), 1); g.fillRect(7, 2, 2, 8);       // 물줄기
        g.fillRect(5, 5, 1, 5); g.fillRect(10, 5, 1, 5);
      });
      // 백화점(天神 岩田屋·PARCO) 24×24 — 간판 띠 얹은 상업동.
      this.bakeTile('ct_prop_depart', (g) => {
        g.fillStyle(C(0xcbb48f), 1); g.fillRect(2, 4, 20, 20);
        g.fillStyle(C(0x9c8560), 1); g.fillRect(2, 22, 20, 2);
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(2, 4, 20, 4);      // 간판 띠
        g.fillStyle(C(0xe0b64a), 1); g.fillRect(3, 5, 18, 2);
        g.fillStyle(C(0x8fb8d0), 1); for (const wy of [10, 15, 20]) for (const wx of [4, 9, 14, 18]) g.fillRect(wx, wy, 3, 3);
      }, NPC_W, NPC_H);
      // 역사(JR博多シティ) 24×24 — 지붕 + 시계 + 입구.
      this.bakeTile('ct_prop_station', (g) => {
        g.fillStyle(C(0xb0a89a), 1); g.fillRect(2, 8, 20, 16);
        g.fillStyle(C(0x8a8274), 1); g.fillRect(2, 22, 20, 2);
        g.fillStyle(C(0x6f4a28), 1); g.fillRect(1, 5, 22, 4);      // 지붕
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(10, 9, 4, 4);      // 시계
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(11, 10, 1, 2);
        g.fillStyle(C(0x8fb8d0), 1); for (const wx of [4, 9, 15, 19]) g.fillRect(wx, 15, 3, 6); // 창/입구
      }, NPC_W, NPC_H);
      // 성터 석벽(福岡城跡/舞鶴公園) 24×24 — 돌쌓기 + 벚꽃.
      this.bakeTile('ct_prop_castle', (g) => {
        g.fillStyle(C(0x9a9384), 1); g.fillRect(2, 10, 20, 14);    // 석벽
        g.fillStyle(C(0x7d7669), 1); for (let y = 13; y < 24; y += 4) g.fillRect(2, y, 20, 1);
        for (let x = 7; x < 22; x += 6) g.fillRect(x, 10, 1, 14);
        g.fillStyle(C(0x6b6456), 1); g.fillRect(2, 10, 20, 2);     // 상단 그림자
        g.fillStyle(C(0x4aa63a), 1); g.fillRect(3, 7, 5, 3); g.fillRect(16, 7, 5, 3); // 나무
        g.fillStyle(C(0xf3c6d6), 1); g.fillRect(4, 6, 2, 2); g.fillRect(18, 6, 2, 2); // 벚꽃
      }, NPC_W, NPC_H);

      // ── 🛳️ 렌더크래프트 프롭(오너 지시: 페리선·캐널 내부·하카타역 디테일) ──
      // 국제선 페리(부산행 대형 카페리) — 하얀 선체·다층 갑판·붉은 굴뚝. 32×20, 물 위 배치.
      this.bakeTile('ct_prop_ferry_intl', (g) => {
        g.fillStyle(C(0x2a3340), 1); g.fillRect(2, 14, 28, 4);        // 흘수(선체 하부)
        g.fillStyle(C(0xf2efe6), 1); g.fillRect(3, 9, 26, 6);         // 선체(흰)
        g.fillStyle(C(0xc9c3b4), 1); g.fillRect(3, 13, 26, 1);        // 워터라인 음영
        g.fillStyle(C(0x3a6ea5), 1); for (let x = 5; x < 28; x += 3) g.fillRect(x, 11, 2, 2); // 현측 창렬
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(7, 4, 18, 5);         // 상부 선교/객실
        g.fillStyle(C(0xd9d2c0), 1); g.fillRect(7, 8, 18, 1);
        g.fillStyle(C(0x8fb8d0), 1); for (let x = 9; x < 24; x += 3) g.fillRect(x, 5, 2, 2); // 선실 창
        g.fillStyle(C(0xc14b38), 1); g.fillRect(19, 1, 4, 4);         // 붉은 굴뚝
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(19, 1, 4, 1);
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(3, 6, 3, 3);         // 뱃머리 램프 힌트
      }, 32, 20);
      // 국내선 페리(志賀島/능고도行 소형선) — 파란 띠 흰 선체. 24×14, 물 위.
      this.bakeTile('ct_prop_ferry_dom', (g) => {
        g.fillStyle(C(0x2a3340), 1); g.fillRect(2, 10, 20, 3);        // 흘수
        g.fillStyle(C(0xf2efe6), 1); g.fillRect(3, 6, 18, 4);         // 선체
        g.fillStyle(C(0x3a6ea5), 1); g.fillRect(3, 8, 18, 1);         // 파란 띠
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(7, 2, 10, 4);         // 조타실
        g.fillStyle(C(0x8fb8d0), 1); for (const x of [8, 11, 14]) g.fillRect(x, 3, 2, 2); // 창
        g.fillStyle(C(0xc14b38), 1); g.fillRect(17, 1, 2, 3);         // 마스트/등
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(3, 9, 18, 1);
      }, 24, 14);
      // 시내버스(캐널시티 버스터미널·니시테츠풍) — 붉은 차체. 24×12.
      this.bakeTile('ct_prop_bus', (g) => {
        g.fillStyle(C(0xc14b38), 1); g.fillRect(2, 2, 20, 8);         // 차체
        g.fillStyle(C(0x8a2f24), 1); g.fillRect(2, 9, 20, 1);
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(3, 2, 19, 1);         // 지붕 라인
        g.fillStyle(C(0x8fb8d0), 1); for (let x = 4; x < 20; x += 3) g.fillRect(x, 4, 2, 3); // 창
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(5, 10, 3, 2); g.fillRect(15, 10, 3, 2); // 바퀴
        g.fillStyle(C(0xf2c400), 1); g.fillRect(20, 4, 2, 2);         // 전조등/행선막
      }, 24, 12);
      // 상점 매대(캐널시티 내부 몰 가게) — 붉은 차양 + 진열창. 16×16.
      this.bakeTile('ct_prop_stall', (g) => {
        g.fillStyle(C(0xcbb48f), 1); g.fillRect(2, 6, 12, 10);        // 점포 몸통
        g.fillStyle(C(0x9c8560), 1); g.fillRect(2, 15, 12, 1);
        g.fillStyle(C(0xc14b38), 1); g.fillRect(1, 3, 14, 3);         // 붉은 차양
        g.fillStyle(C(0xf6edcf), 1); for (let x = 2; x < 15; x += 2) g.fillRect(x, 3, 1, 3); // 차양 줄무늬
        g.fillStyle(C(0x8fb8d0), 1); g.fillRect(3, 8, 4, 5); g.fillRect(9, 8, 4, 5); // 진열창
      });
      // 하카타역 대형 역사(JR博多シティ) — 유리 파사드·시계·역명 띠. 32×28, 허브.
      this.bakeTile('ct_prop_hakata_sta', (g) => {
        g.fillStyle(C(0xb0a89a), 1); g.fillRect(2, 8, 28, 20);        // 역사 몸통
        g.fillStyle(C(0x8a8274), 1); g.fillRect(2, 26, 28, 2);        // 하단 그림자
        g.fillStyle(C(0x6f4a28), 1); g.fillRect(1, 4, 30, 5);         // 지붕 처마
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(2, 9, 28, 3);         // 역명 띠
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(4, 10, 24, 1);        // 역명 띠 하이라이트
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(14, 13, 4, 4);        // 대형 시계
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(15, 14, 1, 2); g.fillRect(16, 15, 1, 1);
        g.fillStyle(C(0x8fb8d0), 1); for (let x = 4; x < 28; x += 4) g.fillRect(x, 18, 3, 7); // 유리 파사드
        g.fillStyle(C(0x3a2a1a), 1); g.fillRect(13, 21, 6, 5);        // 중앙 대형 입구
      }, 32, 28);
      // 승강장(하카타역 플랫폼) — 지붕·선로·황색 점자블록. 24×16.
      this.bakeTile('ct_prop_platform', (g) => {
        g.fillStyle(C(0x9aa7b0), 1); g.fillRect(2, 8, 20, 6);         // 플랫폼 상판
        g.fillStyle(C(0xf2c400), 1); g.fillRect(2, 8, 20, 1);         // 황색 점자블록
        g.fillStyle(C(0x6f4a28), 1); g.fillRect(3, 1, 18, 3);         // 지붕
        g.fillStyle(C(0x3a2a1a), 1); for (const x of [5, 11, 17]) g.fillRect(x, 4, 1, 4); // 지붕 기둥
        g.fillStyle(C(0x4a5560), 1); g.fillRect(2, 14, 20, 2);        // 선로 자갈
        g.fillStyle(C(0xc9c3b4), 1); g.fillRect(3, 15, 18, 1);        // 레일
      }, 24, 16);
      // 🏮 세로 네온 간판(도톤보리·신세카이 — 무브랜드). 16×24.
      this.bakeTile('ct_prop_neon', (g) => {
        g.fillStyle(C(0x2a2a3a), 1); g.fillRect(5, 1, 7, 20);          // 간판 몸통(세로)
        g.fillStyle(C(0xff5a8a), 1); g.fillRect(6, 2, 5, 4);           // 네온 블록(핑크)
        g.fillStyle(C(0x3ec4e0), 1); g.fillRect(6, 7, 5, 4);           // 청록
        g.fillStyle(C(0xf2c400), 1); g.fillRect(6, 12, 5, 4);          // 노랑
        g.fillStyle(C(0x8dbb45), 1); g.fillRect(6, 17, 5, 3);          // 연두
        g.fillStyle(C(0x141414), 1); g.fillRect(7, 21, 3, 3);          // 지주
      }, 16, 24);
      // 🌟 금각(금색 파빌리온 — 鹿苑寺 사리전). 24×24, 노드 파사드.
      this.bakeTile('ct_prop_kinkaku', (g) => {
        g.fillStyle(C(0x6f4a28), 1); g.fillRect(3, 20, 18, 3);         // 기단(수변)
        g.fillStyle(C(0x3e93c4), 1); g.fillRect(1, 22, 22, 2);         // 경호지(연못)
        g.fillStyle(C(0xd9a520), 1); g.fillRect(5, 12, 14, 8);         // 1·2층 금색 몸체
        g.fillStyle(C(0xf2c94c), 1); g.fillRect(6, 13, 12, 2);         // 금 하이라이트
        g.fillStyle(C(0x8a6a1a), 1); g.fillRect(4, 11, 16, 1);         // 처마
        g.fillStyle(C(0xd9a520), 1); g.fillRect(7, 6, 10, 5);          // 3층
        g.fillStyle(C(0x8a6a1a), 1); g.fillRect(6, 5, 12, 1);          // 상층 처마
        g.fillStyle(C(0xf2c94c), 1); g.fillRect(11, 2, 2, 3);          // 봉황 장식
      }, NPC_W, NPC_H);
      // 🎋 대나무 숲(아라시야마). 16×32, 세로 줄기 3본.
      this.bakeTile('ct_prop_bamboo', (g) => {
        for (const [x, h] of [[3, 28], [7, 31], [12, 26]]) {
          g.fillStyle(C(0x4f8a2c), 1); g.fillRect(x, 31 - h, 3, h);    // 줄기
          g.fillStyle(C(0x6cae3e), 1); g.fillRect(x, 31 - h, 1, h);    // 명부
          g.fillStyle(C(0x2a3a1a), 1);
          for (let y = 31 - h + 4; y < 30; y += 6) g.fillRect(x, y, 3, 1); // 마디
        }
        g.fillStyle(C(0x6cae3e), 1); g.fillRect(1, 2, 5, 2); g.fillRect(10, 4, 5, 2); // 잎 힌트
      }, 16, 32);
      // 🏮 가미나리몬(浅草寺 대초롱 문). 24×24, 노드 파사드.
      this.bakeTile('ct_prop_kaminarimon', (g) => {
        g.fillStyle(C(0x8a2f24), 1); g.fillRect(2, 3, 3, 20); g.fillRect(19, 3, 3, 20); // 주홍 기둥
        g.fillStyle(C(0x5a3a1a), 1); g.fillRect(0, 1, 24, 4);          // 지붕 보
        g.fillStyle(C(0x3a2a14), 1); g.fillRect(1, 4, 22, 1);
        g.fillStyle(C(0xc1352b), 1); g.fillRect(7, 6, 10, 13);         // 대초롱
        g.fillStyle(C(0xe2543e), 1); g.fillRect(8, 7, 3, 11);          // 초롱 명부
        g.fillStyle(C(0x141414), 1); g.fillRect(7, 11, 10, 3);         // 초롱 검은 띠(문자 힌트·무문자)
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(9, 19, 6, 2);          // 초롱 하단 골조
      }, NPC_W, NPC_H);
      // 🗼 스카이트리(흰 격자탑 — 붉은 도쿄타워와 구분). 24×32, 노드 파사드.
      this.bakeTile('ct_prop_skytree', (g) => {
        g.fillStyle(C(0xe8ecef), 1);
        g.fillRect(11, 0, 2, 6);                                       // 첨탑
        g.fillRect(10, 6, 4, 6); g.fillRect(9, 13, 6, 6); g.fillRect(8, 20, 8, 6); g.fillRect(7, 27, 10, 4);
        g.fillStyle(C(0x9aa7b0), 1); g.fillRect(11, 7, 1, 24);         // 격자 음영선
        g.fillStyle(C(0x3ec4e0), 1); g.fillRect(9, 12, 6, 1); g.fillRect(8, 19, 8, 1); // 전망데크 2단(청색광)
        g.fillStyle(C(0x6b7680), 1); g.fillRect(7, 30, 10, 1);
      }, 24, 32);
      // 🗼 츠텐카쿠(通天閣) — 은회색 몸체 + 상부 원반 전망대(도쿄타워와 별개 실루엣·무브랜드). 24×32.
      this.bakeTile('ct_prop_tsutenkaku', (g) => {
        g.fillStyle(C(0xc9ced4), 1); g.fillRect(11, 0, 2, 4);          // 첨탑 안테나
        g.fillStyle(C(0xaeb6bd), 1); g.fillRect(7, 4, 10, 5);          // 원반 전망대(상부 넓음)
        g.fillStyle(C(0xe8ecef), 1); g.fillRect(8, 5, 8, 1);           // 전망대 하이라이트
        g.fillStyle(C(0x2a2a3a), 1); g.fillRect(8, 7, 8, 1);           // 전망대 창 띠(무문자)
        g.fillStyle(C(0xc9ced4), 1); g.fillRect(10, 9, 4, 12);         // 세장한 몸통(은회색)
        g.fillStyle(C(0x8a929a), 1); g.fillRect(11, 9, 1, 12);         // 몸통 음영
        g.fillStyle(C(0xc9ced4), 1);                                    // 하부 4각 벌어진 다리
        g.fillRect(8, 21, 2, 9); g.fillRect(14, 21, 2, 9);
        g.fillRect(6, 27, 2, 4); g.fillRect(16, 27, 2, 4);
        g.fillStyle(C(0x8a929a), 1); g.fillRect(9, 24, 6, 1);          // 다리 가로 보강재
      }, 24, 32);
      // ✈️ 여객기(하네다 에이프런 주기) — 흰 동체·수직 꼬리날개·엔진. 32×20, 무브랜드.
      this.bakeTile('ct_prop_airplane', (g) => {
        g.fillStyle(C(0xd9d2c0), 1); g.fillRect(4, 16, 24, 2);        // 지면 그림자
        g.fillStyle(C(0xf2efe6), 1); g.fillRect(4, 9, 24, 5);         // 동체
        g.fillStyle(C(0xc9c3b4), 1); g.fillRect(4, 12, 24, 1);        // 동체 하부 음영
        g.fillStyle(C(0xf2efe6), 1); g.fillRect(24, 3, 3, 7);         // 수직 꼬리
        g.fillStyle(C(0x3a6ea5), 1); g.fillRect(24, 3, 3, 3);         // 꼬리 파란 띠(무브랜드)
        g.fillStyle(C(0x2a3340), 1); g.fillRect(5, 10, 3, 2);         // 조종석 창
        g.fillStyle(C(0x8fb8d0), 1); for (let x = 10; x < 23; x += 3) g.fillRect(x, 10, 1, 1); // 객실 창렬
        g.fillStyle(C(0xb9b2a4), 1); g.fillRect(12, 13, 8, 3);        // 주익(아래로)
        g.fillStyle(C(0x4a5560), 1); g.fillRect(14, 15, 3, 3); g.fillRect(9, 14, 2, 3); // 엔진·기수 랜딩기어
      }, 32, 20);
      // 🖥️ 대형 전광판(시부야 스크램블) — 빌딩 코너의 빛나는 스크린. 24×24, 무브랜드.
      this.bakeTile('ct_prop_bigscreen', (g) => {
        g.fillStyle(C(0x8f887a), 1); g.fillRect(3, 2, 18, 22);        // 빌딩 몸통
        g.fillStyle(C(0x6b6456), 1); g.fillRect(3, 22, 18, 2);
        g.fillStyle(C(0x141414), 1); g.fillRect(4, 3, 16, 12);        // 스크린 베젤
        g.fillStyle(C(0x3ec4e0), 1); g.fillRect(5, 4, 14, 10);        // 스크린 발광(청록)
        g.fillStyle(C(0xf2c400), 1); g.fillRect(6, 6, 5, 2); g.fillRect(13, 9, 5, 2); // 화면 그래픽 힌트
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(6, 11, 9, 1);
        g.fillStyle(C(0x8fb8d0), 1); for (const y of [17, 20]) for (const x of [5, 10, 15]) g.fillRect(x, y, 3, 2); // 하부 창
      });
      // 🗼 도쿄타워 — 붉은 격자 전파탑(위로 좁아지는 실루엣 + 백색 띠). 24×32, 파사드 마커.
      this.bakeTile('ct_prop_tokyotower', (g) => {
        g.fillStyle(C(0xc1352b), 1);
        g.fillRect(11, 1, 2, 5);                                      // 첨탑 안테나
        g.fillRect(10, 6, 4, 5);                                      // 상부 몸통
        g.fillRect(9, 12, 6, 5);                                      // 중상부
        g.fillRect(8, 18, 8, 5);                                      // 중하부
        g.fillRect(6, 24, 12, 6);                                     // 하부(다리 벌어짐)
        g.fillStyle(C(0xf6edcf), 1); g.fillRect(9, 11, 6, 1); g.fillRect(8, 17, 8, 1); // 백색 띠
        g.fillStyle(C(0xf2efe6), 1); g.fillRect(9, 13, 6, 2);         // 대전망대(흰 박스)
        g.fillStyle(C(0x8a221b), 1);                                  // 격자 음영
        g.fillRect(7, 26, 1, 4); g.fillRect(16, 26, 1, 4); g.fillRect(11, 19, 2, 3);
        g.fillStyle(C(0x2a1e14), 1); g.fillRect(5, 30, 5, 2); g.fillRect(14, 30, 5, 2); // 다리 발치
      }, 24, 32);

      // ── 캐릭터(플레이어 ct_pc · 원격 피어 ct_pr) + 펫 + NPC 마커 ──
      this.bakeCharSet('ct_pc', tonePalette(avatarPalette(ctx.avatarRef?.current), this.mode));
      this.bakeCharSet('ct_pr', tonePalette(CHAR_PAL_REMOTE, this.mode));
      for (const k of PET_KEYS) {
        const pal = tonePalette(PET_PAL[k], this.mode);
        this.makeTex(`ct_pet_${k}_0`, petFrameRows(k, 0), pal, PET_W, PET_H);
        this.makeTex(`ct_pet_${k}_1`, petFrameRows(k, 1), pal, PET_W, PET_H);
      }
      // NPC 마커(t_npc_<key>)는 전역 공유 — 광장이 이미 구웠어도 makeTex 가 exists 가드로 무해.
      for (const key of NPC_KEYS) this.makeTex(`t_npc_${key}`, npcMarkerRows(key), tonePalette(NPC_PAL[key], this.mode), NPC_W, NPC_H);

      // 하트(펫 기분/완료 연출).
      this.bakeTile('ct_heart', (g) => {
        g.fillStyle(C(0xe0556a), 1);
        g.fillRect(1, 1, 2, 2); g.fillRect(5, 1, 2, 2);
        g.fillRect(0, 2, 8, 2); g.fillRect(1, 4, 6, 1); g.fillRect(2, 5, 4, 1); g.fillRect(3, 6, 2, 1);
        g.fillStyle(C(0xf59caa), 1); g.fillRect(1, 2, 1, 1);
      }, 8, 7);
    }

    bakeCharSet(prefix, pal) {
      for (const dir of CHAR_DIRS)
        for (const pose of CHAR_POSES)
          this.makeTex(`${prefix}_${dir}_${pose}`, charFrameRows(dir, pose), pal, 16, 16);
    }

    charTex(prefix, facing, moving, time, animMs = CHAR_ANIM_MS) {
      const base = (facing === 'left' || facing === 'right') ? 'side' : facing;
      const pose = moving ? ['l', 'n', 'r', 'n'][Math.floor(time / animMs) % 4] : 'n';
      return `${prefix}_${base}_${pose}`;
    }
    setCharFrame(sprite, prefix, facing, moving, time, animMs = CHAR_ANIM_MS) {
      sprite.setTexture(this.charTex(prefix, facing, moving, time, animMs));
      sprite.setFlipX(facing === 'right');
    }

    labelStyle() {
      return {
        fontFamily: 'monospace', fontSize: '9px', color: GBC.ink,
        backgroundColor: GBC.cream, padding: { x: 4, y: 2 }, resolution: 1,
      };
    }

    tileCode(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return TERRAIN.WATER; // 범위 밖 = 물(차단)
      return this.grid[ty * COLS + tx];
    }
    // 충돌은 공용 표준 규칙(isCityBlocked: WATER·RIVER·BUILDING·ISLAND) — 렌더·데이터와 단일 진실원.
    blocked(tx, ty) { return isCityBlocked(this.tileCode(tx, ty)); }
    isWaterTile(tx, ty) { return isCityWater(this.tileCode(tx, ty)); }

    roadDirection(tx, ty) {
      const roadLike = (x, y) => {
        const code = this.tileCode(x, y);
        return code === TERRAIN.ROAD || code === TERRAIN.CROSSWALK || code === TERRAIN.BRIDGE;
      };
      const horizontal = Number(roadLike(tx - 1, ty)) + Number(roadLike(tx + 1, ty));
      const vertical = Number(roadLike(tx, ty - 1)) + Number(roadLike(tx, ty + 1));
      if (horizontal > vertical) return 'h';
      if (vertical > horizontal) return 'v';
      return 'x';
    }

    buildingEdgeMask(tx, ty) {
      const open = (x, y) => this.tileCode(x, y) !== TERRAIN.BUILDING;
      return Number(open(tx, ty - 1))
        | (Number(open(tx + 1, ty)) << 1)
        | (Number(open(tx, ty + 1)) << 2)
        | (Number(open(tx - 1, ty)) << 3);
    }

    railwayAt(tx, ty) {
      if (!city.railways?.mask || tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
      return city.railways.mask[ty * COLS + tx] !== 0;
    }

    // 지형 코드 → 굽기용 개별 텍스처 키. 청크 베이킹·물 오버레이가 공용으로 쓴다.
    //   물/강은 정적 프레임0을 청크에 굽고(항상 물처럼 보임), 애니는 별도 오버레이가 얹는다.
    terrainTexKey(tx, ty) {
      const c = this.tileCode(tx, ty);
      switch (c) {
        case TERRAIN.ROAD: return `ct_road_${this.roadDirection(tx, ty)}`;
        case TERRAIN.SIDEWALK: return 'ct_sidewalk';
        case TERRAIN.CROSSWALK: return `ct_crosswalk_${this.roadDirection(tx, ty) === 'h' ? 'h' : 'v'}`;
        case TERRAIN.PLAZA: return 'ct_plaza';
        case TERRAIN.PARK: return 'ct_park';
        case TERRAIN.BEACH: return cityBeachTextureKey(city);
        case TERRAIN.BRIDGE: return 'ct_bridge';
        case TERRAIN.DOCK: return 'ct_dock';
        case TERRAIN.EXIT: return 'ct_exit';
        case TERRAIN.WATER: return 'ct_water0';
        case TERRAIN.RIVER: return 'ct_river0';
        case TERRAIN.BUILDING: return `ct_bldg_${this.buildingEdgeMask(tx, ty)}`;
        case TERRAIN.ISLAND: return 'ct_island';
        case TERRAIN.MOUNTAIN: return 'ct_mountain';
        default: return 'ct_sidewalk';
      }
    }

    petTexKey(frame) {
      const key = PET_KEYS.includes(ctx.petRef?.current?.key) ? ctx.petRef.current.key : 'dog';
      return `ct_pet_${key}_${frame}`;
    }
    petLevelScale() {
      const lv = ctx.petRef?.current?.level || 1;
      return Math.min(1 + (lv - 1) * 0.06, 1.6);
    }

    create(data) {
      ctx.bindScene(this);
      ctx.onEnter?.();
      this.inputLocked = true;    // 페이드인 동안 잠금
      this.runHeld = false;
      this.petJumpVal = 0;
      this.exiting = false;
      this.traveling = false;   // 🚃 정기 교통 승차 중 플래그 — 재진입 가드
      this.transitTrip = null;
      this.transitState = 'none';
      this.lastVehicleUpdate = -Infinity;
      this.worldReturn = data?.worldReturn || ctx.worldReturn;

      this.grid = city.buildGrid();

      this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
      this.cameras.main.setBackgroundColor(toneColor(0x2f3540, this.mode));
      this.cameras.main.setZoom(ZOOM);
      this.cameras.main.setRoundPixels(true);

      // ── 지형 렌더 — 청크 RenderTexture 베이킹(docs §6.3) ──
      //   grid 를 CHUNK_TILES 정사각 청크로 나눠 각 청크를 오프스크린 RT 1장에 한 번 굽고
      //   (셀당 Tile 객체 0개 → 600²=36만 객체 폭발 회피), 카메라에 겹치는 청크만 표시한다.
      //   상주 텍스처는 LRU 로 화면+여유(chunkCapacity)만 유지 → 맵이 커져도 메모리 상한 일정.
      const { chunkCols, chunkRows } = chunkDims(COLS, ROWS);
      this.chunkCols = chunkCols; this.chunkRows = chunkRows;
      this.chunks = new Map();               // key → { rt, cx, cy }
      this.chunkLRU = new ChunkLRU();
      this.chunkCap = chunkCapacity(this.scale.width, this.scale.height, { tile: TILE });
      // RT 에 타일을 찍는 재사용 스탬프(디스플레이 리스트 밖). 소스 16px → 월드 32px 배율.
      this.chunkStamp = this.make.image({ add: false, key: 'ct_sidewalk' }).setOrigin(0, 0).setScale(TSCALE);
      this.lastCamCX = null; this.lastCamCY = null;

      // 수면 물결 — 지형 청크엔 정적 프레임0을 굽고, 애니는 **뷰포트 안 물 타일에만** 얹는
      //   경량 오버레이 풀(뷰포트 크기로 상한 · 재사용)로 처리한다. 청크 재bake 없이 물이 흐른다.
      this.waterFrame = 0;
      this.waterPool = [];                   // 재사용 Image 풀(뷰포트 타일 수로 상한)
      this.time.addEvent({ delay: 520, loop: true, callback: () => {
        this.waterFrame = (this.waterFrame + 1) % 3;
        this.refreshWaterOverlay();
      } });

      this.refreshChunks(true);              // 초기 가시 청크 bake(+가시 청크 트리 생성)
      this.refreshWaterOverlay();            // 초기 물 오버레이
      // 원본 철도 마스크가 없는 도시(후쿠오카)는 실제 역 좌표를 잇는 노선 가이드로 보완한다.
      if (!city.railways?.mask && city.transit?.length) {
        const stops = new Map([...(city.stations || []), ...(city.transitPoints || [])].map((stop) => [stop.id, stop]));
        this.transitGuide = this.add.graphics().setDepth(-7).setAlpha(0.78);
        for (const line of city.transit) {
          if (line.mode === 'ferry') continue;
          const points = line.stopIds.map((id) => stops.get(id)?.tile).filter(Boolean)
            .map(([x, y]) => new Phaser.Math.Vector2(x * TILE + TILE / 2, y * TILE + TILE / 2));
          if (points.length < 2) continue;
          this.transitGuide.lineStyle(3, line.color || 0xe58d2f, 0.9);
          this.transitGuide.strokePoints(points, false, false);
        }
      }
      // (가로수는 청크 생명주기에 묶어 **가시 청크 범위만** 생성/회수한다 — buildChunkTrees.
      //  create 전역 트리 루프를 제거해 트리 수가 맵 면적이 아니라 화면+pad 에 비례하게 함 — Codex P1.)

      // ── 프리팹 파사드(노렌·간판) — 프론티지 소품(비상호작용, city.props 는 명시 목록이라 개수 유한) ──
      for (const p of (city.props || [])) {
        const [px, py] = p.tile;
        this.add.image(px * TILE + TILE / 2, (py + 1) * TILE, `ct_prop_${p.kind}`)
          .setOrigin(0.5, 1).setScale(TSCALE).setDepth((py + 1) * TILE);
      }

      // ── 구역(동네) 라벨 — 은은한 도트 표지(오리엔테이션) ──
      this.zoneLabels = (city.zones || []).map((z) => {
        const [lx, ly] = z.labelTile;
        const label = this.add.text(lx * TILE + TILE / 2, ly * TILE + TILE / 2, z.label, {
          fontFamily: 'monospace', fontSize: '10px', color: GBC.cream,
          backgroundColor: 'rgba(20,22,26,0.55)', padding: { x: 4, y: 2 }, resolution: 1,
        }).setOrigin(0.5, 0.5).setDepth(9000).setAlpha(0.72);
        return { label, wx: lx * TILE + TILE / 2, wy: ly * TILE + TILE / 2 };
      });

      // ── 가게/NPC 노드 마커 — 발밑(하단 중앙) 정렬. 근접 A 로 대화(npc)/설명(desc). ──
      this.nodeViews = (city.nodes || []).map((node) => {
        const [tx, ty] = node.tile;
        const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
        // NPC 노드는 캐릭터 마커(대화 대상), 그 외는 파사드 프리팹(node.facade → ct_prop_<facade>), 폴백 간판.
        const markerKey = node.npc ? `t_npc_${node.npc}`
          : node.facade ? `ct_prop_${node.facade}` : 'ct_prop_sign';
        const marker = this.add.image(wx, (ty + 1) * TILE, markerKey).setOrigin(0.5, 1).setScale(TSCALE).setDepth(wy);
        const label = node.name
          ? this.add.text(wx, ty * TILE - 4, node.name, this.labelStyle()).setOrigin(0.5, 1).setDepth(10000).setAlpha(0)
          : null;
        return { node, marker, label, wx, wy };
      });

      // ── 🚃 정기 교통 역 마커 — 근접 A 로 행선지와 다음 운행편 선택. 역사 프리팹 재사용. ──
      //   stations 배열({ id, nameJa, yomi, tile, line? })을 소비 — geo 통합 시 목록만 교체(docs §6.2).
      this.stationViews = (city.stations || []).map((st) => {
        const [tx, ty] = st.tile;
        const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
        const marker = this.add.image(wx, (ty + 1) * TILE, 'ct_prop_station').setOrigin(0.5, 1).setScale(TSCALE).setDepth(wy);
        // 🚃 마커 위 역명(일본어 간판) — 노드 라벨과 동일 도트 문법.
        const label = this.add.text(wx, ty * TILE - 4, `🚃 ${st.nameJa}`, this.labelStyle())
          .setOrigin(0.5, 1).setDepth(10000).setAlpha(0);
        return { station: st, marker, label, wx, wy };
      });
      this.wasNearStationId = null;

      // ── 플레이어 스폰 — data.spawn(직행 재접속) 검증, 실패/미지정 시 도시 입구 ──
      //   spawn 은 ENTRANCE 와 같은 보행 성분일 때만 수용한다. 맵 버전 교체(손그림 128×96 →
      //   실지형 388×254)로 구 city:* 좌표가 새 지형의 고립 포켓으로 재해석되면, 역·EXIT 에 닿지
      //   못하고 같은 좌표를 다시 저장하는 재접속 소프트락이 생긴다 → 입구 폴백(Codex #90 P1).
      let sx = city.entrance.x, sy = city.entrance.y, sfacing = city.entrance.facing || 'down';
      const rs = resolveRespawnTile(this.grid, COLS, ROWS, city.entrance, data && data.spawn);
      if (rs) { sx = rs[0]; sy = rs[1]; sfacing = 'down'; }
      this.pTileX = sx; this.pTileY = sy; this.facing = sfacing; this.moving = false; this.turnGrace = 0;
      const px = sx * TILE + TILE / 2, py = sy * TILE + TILE / 2;
      this.playerHalo = this.add.image(px, py + 9, 'ct_player_halo').setScale(TSCALE).setAlpha(0.72).setDepth(py - 1);
      this.player = this.add.image(px, py, 'ct_pc_down_n').setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);

      // 펫.
      this.petTargetX = sx - 1; this.petTargetY = sy;
      this.petPX = this.petTargetX * TILE + TILE / 2; this.petPY = this.petTargetY * TILE + TILE / 2;
      this.petFlip = false;
      this.pet = this.add.image(this.petPX, this.petPY, this.petTexKey(0)).setScale(TSCALE * this.petLevelScale());

      this.cameras.main.startFollow(this.player, true, 0.18, 0.18);

      this.vehicleViews = new Map();
      this.weatherOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x44576b, 1)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(14000).setAlpha(0);
      this.lightingOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x18254a, 1)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(13999).setAlpha(0);

      // ── 입력(광장과 동일 경로) ──
      this.heldDirs = [];
      this.tapTile = null;
      // P2: 모든 입력 진입점은 UI 잠금(inputLocked)과 씬 페이드 잠금(traveling)을 **둘 다** 확인한다.
      //   페이드 중 들어온 입력은 버퍼링하지 않고 드롭 — React 오버레이 잠금 해제 경합과 무관하게
      //   페이드인 직후 의도치 않은 이동이 없다(heldDirs 에 쌓이지 않음).
      this.input.keyboard.on('keydown', (e) => {
        if (e.key === 'b' || e.key === 'B') { this.runHeld = true; return; }
        if (this.inputLocked || this.traveling) return;
        const d = keyToDir(e.key); if (!d) return;
        this.tapTile = null;
        if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
      });
      this.input.keyboard.on('keyup', (e) => {
        if (e.key === 'b' || e.key === 'B') { this.runHeld = false; return; }
        const d = keyToDir(e.key); if (d) this.heldDirs = this.heldDirs.filter((x) => x !== d);
      });
      this.input.on('pointerdown', (p) => {
        if (this.inputLocked || this.traveling) return;
        this.tapTile = { x: Math.floor(p.worldX / TILE), y: Math.floor(p.worldY / TILE) };
        this.heldDirs.length = 0;
      });

      // ── 멀티 피어 + 채팅 말풍선 ──
      this.peers = new Map();
      this.bubbles = new Map();
      this.lastEmit = 0;
      this.lastDistEmit = 0;
      this.wasNearNodeId = null;

      this.fontReady = false;
      try {
        if (typeof document !== 'undefined' && document.fonts?.load) {
          const done = () => { this.fontReady = true; this.refreshPeerLabels?.(); };
          if (document.fonts.check("8px 'Galmuri9'")) done();
          else document.fonts.load("8px 'Galmuri9'").then(done).catch(() => {});
        }
      } catch { /* 폰트 API 미지원 — 폴백 유지 */ }

      this.events.once('shutdown', () => {
        this.heldDirs = [];
        for (const [, p] of this.peers) { p.sprite.destroy(); p.label?.destroy(); p.boat?.destroy(); }
        this.peers.clear();
        for (const [, b] of this.bubbles) { b.timer?.remove(); b.text?.destroy(); }
        this.bubbles.clear();
        // 청크 RT·물 오버레이·스탬프 회수(텍스처 메모리 해제).
        for (const [, ch] of this.chunks) ch.rt.destroy();
        this.chunks.clear();
        for (const img of this.waterPool) img.destroy();
        this.waterPool.length = 0;
        this.chunkStamp?.destroy();
        this.transitGuide?.destroy();
        for (const [, view] of this.vehicleViews) view.destroy();
        this.vehicleViews.clear();
        ctx.setTransitStatus?.(null);
      });

      // 페이드인 → 조작 해제.
      this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
      this.cameras.main.once('camerafadeincomplete', () => { this.inputLocked = false; });

      // create 말미 — 피어 스냅샷 재적용 + 전체 키 거리 1회 emit(씬 전환 음성 잔류 차단, Codex P1-2).
      ctx.onReady?.();
    }

    // ── 청크 RT 베이킹 ── 한 청크(CHUNK_TILES²)를 오프스크린 RT 1장에 타일을 batchDraw.
    bakeChunk(cx, cy) {
      const wPx = CHUNK_TILES * TILE, hPx = CHUNK_TILES * TILE; // 512×512
      const ox = cx * CHUNK_TILES, oy = cy * CHUNK_TILES;
      const rt = this.add.renderTexture(ox * TILE, oy * TILE, wPx, hPx).setOrigin(0, 0).setDepth(-10);
      rt.setRoundPixels?.(true);
      const stamp = this.chunkStamp;
      const x1 = Math.min(COLS, ox + CHUNK_TILES), y1 = Math.min(ROWS, oy + CHUNK_TILES);
      rt.beginDraw();
      for (let ty = oy; ty < y1; ty++) {
        for (let tx = ox; tx < x1; tx++) {
          stamp.setTexture(this.terrainTexKey(tx, ty));
          rt.batchDraw(stamp, (tx - ox) * TILE, (ty - oy) * TILE);
        }
      }
      if (city.railways?.mask) {
        for (let ty = oy; ty < y1; ty++) {
          for (let tx = ox; tx < x1; tx++) {
            if (!this.railwayAt(tx, ty)) continue;
            stamp.setTexture('ct_rail_area');
            rt.batchDraw(stamp, (tx - ox) * TILE, (ty - oy) * TILE);
          }
        }
      }
      rt.endDraw();
      return rt;
    }

    // 가시 청크 범위의 가로수(공원·대로변) — 청크 생명주기에 묶어 화면+pad 밖엔 존재하지 않음(Codex P1).
    //   위치 결정성(tileHash)·2타일 높이 오버행·캐릭터 depth 정렬은 정적 스프라이트라 그대로 유지.
    buildChunkTrees(cx, cy) {
      const b = chunkTileBounds(cx, cy, COLS, ROWS);
      const trees = [];
      for (let y = b.y0; y < b.y1; y++) {
        for (let x = b.x0; x < b.x1; x++) {
          const c = this.grid[y * COLS + x];
          const isPark = c === TERRAIN.PARK && tileHash(x, y) < 0.28;
          const isVerge = c === TERRAIN.SIDEWALK && this.tileCode(x, y - 1) === TERRAIN.ROAD && tileHash(x, y) < 0.16;
          if (!isPark && !isVerge) continue;
          trees.push(this.add.image(x * TILE + TILE / 2, (y + 1) * TILE, 'ct_tree')
            .setOrigin(0.5, 1).setScale(TSCALE).setDepth((y + 1) * TILE));
        }
      }
      return trees;
    }

    setChunkVisible(ch, vis) {
      ch.rt.setVisible(vis);
      for (const t of ch.decor) t.setVisible(vis);
    }

    destroyChunk(key) {
      const ch = this.chunks.get(key);
      if (!ch) return;
      ch.rt.destroy();
      for (const t of ch.decor) t.destroy();
      this.chunks.delete(key);
      this.chunkLRU.delete(key);
    }

    // 카메라에 겹치는 청크만 표시 — 지연 bake, 밖은 숨김. **bake 전에 선축출**(planChunkUpdate)해
    //   순간이동 시에도 상주 RT peak 가 cap 을 넘지 않는다(Codex P2). force: create 초기화.
    refreshChunks(force = false) {
      const view = this.cameras.main.worldView;
      const chunkPx = CHUNK_TILES * TILE;
      const camCX = Math.floor((view.x + view.width / 2) / chunkPx);
      const camCY = Math.floor((view.y + view.height / 2) / chunkPx);
      if (!force && camCX === this.lastCamCX && camCY === this.lastCamCY) return;
      this.lastCamCX = camCX; this.lastCamCY = camCY;

      const vis = visibleChunks(view, { tile: TILE, chunkCols: this.chunkCols, chunkRows: this.chunkRows, pad: 1 });
      const visKeys = vis.map((c) => c.key);
      const protect = new Set(visKeys);
      // 이번에 안 보이는 청크는 숨김(회수는 아래 선축출이 담당).
      for (const [key, ch] of this.chunks) if (!protect.has(key)) this.setChunkVisible(ch, false);

      // 계획: 새 청크를 bake 하기 전에 비가시부터 선축출 → 매 순간 상주 ≤ cap.
      const plan = planChunkUpdate(this.chunkLRU, this.chunks, visKeys, this.chunkCap);
      for (const key of plan.toDestroy) this.destroyChunk(key);
      for (const c of vis) {
        if (!this.chunks.has(c.key)) {
          this.chunks.set(c.key, { rt: this.bakeChunk(c.cx, c.cy), decor: this.buildChunkTrees(c.cx, c.cy), cx: c.cx, cy: c.cy });
        }
        this.setChunkVisible(this.chunks.get(c.key), true);
        this.chunkLRU.touch(c.key);
      }
    }

    // 뷰포트 안 물(WATER·RIVER) 타일에만 애니 프레임을 얹는 경량 오버레이(풀 재사용 · 뷰포트 상한).
    refreshWaterOverlay() {
      const v = this.cameras.main.worldView;
      const x0 = Math.max(0, Math.floor(v.x / TILE)), x1 = Math.min(COLS - 1, Math.floor((v.right - 1e-4) / TILE));
      const y0 = Math.max(0, Math.floor(v.y / TILE)), y1 = Math.min(ROWS - 1, Math.floor((v.bottom - 1e-4) / TILE));
      let n = 0;
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const c = this.tileCode(tx, ty);
          if (c !== TERRAIN.WATER && c !== TERRAIN.RIVER) continue;
          let img = this.waterPool[n];
          if (!img) { img = this.add.image(0, 0, 'ct_water0').setOrigin(0, 0).setScale(TSCALE).setDepth(-5); this.waterPool.push(img); }
          img.setVisible(true).setPosition(tx * TILE, ty * TILE)
            .setTexture(`${c === TERRAIN.RIVER ? 'ct_river' : 'ct_water'}${this.waterFrame}`);
          n++;
        }
      }
      for (let i = n; i < this.waterPool.length; i++) this.waterPool[i].setVisible(false);
    }

    // ── 외부(GBC 셸) 입력 주입 — 광장·공항과 동일 인터페이스 ──
    extInputDown(d) {
      if (this.inputLocked || this.traveling || !VALID_DIR.has(d)) return; // P2: 페이드 중 입력 드롭
      this.tapTile = null;
      if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
    }
    extInputUp(d) { this.heldDirs = this.heldDirs.filter((x) => x !== d); }

    applyPeers(incoming) {
      applyPeersToScene(this, incoming, { charPrefix: 'ct_pr', sceneName: SCENE_KEY });
    }
    refreshPeerLabels() {
      for (const [, p] of this.peers) p.label?.setStyle(peerLabelStyle(this.fontReady));
      for (const [, b] of this.bubbles) b.text?.setFontFamily(this.fontReady ? "'Galmuri9', monospace" : 'monospace');
    }

    // 채팅 말풍선(전역 채널) — 광장과 동일 문법(자기=플레이어, 그 외=피어).
    showChatBubble(userIdOfMsg, text) {
      const clean = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
      if (!clean) return;
      const isSelf = userIdOfMsg && userIdOfMsg === ctx.userId;
      const target = isSelf ? this.player : this.peers.get(userIdOfMsg)?.sprite;
      if (!target) return;
      const shown = clean.length > 24 ? `${clean.slice(0, 23)}…` : clean;
      const prev = this.bubbles.get(userIdOfMsg);
      if (prev) { prev.timer?.remove(); prev.text.destroy(); }
      const txt = this.add.text(target.x, target.y, shown, {
        fontFamily: this.fontReady ? "'Galmuri9', monospace" : 'monospace',
        fontSize: '8px', color: '#2a2118', backgroundColor: '#f6edcf', padding: { x: 3, y: 2 },
      }).setOrigin(0.5, 1).setDepth(PEER_LABEL_DEPTH + 1);
      const timer = this.time.delayedCall(3000, () => {
        txt.destroy();
        if (this.bubbles.get(userIdOfMsg)?.text === txt) this.bubbles.delete(userIdOfMsg);
      });
      this.bubbles.set(userIdOfMsg, { text: txt, target, timer });
    }

    // 완료/정답 연출(버스 quest:scored/done 재사용 — 인게임 리뷰·NPC 대화 하트).
    questScoredFx({ correct } = {}) { if (correct) this.spawnHeart(); }
    questDoneFx() {
      this.tweens.add({ targets: this, petJumpVal: 1, duration: 220, ease: 'Quad.easeOut', yoyo: true, repeat: 1 });
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 120, () => this.spawnHeart());
    }
    spawnHeart() {
      if (!this.pet) return;
      const h = this.add.image(this.pet.x, this.pet.y - 12, 'ct_heart').setScale(TSCALE).setDepth(10001);
      this.tweens.add({ targets: h, y: h.y - 26, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
    }

    startStep(dir) {
      const [dx, dy] = DIRV[dir];
      const prevX = this.pTileX, prevY = this.pTileY;
      this.pTileX += dx; this.pTileY += dy;
      this.moving = true;
      const dur = this.runHeld ? RUN_STEP_MS : STEP_MS;
      const tx = this.pTileX * TILE + TILE / 2, ty = this.pTileY * TILE + TILE / 2;
      this.tweens.add({
        targets: this.player, x: tx, y: ty, duration: dur, ease: 'Linear',
        onComplete: () => { this.moving = false; this.petTargetX = prevX; this.petTargetY = prevY; this.onStepDone(); },
      });
    }
    onStepDone() {
      if (this.tileCode(this.pTileX, this.pTileY) === T.EXIT) this.returnToWorld();
    }

    tapStepDir() {
      if (!this.tapTile) return null;
      if (this.tapTile.x === this.pTileX && this.tapTile.y === this.pTileY) { this.tapTile = null; return null; }
      if (this.tapTile.x !== this.pTileX) return this.tapTile.x > this.pTileX ? 'right' : 'left';
      if (this.tapTile.y !== this.pTileY) return this.tapTile.y > this.pTileY ? 'down' : 'up';
      return null;
    }

    // 출구 타일 → 전국맵 복귀(도시 노드 앞 스폰). 페이드 아웃 + 조작 잠금(페리와 동일 문법).
    returnToWorld() {
      if (this.exiting) return;
      this.exiting = true;
      this.inputLocked = true;
      this.heldDirs.length = 0; this.tapTile = null; this.runHeld = false;
      ctx.setNear?.(null);
      this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        const returnScene = worldSceneReturnTarget(this.worldReturn);
        this.scene.start(returnScene, { spawn: this.worldReturn });
      });
    }

    // ── 🚃 정기 교통 도착 배치 — 운행이 끝나면 같은 도시 씬의 역 인접 보행칸에 내린다. ──
    placeAt(tx, ty) {
      this.pTileX = tx; this.pTileY = ty; this.moving = false; this.turnGrace = 0;
      this.heldDirs.length = 0; this.tapTile = null;
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      this.player.setPosition(wx, wy);
      this.player.setDepth(wy);
      this.playerHalo.setPosition(wx, wy + 9).setDepth(wy - 1);
      // 펫·카메라를 도착 지점으로 스냅(추적 보간 잔상 방지).
      this.petTargetX = tx - 1; this.petTargetY = ty;
      this.petPX = this.petTargetX * TILE + TILE / 2; this.petPY = this.petTargetY * TILE + TILE / 2;
      this.pet.setPosition(Math.round(this.petPX), Math.round(this.petPY));
      this.cameras.main.centerOn(wx, wy);
      this.refreshChunks(true);      // 도착 지점 청크 즉시 bake(도착 직후 빈 화면 방지)
      this.refreshWaterOverlay();
    }

    reserveTransit(fromId, toId) {
      const now = ctx.worldClockRef?.current?.totalGameMinutes;
      if (!Number.isFinite(now) || this.exiting || this.traveling || this.transitTrip) return false;
      const trip = planTransitTrip(city.transit || [], city.stations || [], fromId, toId, now);
      if (!trip) { ctx.travelBlocked?.(); return false; }
      this.transitTrip = trip;
      this.transitState = 'waiting';
      ctx.setTransitStatus?.({
        state: 'waiting', line: trip.line.nameJa, from: trip.origin.nameJa, to: trip.destination.nameJa,
        departureMinute: trip.departureMinute, arrivalMinute: trip.arrivalMinute,
      });
      return true;
    }

    cancelTransit(reason = 'cancelled') {
      this.transitTrip = null;
      this.transitState = 'none';
      if (reason === 'missed') ctx.setTransitStatus?.({ state: 'missed', message: '출발 시각을 놓쳤어요.' });
      else ctx.setTransitStatus?.(null);
    }

    updateTransitVehicles(totalGameMinutes) {
      const stops = [...(city.stations || []), ...(city.transitPoints || [])];
      const active = activeVehiclesAt(city.transit || [], stops, totalGameMinutes);
      const alive = new Set();
      for (const vehicle of active) {
        alive.add(vehicle.runId);
        let view = this.vehicleViews.get(vehicle.runId);
        if (!view) {
          const texture = vehicle.line.mode === 'ferry' ? 'ct_vehicle_ferry'
            : vehicle.line.mode === 'bus' ? 'ct_vehicle_bus' : 'ct_vehicle_train';
          view = this.add.image(0, 0, texture).setScale(TSCALE).setDepth(8500);
          this.vehicleViews.set(vehicle.runId, view);
        }
        const wx = vehicle.tile[0] * TILE + TILE / 2;
        const wy = vehicle.tile[1] * TILE + TILE / 2;
        view.setPosition(wx, wy).setDepth(Math.max(8500, wy + 2)).setVisible(true);
      }
      for (const [runId, view] of this.vehicleViews) {
        if (alive.has(runId)) continue;
        view.destroy();
        this.vehicleViews.delete(runId);
      }
    }

    updateReservedTrip(totalGameMinutes) {
      const trip = this.transitTrip;
      if (!trip) return;
      const state = tripStateAt(trip, totalGameMinutes);
      if (state === 'waiting') return;
      if (state === 'riding' && this.transitState !== 'riding') {
        const origin = (city.stations || []).find((station) => station.id === trip.fromId);
        const ox = origin.tile[0] * TILE + TILE / 2;
        const oy = origin.tile[1] * TILE + TILE / 2;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, ox, oy) >= NODE_TALK_RANGE) {
          this.cancelTransit('missed');
          return;
        }
        this.transitState = 'riding';
        this.traveling = true;
        this.inputLocked = true;
        this.player.setVisible(false); this.playerHalo.setVisible(false); this.pet.setVisible(false);
        this.cameras.main.stopFollow();
        ctx.setTransitStatus?.({
          state: 'riding', line: trip.line.nameJa, from: trip.origin.nameJa, to: trip.destination.nameJa,
          departureMinute: trip.departureMinute, arrivalMinute: trip.arrivalMinute,
        });
      }
      if (state === 'riding') {
        const vehicle = this.vehicleViews.get(trip.runId);
        if (vehicle) this.cameras.main.centerOn(vehicle.x, vehicle.y);
        return;
      }
      if (state === 'arrived') {
        if (this.transitState !== 'riding') {
          this.cancelTransit('missed');
          return;
        }
        const arrival = resolveArrivalTile(this.grid, COLS, ROWS, trip.destination.tile);
        if (arrival) this.placeAt(arrival[0], arrival[1]);
        this.player.setVisible(true); this.playerHalo.setVisible(true); this.pet.setVisible(true);
        this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
        this.traveling = false;
        this.inputLocked = false;
        ctx.arrivedStation?.({ nameJa: trip.destination.nameJa, yomi: trip.destination.yomi });
        ctx.setTransitStatus?.({ state: 'arrived', message: `${trip.destination.nameJa} 도착` });
        this.transitTrip = null;
        this.transitState = 'none';
      }
    }

    emitDistances() { emitPeerDistances(this, bus); }

    update(time, delta) {
      // 지형 청크 가시성(카메라 청크 이동 시에만 bake/축출) + 물 오버레이(뷰포트 안 물 타일 추종).
      this.refreshChunks();
      this.refreshWaterOverlay();
      const worldSnapshot = ctx.worldClockRef?.current;
      if (worldSnapshot && time - this.lastVehicleUpdate > 500) {
        this.lastVehicleUpdate = time;
        this.updateTransitVehicles(worldSnapshot.totalGameMinutes);
        const weather = cityWeatherAt(city.id, worldSnapshot);
        this.weatherOverlay.setAlpha(weather.id === 'rain' ? 0.16 : weather.id === 'fog' ? 0.22 : weather.id === 'cloudy' ? 0.08 : 0);
        this.lightingOverlay.setAlpha(['night', 'late-night'].includes(worldSnapshot.phase) ? 0.24
          : worldSnapshot.phase === 'dawn' || worldSnapshot.phase === 'evening' ? 0.1 : 0);
      }
      if (worldSnapshot) this.updateReservedTrip(worldSnapshot.totalGameMinutes);

      // 이동 상태기계(광장과 동일 — 달리기 B 홀드 포함).
      //   traveling(🚃 승차) 중엔 React 입력잠금 효과와의 경합과 무관하게 이동 금지.
      if (!this.moving && !this.inputLocked && !this.traveling) {
        const held = this.heldDirs.length ? this.heldDirs[this.heldDirs.length - 1] : null;
        if (held) {
          if (this.facing !== held) { this.facing = held; this.turnGrace = time + TURN_MS; }
          else if (time >= this.turnGrace) {
            const [dx, dy] = DIRV[held];
            if (!this.blocked(this.pTileX + dx, this.pTileY + dy)) this.startStep(held);
          }
        } else {
          const tdir = this.tapStepDir();
          if (tdir) {
            this.facing = tdir;
            const [dx, dy] = DIRV[tdir];
            if (!this.blocked(this.pTileX + dx, this.pTileY + dy)) this.startStep(tdir);
            else this.tapTile = null;
          }
        }
      }

      const charAnimMs = this.runHeld ? RUN_ANIM_MS : CHAR_ANIM_MS;
      this.setCharFrame(this.player, 'ct_pc', this.facing, this.moving, time, charAnimMs);
      this.player.setDepth(this.player.y);
      this.playerHalo.setPosition(this.player.x, this.player.y + 9).setDepth(this.player.y - 1);

      // 펫 추적(광장과 동일 — 달리기 시 동속).
      const petObj = ctx.petRef?.current || {};
      const tgx = this.petTargetX * TILE + TILE / 2, tgy = this.petTargetY * TILE + TILE / 2;
      const pdx = tgx - this.petPX, pdy = tgy - this.petPY;
      const pdist = Math.hypot(pdx, pdy);
      const petMoving = pdist > 0.5;
      if (petMoving) {
        const petStepMs = this.runHeld ? RUN_STEP_MS : STEP_MS;
        const stepPx = (TILE / petStepMs) * delta;
        const k = Math.min(1, stepPx / pdist);
        this.petPX += pdx * k; this.petPY += pdy * k;
        if (Math.abs(pdx) > Math.abs(pdy)) this.petFlip = pdx < 0;
      }
      const petFrameMs = petMoving ? WALK_MS : PET_IDLE_MS;
      this.pet.setTexture(this.petTexKey(Math.floor(time / petFrameMs) % 2));
      this.pet.setScale(TSCALE * this.petLevelScale());
      this.pet.setFlipX(this.petFlip);
      let petRenderY = this.petPY;
      if (petObj.mood === 'happy' || petObj.mood === 'excited') petRenderY -= Math.abs(Math.sin(time / 1000 * 6)) * 4;
      petRenderY -= (this.petJumpVal || 0) * 18;
      this.pet.setPosition(Math.round(this.petPX), Math.round(petRenderY));
      this.pet.setDepth(this.petPY);

      // 원격 피어(도시 씬) — 물 위 배 표시는 도시맵엔 불필요(isWater 미주입).
      updateScenePeers(this, time, { charPrefix: 'ct_pr' });

      // 말풍선 추적.
      for (const [uid, b] of this.bubbles) {
        if (!b.text || !b.target || !b.target.active) { b.timer?.remove(); b.text?.destroy(); this.bubbles.delete(uid); continue; }
        b.text.setPosition(Math.round(b.target.x), Math.round(b.target.y) - PEER_LABEL_DY - 12);
      }

      // 근접 음성 거리 emit(같은 도시=실거리 · 타 씬=Infinity), 500ms 스로틀.
      if (time - this.lastDistEmit > 500) { this.lastDistEmit = time; emitPeerDistances(this, bus); }

      // local:state — ~100ms. scene:'city:<id>' + persistable:true(도시 내 위치는 저장 대상).
      //   이탈(페이드 아웃) 중엔 좌표를 보내지 않는다(전국맵 복귀 직전 stale 도시 좌표 저장 방지).
      if (!this.exiting && time - this.lastEmit > 100) {
        this.lastEmit = time;
        bus.emit('local:state', {
          x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.facing,
          scene: SCENE_KEY, persistable: true,
        });
      }

      if (this.exiting) return;

      const labelRange = TILE * 6;
      for (const view of this.nodeViews) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, view.wx, view.wy);
        view.label?.setAlpha(distance < labelRange ? 1 : 0);
        if (worldSnapshot) {
          const life = nodeLifeAt(view.node, worldSnapshot);
          view.marker.setAlpha(life.open ? 1 : 0.42).setTint(life.open ? 0xffffff : 0x7a7a82);
        }
      }
      for (const view of this.stationViews) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, view.wx, view.wy);
        view.label.setAlpha(distance < labelRange ? 1 : 0);
      }

      // 노드 근접 → React(nearNode). 라벨은 6타일 안에서만, 프롬프트/설명은 A 로.
      let nearest = null, nearestD = NODE_TALK_RANGE;
      for (const v of this.nodeViews) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, v.wx, v.wy);
        if (d < nearestD) { nearest = v.node; nearestD = d; }
      }
      const nearestLife = nearest && worldSnapshot ? nodeLifeAt(nearest, worldSnapshot) : { open: true };
      const nid = nearest ? `${nearest.id}:${nearestLife.open}` : null;
      if (nid !== this.wasNearNodeId) {
        this.wasNearNodeId = nid;
        ctx.setNear?.(toInteractiveNode(nearest ? {
          ...nearest,
          openNow: nearestLife.open,
          desc: nearestLife.open ? nearest.desc : `${nearest.desc}\n지금은 영업이 끝났어요. 세계 시각에 맞춰 다시 열려요.`,
        } : null));
      }

      // 🚃 역 근접 → React(nearStation). A 로 행선지 선택 오버레이. (노드와 별개 목록·별개 상태.)
      let nearSt = null, nearStD = NODE_TALK_RANGE;
      for (const v of this.stationViews) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, v.wx, v.wy);
        if (d < nearStD) { nearSt = v.station; nearStD = d; }
      }
      const sid = nearSt ? nearSt.id : null;
      if (sid !== this.wasNearStationId) {
        this.wasNearStationId = sid;
        ctx.setNearStation?.(nearSt ? { id: nearSt.id, nameJa: nearSt.nameJa, yomi: nearSt.yomi, line: nearSt.line } : null);
      }
    }
  };
}
