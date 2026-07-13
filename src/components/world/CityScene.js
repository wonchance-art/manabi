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
  tonePalette, toneColor, timeOfDay,
  applyPeersToScene, updateScenePeers, peerLabelStyle, emitPeerDistances,
} from './sprites';
import { GBC } from './QuestReview';
import bus from './bus';

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
 *   setNear(node|null),              근접 노드 → React(nearNode) — { id, name, desc, npc?, noStamp? }
 *   worldReturn: { scene:'plaza', x, y },   전국맵 복귀 스폰(도시 노드 앞)
 * }
 */
export function buildCityScene(Phaser, city, ctx) {
  const T = city.CITY_TILE;
  const COLS = city.cols;
  const ROWS = city.rows;
  const SCENE_KEY = `city:${city.id}`;

  return class CityScene extends Phaser.Scene {
    constructor() { super(SCENE_KEY); }

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
      this.mode = timeOfDay();
      const C = (hex) => toneColor(hex, this.mode);

      // ── 지면 타일(도로·보도·횡단보도·광장·공원·다리·부두·출구·수면) ──
      // 도로 — 짙은 아스팔트 + 점선 중앙선.
      this.bakeTile('ct_road', (g) => {
        g.fillStyle(C(0x4a4d55), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0x3d4048), 1); for (const [x, y] of [[2, 3], [11, 5], [5, 12], [13, 10]]) g.fillRect(x, y, 1, 1);
        g.fillStyle(C(0xd9d2b0), 0.85); g.fillRect(7, 2, 2, 4); g.fillRect(7, 10, 2, 4); // 중앙 점선
      });
      // 보도 — 밝은 웜 그레이 + 이음새 격자.
      this.bakeTile('ct_sidewalk', (g) => {
        g.fillStyle(C(0xcfc7b4), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0xbdb39c), 0.6); g.fillRect(0, 7, TEX, 1); g.fillRect(7, 0, 1, TEX);
        g.fillStyle(C(0xdcd5c4), 0.5); g.fillRect(1, 1, 5, 5); g.fillRect(9, 9, 5, 5);
      });
      // 횡단보도 — 도로 바탕 + 흰 지브라.
      this.bakeTile('ct_crosswalk', (g) => {
        g.fillStyle(C(0x4a4d55), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(0xeae4d2), 0.92); for (const x of [1, 5, 9, 13]) g.fillRect(x, 0, 2, TEX);
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

      // ── 건물 파사드 2종(창격자 · 벽돌 변형) — 도트 감성 top-down 건물 ──
      const bldg = (key, wall, wallD, roof, win) => this.bakeTile(key, (g) => {
        g.fillStyle(C(wall), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(C(roof), 1); g.fillRect(0, 0, TEX, 3);            // 지붕 처마
        g.fillStyle(C(wallD), 1); g.fillRect(0, TEX - 2, TEX, 2);     // 하단 그림자
        g.fillStyle(C(win), 1);                                       // 창 격자
        for (const wy of [5, 10]) for (const wx of [2, 7, 12]) g.fillRect(wx, wy, 3, 3);
        g.fillStyle(C(wallD), 0.7); for (const wy of [5, 10]) for (const wx of [2, 7, 12]) { g.fillRect(wx, wy, 3, 1); }
      });
      bldg('ct_bldg_a', 0xb9b2a4, 0x8f887a, 0x7a7266, 0x8fb8d0); // 콘크리트 + 유리창
      bldg('ct_bldg_b', 0xc09a72, 0x93724e, 0x7a5a3a, 0xe6d8b0); // 벽돌/타일 + 밝은 창

      // ── 타일 아틀라스(1장) — 172k 미만이라 add.image 도 되지만 광장과 동일 tilemap 레이어 방식 ──
      // 인덱스: 0도로 1보도 2횡단 3광장 4공원 5다리 6부두 7출구 8·9·10수면3프레임 11건물A 12건물B.
      if (!this.textures.exists('city_tiles')) {
        const keys = ['ct_road', 'ct_sidewalk', 'ct_crosswalk', 'ct_plaza', 'ct_park', 'ct_bridge', 'ct_dock', 'ct_exit', 'ct_water0', 'ct_water1', 'ct_water2', 'ct_bldg_a', 'ct_bldg_b'];
        const atlas = this.textures.createCanvas('city_tiles', keys.length * TEX, TEX);
        const actx = atlas.getContext();
        for (let i = 0; i < keys.length; i++) actx.drawImage(this.textures.get(keys[i]).getSourceImage(), i * TEX, 0);
        atlas.refresh();
      }

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

      // ── 캐릭터(플레이어 ct_pc · 원격 피어 ct_pr) + 펫 + NPC 마커 ──
      this.bakeCharSet('ct_pc', tonePalette(CHAR_PAL_LOCAL, this.mode));
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
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return T.WATER; // 범위 밖 = 물(차단)
      return this.grid[ty * COLS + tx];
    }
    blocked(tx, ty) {
      const c = this.tileCode(tx, ty);
      return c === T.WATER || c === T.BUILDING;
    }
    isWaterTile(tx, ty) { return this.tileCode(tx, ty) === T.WATER; }

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

      this.grid = city.buildGrid();

      this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
      this.cameras.main.setBackgroundColor(toneColor(0x2f3540, this.mode));
      this.cameras.main.setZoom(ZOOM);
      this.cameras.main.setRoundPixels(true);

      // ── 지형 레이어(tilemap 1장) ──
      const codeToIdx = (c, x, y) => {
        switch (c) {
          case T.ROAD: return 0;
          case T.SIDEWALK: return 1;
          case T.CROSSWALK: return 2;
          case T.PLAZA: return 3;
          case T.PARK: return 4;
          case T.BRIDGE: return 5;
          case T.DOCK: return 6;
          case T.EXIT: return 7;
          case T.WATER: return 8;
          case T.BUILDING: return tileHash(x, y) < 0.5 ? 11 : 12;
          default: return 1;
        }
      };
      const mapData = [];
      for (let y = 0; y < ROWS; y++) {
        const row = new Array(COLS);
        for (let x = 0; x < COLS; x++) row[x] = codeToIdx(this.grid[y * COLS + x], x, y);
        mapData.push(row);
      }
      const tmap = this.make.tilemap({ data: mapData, tileWidth: TEX, tileHeight: TEX });
      const tileset = tmap.addTilesetImage('city_tiles', 'city_tiles', TEX, TEX, 0, 0);
      this.layer = tmap.createLayer(0, tileset, 0, 0).setScale(TSCALE).setDepth(0);

      // 수면 물결 애니(화면 안 물 타일만).
      this.waterFrame = 0;
      this.time.addEvent({ delay: 520, loop: true, callback: () => {
        this.waterFrame = (this.waterFrame + 1) % 3;
        this.animateWater();
      } });

      // ── 가로수(공원 + 대로 변) — 도시가 작아 정적 배치(컬링 불필요) ──
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const c = this.grid[y * COLS + x];
          const isPark = c === T.PARK && tileHash(x, y) < 0.28;
          const isVerge = c === T.SIDEWALK && this.tileCode(x, y - 1) === T.ROAD && tileHash(x, y) < 0.16;
          if (!isPark && !isVerge) continue;
          this.add.image(x * TILE + TILE / 2, (y + 1) * TILE, 'ct_tree').setOrigin(0.5, 1).setScale(TSCALE).setDepth((y + 1) * TILE);
        }
      }

      // ── 프리팹 파사드(노렌·간판) — 프론티지 소품(비상호작용) ──
      for (const p of (city.props || [])) {
        const [px, py] = p.tile;
        this.add.image(px * TILE + TILE / 2, (py + 1) * TILE, `ct_prop_${p.kind}`)
          .setOrigin(0.5, 1).setScale(TSCALE).setDepth((py + 1) * TILE);
      }

      // ── 구역(동네) 라벨 — 은은한 도트 표지(오리엔테이션) ──
      for (const z of (city.zones || [])) {
        const [lx, ly] = z.labelTile;
        this.add.text(lx * TILE + TILE / 2, ly * TILE + TILE / 2, z.label, {
          fontFamily: 'monospace', fontSize: '10px', color: GBC.cream,
          backgroundColor: 'rgba(20,22,26,0.55)', padding: { x: 4, y: 2 }, resolution: 1,
        }).setOrigin(0.5, 0.5).setDepth(9000).setAlpha(0.9);
      }

      // ── 가게/NPC 노드 마커 — 발밑(하단 중앙) 정렬. 근접 A 로 대화(npc)/설명(desc). ──
      this.nodeViews = (city.nodes || []).map((node) => {
        const [tx, ty] = node.tile;
        const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
        const markerKey = node.facade === 'donki' ? 'ct_prop_donki'
          : node.npc ? `t_npc_${node.npc}` : 'ct_prop_sign';
        const marker = this.add.image(wx, (ty + 1) * TILE, markerKey).setOrigin(0.5, 1).setScale(TSCALE).setDepth(wy);
        if (node.name) {
          this.add.text(wx, ty * TILE - 4, node.name, this.labelStyle()).setOrigin(0.5, 1).setDepth(10000);
        }
        return { node, wx, wy };
      });

      // ── 플레이어 스폰 — data.spawn(직행 재접속) 검증, 실패/미지정 시 도시 입구 ──
      let sx = city.entrance.x, sy = city.entrance.y, sfacing = city.entrance.facing || 'down';
      const sp = data && data.spawn;
      if (sp && Number.isInteger(sp.x) && Number.isInteger(sp.y)
        && sp.x >= 0 && sp.y >= 0 && sp.x < COLS && sp.y < ROWS && !this.blocked(sp.x, sp.y)) {
        sx = sp.x; sy = sp.y; sfacing = 'down';
      }
      this.pTileX = sx; this.pTileY = sy; this.facing = sfacing; this.moving = false; this.turnGrace = 0;
      const px = sx * TILE + TILE / 2, py = sy * TILE + TILE / 2;
      this.player = this.add.image(px, py, 'ct_pc_down_n').setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);

      // 펫.
      this.petTargetX = sx - 1; this.petTargetY = sy;
      this.petPX = this.petTargetX * TILE + TILE / 2; this.petPY = this.petTargetY * TILE + TILE / 2;
      this.petFlip = false;
      this.pet = this.add.image(this.petPX, this.petPY, this.petTexKey(0)).setScale(TSCALE * this.petLevelScale());

      this.cameras.main.startFollow(this.player, true, 0.18, 0.18);

      // ── 입력(광장과 동일 경로) ──
      this.heldDirs = [];
      this.tapTile = null;
      this.input.keyboard.on('keydown', (e) => {
        if (e.key === 'b' || e.key === 'B') { this.runHeld = true; return; }
        if (this.inputLocked) return;
        const d = keyToDir(e.key); if (!d) return;
        this.tapTile = null;
        if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
      });
      this.input.keyboard.on('keyup', (e) => {
        if (e.key === 'b' || e.key === 'B') { this.runHeld = false; return; }
        const d = keyToDir(e.key); if (d) this.heldDirs = this.heldDirs.filter((x) => x !== d);
      });
      this.input.on('pointerdown', (p) => {
        if (this.inputLocked) return;
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
      });

      // 페이드인 → 조작 해제.
      this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
      this.cameras.main.once('camerafadeincomplete', () => { this.inputLocked = false; });
    }

    // 화면 안 수면 타일만 물결 프레임 교체.
    animateWater() {
      if (!this.layer) return;
      const v = this.cameras.main.worldView;
      const x0 = Math.max(0, Math.floor(v.x / TILE)), x1 = Math.min(COLS - 1, Math.ceil(v.right / TILE));
      const y0 = Math.max(0, Math.floor(v.y / TILE)), y1 = Math.min(ROWS - 1, Math.ceil(v.bottom / TILE));
      const idx = 8 + this.waterFrame; // 8·9·10
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.isWaterTile(tx, ty)) this.layer.putTileAt(idx, tx, ty);
    }

    // ── 외부(GBC 셸) 입력 주입 — 광장·공항과 동일 인터페이스 ──
    extInputDown(d) {
      if (this.inputLocked || !VALID_DIR.has(d)) return;
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
        this.scene.start('world', { spawn: ctx.worldReturn });
      });
    }

    emitDistances() { emitPeerDistances(this, bus); }

    update(time, delta) {
      // 이동 상태기계(광장과 동일 — 달리기 B 홀드 포함).
      if (!this.moving && !this.inputLocked) {
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

      // 노드 근접 → React(nearNode). 라벨은 마커에 상시 표시, 프롬프트/설명은 A 로.
      let nearest = null, nearestD = NODE_TALK_RANGE;
      for (const v of this.nodeViews) {
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, v.wx, v.wy);
        if (d < nearestD) { nearest = v.node; nearestD = d; }
      }
      const nid = nearest ? nearest.id : null;
      if (nid !== this.wasNearNodeId) {
        this.wasNearNodeId = nid;
        ctx.setNear?.(nearest ? { id: nearest.id, name: nearest.name, desc: nearest.desc, npc: nearest.npc, noStamp: nearest.noStamp } : null);
      }
    }
  };
}
