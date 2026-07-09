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
// ── GB 실규격 뷰포트 ──
// 게임 캔버스를 160×144(=GB 화면)로 고정하고, 카메라 zoom 0.5로 32px/타일 월드를
// 화면상 16px/타일로 낮춰 **정확히 10×9타일**(=GB 필드 시야)이 담기게 한다.
//   · 왜 0.5인가: 월드 1타일=32px는 버스 계약상 불변 → 160px에 10타일을 담으려면
//     화면상 타일 16px = 32px×0.5. (오케스트레이터 지시의 "zoom 1"은 타일을 16px로 본
//     계산이나, 실제 월드 타일은 32px이므로 동일한 10×9 시야를 내려면 0.5가 맞다.)
//   · zoom은 렌더 스케일일 뿐 월드 좌표/버스/음성 근접 게이팅에는 영향 없다(예전 1.5와 동일 원리).
// 캔버스(160×144)는 컨테이너에 맞춰 **정수 배율**(×2/×3/×4…)로만 CSS 확대한다(도트 보존).

import { useEffect, useRef, useState } from 'react';
import bus from './bus';
import QuestReview, { GBC, gbcButtonPrimary, gbcPanel } from './QuestReview';
import {
  CHAR_W, CHAR_H, CHAR_ORIGIN_Y, PET_W, PET_H,
  CHAR_DIRS, CHAR_POSES, CHAR_WALK_CYCLE, charFrameRows,
  PET_KEYS, petFrameRows,
  BASE_TILE_PAL, CHAR_PAL_LOCAL, CHAR_PAL_REMOTE, PET_PAL,
  tonePalette, toneColor, timeOfDay,
} from './sprites';

// ── 좌표 스케일 (버스 계약 불변: 1타일 = 32 월드 px) ──
const TILE = 32;            // 월드 px / 타일 (예전과 동일 — local:state·peers:dist 스케일 유지)
const TEX = 16;             // 타일 소스 텍스처 크기(px) — 도트 원본
const TSCALE = TILE / TEX;  // 소스→월드 배율 = 2 (타일·캐릭터·펫 공통: 소스 1px = 월드 2px)
const ZOOM = 0.5;           // 카메라 줌 → 화면상 타일 32*0.5 = 16px (소스 16px 1:1 = GB 도트 룩)
const VIEW_W = 160;         // GB 화면 가로(px) = 10타일 × 16px
const VIEW_H = 144;         // GB 화면 세로(px) = 9타일 × 16px
const MIN_SCALE = 2;        // 캔버스 최소 정수 배율(×2 미만은 도트가 너무 작아 가독성 저하)
const COLS = 40;
const ROWS = 30;
const WORLD_W = TILE * COLS;
const WORLD_H = TILE * ROWS;
const STEP_MS = 200;        // 타일 1칸 이동 시간
const TURN_MS = 90;         // 방향만 바꾸는 유예(이 안에 떼면 제자리에서 돌기만)
const WALK_MS = 110;        // 펫 걷기 프레임 교차 주기
// 캐릭터 보행 4프레임 사이클[l,n,r,n] 진행 주기. 100ms → 400ms/사이클 = 2타일 스텝(200ms×2)에
// 딱 맞물려, 한 칸에 "발 한 번" 리듬이 자연스럽게 난다.
const CHAR_ANIM_MS = 100;
const PET_IDLE_MS = 480;    // 펫 idle(통통/꼬리) 2프레임 교차 주기 — 걷기보다 느긋하게
const QUEST_RANGE = 64;     // 표지판 근접 반경(px)
const LABEL_DY = 18;        // 닉네임 라벨 세로 오프셋(px)

// 팔레트·픽셀맵(16×24 캐릭터·12×16 펫)·시간대 톤은 ./sprites.js로 추출했다
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

// 결정적(재로드해도 배치 동일) 유사난수 — 나무·장식 흩뿌리기용.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// 월드 타일 맵 생성: 'grass' | 'path' | 'water' | 'tree'. (물·나무는 충돌)
function buildMap() {
  const m = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const border = r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
      row.push(border ? 'water' : 'grass');
    }
    m.push(row);
  }
  for (let c = 1; c < COLS - 1; c++) { m[14][c] = 'path'; m[15][c] = 'path'; }
  for (let r = 1; r < ROWS - 1; r++) { m[r][19] = 'path'; m[r][20] = 'path'; }
  for (let r = 12; r <= 17; r++) for (let c = 16; c <= 23; c++) m[r][c] = 'path';
  for (let r = 4; r <= 6; r++) for (let c = 5; c <= 9; c++) m[r][c] = 'water';
  const rng = makeRng(0x5eed);
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (m[r][c] !== 'grass') continue;
      const nearSpawn = Math.abs(r - 15) <= 6 && Math.abs(c - 20) <= 6;
      if (nearSpawn) continue;
      if (rng() < 0.10) m[r][c] = 'tree';
    }
  }
  return m;
}

// controlsRef: GBC 셸(WorldPage)이 D-pad·A·B를 게임에 주입하는 최소 인터페이스.
//   셸 마운트 시 GameCanvas가 controlsRef.current = { press, release, interact, cancel }를 채운다.
//   press/release는 키보드와 동일 경로(씬 heldDirs)로 흘려보내 홀드 연속 이동까지 재사용한다.
//   버스는 오염시키지 않는다(순수 씬 메서드 호출).
export default function GameCanvas({ userId = null, nickname = '나', pet = { key: 'dog', emoji: '🐕', level: 1, mood: 'happy' }, controlsRef = null }) {
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);   // 활성 씬 — React가 입력 잠금을 갱신
  const nickRef = useRef(nickname);
  const petRef = useRef(pet);
  const [nearQuest, setNearQuest] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false); // 인게임 즉석 리뷰 오버레이
  const nearQuestRef = useRef(false);   // A(상호작용) 콜백이 최신 근접 상태를 읽도록 미러
  const reviewOpenRef = useRef(false);  // B(취소) 콜백이 최신 오버레이 상태를 읽도록 미러

  useEffect(() => { nickRef.current = nickname || '나'; }, [nickname]);
  useEffect(() => { petRef.current = pet || { key: 'dog', level: 1, mood: 'happy' }; }, [pet]);
  useEffect(() => { nearQuestRef.current = nearQuest; }, [nearQuest]);
  useEffect(() => { reviewOpenRef.current = reviewOpen; }, [reviewOpen]);

  // ── GBC 셸 입력 주입 인터페이스 등록 ──
  // press/release → 씬 heldDirs(키보드와 동일 경로). interact=A(표지판 말 걸기), cancel=B(리뷰 닫기).
  useEffect(() => {
    if (!controlsRef) return undefined;
    controlsRef.current = {
      press: (dir) => sceneRef.current?.extInputDown?.(dir),
      release: (dir) => sceneRef.current?.extInputUp?.(dir),
      interact: () => { if (!reviewOpenRef.current && nearQuestRef.current) setReviewOpen(true); },
      cancel: () => { if (reviewOpenRef.current) setReviewOpen(false); },
    };
    return () => { if (controlsRef) controlsRef.current = null; };
  }, [controlsRef]);

  // 리뷰 오버레이가 열리면 게임 입력을 잠근다(캔버스 이동 정지). 닫히면 해제.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.inputLocked = reviewOpen;
    if (reviewOpen) { if (scene.heldDirs) scene.heldDirs.length = 0; scene.tapTile = null; }
  }, [reviewOpen]);

  useEffect(() => {
    let destroyed = false;
    let game = null;
    let ro = null;    // 캔버스 정수 배율 피팅용 ResizeObserver
    let scene = null; // create()에서 자신을 할당 — 아래 버스 핸들러가 위임 대상으로 참조.

    // ── 버스 구독을 컴포넌트 스코프에서 등록/해제한다(리스너 누수 방지). ──
    // 기존엔 씬 'shutdown'에서 off 했지만 Phaser destroy 경로에서 shutdown이 안 뜰 수 있어,
    // 재방문마다 죽은 씬 콜백이 bus에 누적됐다. 이제 React cleanup이 off를 직접 보장한다.
    const onPeers = (data) => scene?.applyPeers(data);
    const onQuestScored = (data) => scene?.questScoredFx(data);
    const onQuestDone = (data) => scene?.questDoneFx(data);
    bus.on('peers:update', onPeers);
    bus.on('quest:scored', onQuestScored);
    bus.on('quest:done', onQuestDone);

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
          // 시간대(day/sunset/night)를 씬 생성 시 1회 확정하고, 팔레트를 그 톤으로 "구워"
          // 텍스처 자체에 GBC 감성을 입힌다(런타임 틴트 오버레이 대신 — 저채도·제한 색수 보존).
          this.mode = timeOfDay();
          this.pal = tonePalette(BASE_TILE_PAL, this.mode);
          this.charPal = {
            pc: tonePalette(CHAR_PAL_LOCAL, this.mode),
            pr: tonePalette(CHAR_PAL_REMOTE, this.mode),
          };
          this.petPal = {};
          for (const k of PET_KEYS) this.petPal[k] = tonePalette(PET_PAL[k], this.mode);

          this.buildGround();
          this.buildTree();
          this.buildDecor();
          this.buildSign();
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

        // 4방향 × 걷기 3패턴(n/l/r) 캐릭터, 16×24(우향은 side flipX).
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
        charTex(prefix, facing, moving, time) {
          const base = (facing === 'left' || facing === 'right') ? 'side' : facing;
          const pose = moving ? CHAR_WALK_CYCLE[Math.floor(time / CHAR_ANIM_MS) % CHAR_WALK_CYCLE.length] : 'n';
          return `${prefix}_${base}_${pose}`;
        }

        setCharFrame(sprite, prefix, facing, moving, time) {
          sprite.setTexture(this.charTex(prefix, facing, moving, time));
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

        create() {
          scene = this;              // 버스 핸들러 위임 대상
          sceneRef.current = this;   // React 입력 잠금 갱신용
          this.inputLocked = false;  // 리뷰 오버레이 중 이동 잠금
          this.petJumpVal = 0;       // 퀘스트 완료 점프 연출값(0→1→0)

          this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
          this.cameras.main.setBackgroundColor(toneColor(BASE_TILE_PAL.grass1, this.mode));
          this.cameras.main.setZoom(ZOOM);
          this.cameras.main.setRoundPixels(true);

          const map = buildMap();
          this.map = map;
          this.signTileX = 20; this.signTileY = 11;

          this.waterImgs = [];
          this.waterFrame = 0;
          this.flowerImgs = [];  // 꽃 흔들림 2프레임 스왑 대상
          this.bushImgs = [];    // 풀숲 살랑 2프레임 스왑 대상
          this.decorFrame = 0;

          // 지면 + 장식 + 나무 + 팻말.
          const decorRng = makeRng(0xace5);
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              const t = map[r][c];
              const cx = c * TILE + TILE / 2, cy = r * TILE + TILE / 2;
              const groundKey = t === 'water' ? 't_water0' : t === 'path' ? 't_path' : 't_grass';
              const img = this.add.image(cx, cy, groundKey).setScale(TSCALE).setDepth(0);
              if (t === 'water') this.waterImgs.push(img);
              if (t === 'tree') {
                // 밑에는 잔디, 위로 2타일 나무. 바닥이 base 타일 바닥에 닿도록 배치.
                this.add.image(cx, cy, 't_grass').setScale(TSCALE).setDepth(0);
                this.add.image(cx, (r + 1) * TILE, 't_tree').setOrigin(0.5, 1).setScale(TSCALE).setDepth((r + 1) * TILE);
              } else if (t === 'grass') {
                const roll = decorRng();
                if (roll < 0.04) this.flowerImgs.push(this.add.image(cx, cy, 't_flower0').setScale(TSCALE).setDepth(1));
                else if (roll < 0.065) this.bushImgs.push(this.add.image(cx, cy, 't_bush0').setScale(TSCALE).setDepth(cy - 4));
              }
            }
          }
          // 팻말 — 광장 상단.
          this.signX = this.signTileX * TILE + TILE / 2;
          this.signY = this.signTileY * TILE + TILE / 2;
          this.add.image(this.signX, this.signTileY * TILE + TILE, 't_sign').setOrigin(0.5, 1).setScale(TSCALE).setDepth(this.signY);

          // 밤이면 팻말 곁 랜턴 불빛 하나(포인트 광원). additive로 은은하게 번지게.
          if (this.mode === 'night') {
            this.add.image(this.signX + TILE, this.signY, 't_lamp')
              .setScale(TSCALE).setDepth(this.signY + 1).setBlendMode(Phaser.BlendModes.ADD);
          }

          // 물 애니메이션(3프레임 물결: 0→1→2→…).
          this.time.addEvent({
            delay: 520, loop: true, callback: () => {
              this.waterFrame = (this.waterFrame + 1) % 3;
              const key = `t_water${this.waterFrame}`;
              for (const w of this.waterImgs) w.setTexture(key);
            },
          });
          // 꽃·풀숲 흔들림(2프레임 교차, 물결과 다른 주기로 어긋나게).
          this.time.addEvent({
            delay: 620, loop: true, callback: () => {
              this.decorFrame ^= 1;
              for (const f of this.flowerImgs) f.setTexture(`t_flower${this.decorFrame}`);
              for (const b of this.bushImgs) b.setTexture(`t_bush${this.decorFrame}`);
            },
          });

          // ── 플레이어(그리드) — 광장 중앙 스폰 ──
          this.pTileX = 20; this.pTileY = 15;
          this.facing = 'down';
          this.moving = false;
          this.turnGrace = 0;
          const spawnX = this.pTileX * TILE + TILE / 2;
          const spawnY = this.pTileY * TILE + TILE / 2;
          // 16×24 스프라이트: 하단 16px(=타일)이 발, 상단 8px가 타일 위로. origin Y 보정으로 발을 타일에 정렬.
          this.player = this.add.image(spawnX, spawnY, 'pc_down_n').setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);

          this.nick = this.add.text(spawnX, spawnY + LABEL_DY, nickRef.current, this.labelStyle()).setOrigin(0.5, 0).setDepth(10000);

          // ── 펫(그리드 추적) ──
          this.petTargetX = this.pTileX - 1; this.petTargetY = this.pTileY;
          this.petPX = this.petTargetX * TILE + TILE / 2;
          this.petPY = this.petTargetY * TILE + TILE / 2;
          this.petFlip = false;
          this.pet = this.add.image(this.petPX, this.petPY, this.petTexKey(0)).setScale(TSCALE * this.petLevelScale());

          this.cameras.main.startFollow(this.player, true, 0.18, 0.18);

          // ── 입력: 방향키/WASD 스택(마지막 키 우선) + 탭-투-무브 ──
          this.heldDirs = [];
          this.tapTile = null;
          this.input.keyboard.on('keydown', (e) => {
            if (this.inputLocked) return; // 리뷰 오버레이 중 이동 잠금
            const d = keyToDir(e.key);
            if (!d) return;
            this.tapTile = null;
            if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
          });
          this.input.keyboard.on('keyup', (e) => {
            const d = keyToDir(e.key);
            if (d) this.heldDirs = this.heldDirs.filter((x) => x !== d);
          });
          this.input.on('pointerdown', (p) => {
            if (this.inputLocked) return; // 리뷰 오버레이 중 탭-이동 잠금
            this.tapTile = { x: Math.floor(p.worldX / TILE), y: Math.floor(p.worldY / TILE) };
            this.heldDirs.length = 0;
          });

          // ── 원격 플레이어(그리드 스텝 렌더) ──
          // 버스 구독('peers:update' 등)은 컴포넌트 스코프에서 등록됨 — 여기선 상태만 준비.
          this.peers = new Map(); // peerId -> { sprite, label, tileX, tileY, destTileX, destTileY, facing, moving }

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

        // 닉네임 나메플레이트 — GBC 다이얼로그 문법(크림 박스 + 잉크 모노스페이스, 하드 엣지).
        labelStyle() {
          return {
            fontFamily: 'monospace', fontSize: '10px', color: GBC.ink,
            backgroundColor: GBC.cream, padding: { x: 4, y: 2 },
            resolution: 3,
          };
        }

        petTexKey(frame) {
          const key = PET_KEYS.includes(petRef.current?.key) ? petRef.current.key : 'dog';
          return `pet_${key}_${frame}`;
        }

        petLevelScale() {
          const lv = petRef.current?.level || 1;
          return Math.min(1 + (lv - 1) * 0.06, 1.6);
        }

        // 타일 충돌 판정: 밖·물·나무·팻말 = 막힘.
        blocked(tx, ty) {
          if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
          const t = this.map[ty][tx];
          if (t === 'water' || t === 'tree') return true;
          if (tx === this.signTileX && ty === this.signTileY) return true;
          return false;
        }

        // 한 타일 이동 시작(플레이어).
        startStep(dir) {
          const [dx, dy] = DIRV[dir];
          const prevX = this.pTileX, prevY = this.pTileY;
          this.pTileX += dx; this.pTileY += dy;
          this.moving = true;
          const tx = this.pTileX * TILE + TILE / 2, ty = this.pTileY * TILE + TILE / 2;
          this.tweens.add({
            targets: this.player, x: tx, y: ty, duration: STEP_MS, ease: 'Linear',
            onComplete: () => { this.moving = false; this.petTargetX = prevX; this.petTargetY = prevY; },
          });
        }

        applyPeers(incoming) {
          const entries = incoming instanceof Map ? [...incoming.entries()] : Object.entries(incoming || {});
          const seen = new Set();
          for (const [id, st] of entries) {
            if (!st) continue;
            seen.add(id);
            const tileX = Math.floor(st.x / TILE);
            const tileY = Math.floor(st.y / TILE);
            let p = this.peers.get(id);
            if (!p) {
              const sx = tileX * TILE + TILE / 2, sy = tileY * TILE + TILE / 2;
              const sprite = this.add.image(sx, sy, 'pr_down_n').setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);
              const label = this.add.text(sx, sy + LABEL_DY, st.nick || '', this.labelStyle()).setOrigin(0.5, 0).setDepth(10000);
              p = { sprite, label, tileX, tileY, destTileX: tileX, destTileY: tileY, facing: 'down', moving: false };
              this.peers.set(id, p);
            }
            p.destTileX = tileX; p.destTileY = tileY;
            if (VALID_DIR.has(st.dir)) p.facing = st.dir;
            if (st.nick != null) p.label.setText(st.nick);
            // 너무 먼 순간이동은 스냅(길게 기어가지 않게).
            if (!p.moving && (Math.abs(tileX - p.tileX) + Math.abs(tileY - p.tileY)) > 8) {
              p.tileX = tileX; p.tileY = tileY;
              p.sprite.setPosition(tileX * TILE + TILE / 2, tileY * TILE + TILE / 2);
            }
          }
          for (const [id, p] of this.peers) {
            if (!seen.has(id)) { p.sprite.destroy(); p.label.destroy(); this.peers.delete(id); }
          }
        }

        emitDistances() {
          if (!this.player || this.peers.size === 0) return;
          const out = {};
          for (const [id, p] of this.peers) {
            out[id] = Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, p.sprite.x, p.sprite.y));
          }
          bus.emit('peers:dist', out);
        }

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

          this.setCharFrame(this.player, 'pc', this.facing, this.moving, time);
          this.player.setDepth(this.player.y);
          this.nick.setPosition(this.player.x, this.player.y + LABEL_DY);

          // ── 펫: 목표 타일 중심으로 수동 그리드 추적 + 뒤뚱/바운스 ──
          const petObj = petRef.current || {};
          const tgx = this.petTargetX * TILE + TILE / 2, tgy = this.petTargetY * TILE + TILE / 2;
          const pdx = tgx - this.petPX, pdy = tgy - this.petPY;
          const pdist = Math.hypot(pdx, pdy);
          const petMoving = pdist > 0.5;
          if (petMoving) {
            const stepPx = (TILE / STEP_MS) * delta;
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

          // ── 원격 플레이어: 목적 타일까지 축우선 그리드 스텝(동일 tween) ──
          for (const [, p] of this.peers) {
            if (!p.moving) {
              const dtx = p.destTileX - p.tileX, dty = p.destTileY - p.tileY;
              if (dtx || dty) {
                const d = Math.abs(dtx) >= Math.abs(dty)
                  ? (dtx > 0 ? 'right' : 'left')
                  : (dty > 0 ? 'down' : 'up');
                const [ddx, ddy] = DIRV[d];
                p.tileX += ddx; p.tileY += ddy; p.facing = d; p.moving = true;
                const tx = p.tileX * TILE + TILE / 2, ty = p.tileY * TILE + TILE / 2;
                this.tweens.add({
                  targets: p.sprite, x: tx, y: ty, duration: STEP_MS, ease: 'Linear',
                  onComplete: () => { p.moving = false; },
                });
              }
            }
            this.setCharFrame(p.sprite, 'pr', p.facing, p.moving, time);
            p.sprite.setDepth(p.sprite.y);
            p.label.setPosition(p.sprite.x, p.sprite.y + LABEL_DY);
          }

          // ── local:state — ~100ms 스로틀 (좌표는 예전과 동일 스케일의 월드 px) ──
          if (time - this.lastEmit > 100) {
            this.lastEmit = time;
            bus.emit('local:state', { x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.facing });
          }

          // 표지판 근접 → React 오버레이 토글.
          const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.signX, this.signY) < QUEST_RANGE;
          if (near !== this.wasNear) { this.wasNear = near; setNearQuest(near); }
        }
      }

      // Scale.NONE — Phaser 내부 드로잉 버퍼를 160×144로 고정하고, 화면 확대는 CSS로 직접 제어한다.
      // (Phaser의 FIT/RESIZE는 비정수 배율을 허용해 도트가 뭉개진다. 정수 배율만 보장하려면
      //  CSS width/height를 160·144의 정수배로 세팅하고 image-rendering:pixelated로 굽는 편이 견고하다.)
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        backgroundColor: '#7fb060',
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.NONE, width: VIEW_W, height: VIEW_H },
        scene: WorldScene,
      });
      gameRef.current = game;
      if (game.canvas) game.canvas.style.imageRendering = 'pixelated';

      // ── 정수 배율 피팅 — 컨테이너(셸 화면 영역)에 맞춰 ×floor(min(w/160,h/144)), 최소 ×2 ──
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
      if (ro) { ro.disconnect(); ro = null; }
      scene = null;
      sceneRef.current = null;
      if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0b0d08' }}>
      {/* 캔버스(160×144)를 정수 배율로 확대한 뒤 화면 영역 중앙에 배치. 도트는 pixelated로 보존. */}
      <div ref={hostRef} style={{
        width: '100%', height: '100%',
        display: 'grid', placeItems: 'center', imageRendering: 'pixelated',
      }} />

      {/* 조작 힌트 — GBC 다이얼로그 문법(크림 칩, 하드 엣지). */}
      <div style={{
        position: 'absolute', left: 6, bottom: 6, pointerEvents: 'none',
        fontFamily: GBC.font, fontSize: '0.6rem', color: GBC.ink,
        background: GBC.cream, border: `2px solid ${GBC.border}`,
        boxShadow: `inset 0 0 0 1px ${GBC.creamHi}`,
        padding: '3px 6px', borderRadius: 2, lineHeight: 1.35,
      }}>
        ✚ 이동 · Ⓐ 말 걸기 · Ⓑ 닫기
      </div>

      {/* 표지판 근접 → '말 걸기' 프롬프트. Phaser 내 DOM 금지 → React 오버레이. (오너 지시: 게임 내에서 진행) */}
      {nearQuest && !reviewOpen && (
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

      {/* 인게임 즉석 리뷰 — 캔버스 위 HTML, 열리면 게임 입력 잠금(useEffect). */}
      {reviewOpen && (
        <QuestReview userId={userId} onClose={() => setReviewOpen(false)} />
      )}
    </div>
  );
}
