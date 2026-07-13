// ✈️ 학습 월드 — "하네다 공항" 스토리 씬 (독해 글 1의 무대).
//
// 아키텍처 결정(근거): **같은 Phaser 게임 내 씬 전환**을 택했다(맵 스왑 대신).
//   · 광장(WorldScene)은 넷코드·근접 음성·peers 렌더가 얽힌 자유 로밍 씬이고,
//     공항은 1인 선형 스토리(줄→심사대→문답→통과)라 성격이 정반대다. 두 관심사를
//     한 씬의 region 스왑으로 섞으면 광장 create()의 검증된 배선을 건드려 회귀 위험이 크다.
//   · Phaser SceneManager는 텍스처(TextureManager)를 게임 전역으로 공유하므로 씬 전환은
//     가볍고, 광장 코드에는 게이트 상호작용 → this.scene.start('airport') 한 줄만 더한다.
//   · 좌표 스케일·뷰포트(320×288 백킹, zoom 1, 1타일=32px)는 광장과 완전히 동일하게 유지.
//
// 외부 에셋 0 — 바닥/카운터/게이트/캐릭터는 전부 절차 픽셀맵을 generateTexture로 굽는다.
// sprites.js의 캐릭터·펫 픽셀맵을 재사용하고, 심사관 제복은 팔레트 스왑(sprites.js 무수정 —
// 신규 팔레트는 이 파일 로컬).

import {
  CHAR_W, CHAR_H, CHAR_ORIGIN_Y, PET_W, PET_H,
  CHAR_DIRS, CHAR_POSES, CHAR_WALK_CYCLE, charFrameRows,
  PET_KEYS, petFrameRows,
  CHAR_PAL_LOCAL, CHAR_PAL_REMOTE, PET_PAL,
  tonePalette, toneColor, timeOfDay,
  applyPeersToScene, updateScenePeers, peerLabelStyle, emitPeerDistances,
} from './sprites';
import { GBC } from './QuestReview';
import bus from './bus';

// ── 좌표 스케일 (광장과 동일 불변) ──
const TILE = 32;
const TEX = 16;
const TSCALE = TILE / TEX;   // = 2
const ZOOM = 1;
const STEP_MS = 200;
const TURN_MS = 90;
const CHAR_ANIM_MS = 100;
const WALK_MS = 110;
const PET_IDLE_MS = 480;
const LABEL_DY = 18;

// 공항 인테리어 미니맵 규격.
const COLS = 15;
const ROWS = 13;

// 심사관 제복 팔레트(로컬 캐릭터에서 셔츠 B·캡 H만 감청색 제복으로 스왑) — sprites.js 무수정용 로컬.
const CHAR_PAL_OFFICER = { ...CHAR_PAL_LOCAL, B: 0x2f3a6b, H: 0x1c2340 };
// 아버지(동행) — 로컬에서 셔츠만 차분한 카키로.
const CHAR_PAL_DAD = { ...CHAR_PAL_LOCAL, B: 0x7a6a3a, H: 0x4a3a24 };

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

/**
 * 공항 씬 클래스를 빌드한다(Phaser는 동적 import라 팩토리로 주입).
 * ctx: { notifyPhase(phase), petRef, nickRef, bindScene(scene|null), onReady?() }
 *   · notifyPhase: 씬 → React (walking→arrived 등 스토리 페이즈 전달)
 *   · bindScene  : 씬 → React (sceneRef.current 갱신, 입력 잠금·명령 위임 대상)
 *   · petRef/nickRef: 플레이어 펫/닉네임(광장과 동일 소스)
 */
export function buildAirportScene(Phaser, ctx) {
  return class AirportScene extends Phaser.Scene {
    constructor() { super('airport'); }

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
      const g = this.make.graphics({ add: false });
      this.drawMap(g, rows, pal);
      g.generateTexture(key, w, h); g.destroy();
    }

    preload() {
      this.mode = timeOfDay();
      const T = (hex) => toneColor(hex, this.mode);

      // ── 바닥(체커 타일) ──
      {
        const g = this.make.graphics({ add: false });
        g.fillStyle(T(0xd9d2c4), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(T(0xc9bfa8), 1);
        g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);      // 체커
        g.fillStyle(T(0xb8ad93), 0.5);
        g.fillRect(0, TEX - 1, TEX, 1); g.fillRect(TEX - 1, 0, 1, TEX); // 타일 이음새
        g.generateTexture('ax_floor', TEX, TEX); g.destroy();
      }
      // ── 벽 ──
      {
        const g = this.make.graphics({ add: false });
        g.fillStyle(T(0x6b7280), 1); g.fillRect(0, 0, TEX, TEX);
        g.fillStyle(T(0x565c68), 1); g.fillRect(0, 10, TEX, 6);
        g.fillStyle(T(0x818897), 1); g.fillRect(0, 0, TEX, 2);
        g.generateTexture('ax_wall', TEX, TEX); g.destroy();
      }
      // ── 입국심사 카운터(상판 + 앞면 패널) ──
      {
        const g = this.make.graphics({ add: false });
        g.fillStyle(T(0x8a5a2b), 1); g.fillRect(0, 0, TEX, TEX);       // 목재 몸통
        g.fillStyle(T(0xb07a3e), 1); g.fillRect(0, 0, TEX, 5);        // 상판 하이라이트
        g.fillStyle(T(0x5f3d1c), 1); g.fillRect(0, 5, TEX, 1);
        g.fillStyle(T(0x704a22), 1); g.fillRect(2, 8, 5, 6); g.fillRect(9, 8, 5, 6); // 패널 분할
        g.generateTexture('ax_counter', TEX, TEX); g.destroy();
      }
      // ── 출구 게이트(잠김: 적색 램프 / 열림: 녹색) — 16×20 세로 표식 ──
      const gate = (key, lamp) => {
        const g = this.make.graphics({ add: false });
        g.fillStyle(T(0x3a3f4a), 1); g.fillRect(1, 2, 14, 16);        // 프레임
        g.fillStyle(T(0x2a2e37), 1); g.fillRect(3, 4, 10, 12);        // 문
        g.fillStyle(T(lamp), 1); g.fillCircle(8, 6, 2);               // 상태 램프
        g.fillStyle(T(0xd9d2c4), 1); g.fillRect(5, 10, 6, 1); g.fillRect(5, 12, 4, 1); // EXIT 힌트
        g.generateTexture(key, TEX, 20); g.destroy();
      };
      gate('ax_gate_locked', 0xd14b38);
      gate('ax_gate_open', 0x5f9a46);

      // ── 하트(펫 기분/완료 연출) ──
      {
        const g = this.make.graphics({ add: false });
        g.fillStyle(T(0xe0556a), 1);
        g.fillRect(1, 1, 2, 2); g.fillRect(5, 1, 2, 2);
        g.fillRect(0, 2, 8, 2); g.fillRect(1, 4, 6, 1); g.fillRect(2, 5, 4, 1); g.fillRect(3, 6, 2, 1);
        g.fillStyle(T(0xf59caa), 1); g.fillRect(1, 2, 1, 1);
        g.generateTexture('ax_heart', 8, 7); g.destroy();
      }

      // ── 캐릭터 3종(플레이어/심사관/아버지) + 원격 피어(ax_pr) — 시간대 톤 팔레트로 굽는다 ──
      this.bakeCharSet('ax_pc', tonePalette(CHAR_PAL_LOCAL, this.mode));
      this.bakeCharSet('ax_officer', tonePalette(CHAR_PAL_OFFICER, this.mode));
      this.bakeCharSet('ax_dad', tonePalette(CHAR_PAL_DAD, this.mode));
      // 공항에서도 다른 접속자(공항 씬 피어)를 렌더한다 — 원격 셔츠색(파랑) 세트.
      this.bakeCharSet('ax_pr', tonePalette(CHAR_PAL_REMOTE, this.mode));

      // ── 펫(5종 × 2프레임) ──
      for (const k of PET_KEYS) {
        const pal = tonePalette(PET_PAL[k], this.mode);
        this.makeTex(`ax_pet_${k}_0`, petFrameRows(k, 0), pal, PET_W, PET_H);
        this.makeTex(`ax_pet_${k}_1`, petFrameRows(k, 1), pal, PET_W, PET_H);
      }
    }

    bakeCharSet(prefix, pal) {
      for (const dir of CHAR_DIRS)
        for (const pose of CHAR_POSES)
          this.makeTex(`${prefix}_${dir}_${pose}`, charFrameRows(dir, pose), pal, CHAR_W, CHAR_H);
    }

    charTex(prefix, facing, moving, time) {
      const base = (facing === 'left' || facing === 'right') ? 'side' : facing;
      const pose = moving ? CHAR_WALK_CYCLE[Math.floor(time / CHAR_ANIM_MS) % CHAR_WALK_CYCLE.length] : 'n';
      return `${prefix}_${base}_${pose}`;
    }
    setCharFrame(sprite, prefix, facing, moving, time) {
      sprite.setTexture(this.charTex(prefix, facing, moving, time));
      sprite.setFlipX(facing === 'right');
    }

    // ── 인테리어 타일맵 ──
    // 'wall'·'floor'·'counter'·'gate'(하단 출구). 심사관/아버지는 별도 스프라이트(타일 점유).
    buildMap() {
      const m = [];
      for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
          const border = r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
          row.push(border ? 'wall' : 'floor');
        }
        m.push(row);
      }
      for (let c = 5; c <= 9; c++) m[4][c] = 'counter';   // 심사대
      m[ROWS - 1][7] = 'gate';                            // 하단 출구 게이트
      return m;
    }

    create() {
      ctx.bindScene(this);
      this.inputLocked = false;
      this.exitOpen = false;
      this.petJumpVal = 0;

      const map = this.buildMap();
      this.map = map;

      this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
      this.cameras.main.setBackgroundColor(toneColor(0xcabfa8, this.mode));
      this.cameras.main.setZoom(ZOOM);
      this.cameras.main.setRoundPixels(true);

      // 바닥/벽/카운터.
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const t = map[r][c];
          const cx = c * TILE + TILE / 2, cy = r * TILE + TILE / 2;
          // 게이트 칸도 바닥을 먼저 깔고 위에 게이트 표식을 얹는다.
          const key = t === 'wall' ? 'ax_wall' : t === 'counter' ? 'ax_counter' : 'ax_floor';
          this.add.image(cx, cy, key).setScale(TSCALE).setDepth(t === 'counter' ? cy : 0);
        }
      }

      // 출구 게이트(잠김) — 하단.
      this.gateTileX = 7; this.gateTileY = ROWS - 1;
      this.gateX = this.gateTileX * TILE + TILE / 2;
      this.gateY = this.gateTileY * TILE + TILE / 2;
      this.gate = this.add.image(this.gateX, this.gateTileY * TILE + TILE, 'ax_gate_locked')
        .setOrigin(0.5, 1).setScale(TSCALE).setDepth(this.gateY + 2);

      // 심사관(카운터 뒤, 아래를 향함) — 대사 시 플레이어를 바라본다.
      this.officerTileX = 7; this.officerTileY = 3;
      this.officerFacing = 'down';
      this.officer = this.add.image(
        this.officerTileX * TILE + TILE / 2, this.officerTileY * TILE + TILE / 2,
        'ax_officer_down_n',
      ).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);
      this.add.text(this.officer.x, this.officer.y + LABEL_DY, '심사관', this.labelStyle())
        .setOrigin(0.5, 0).setDepth(10000);

      // ── 플레이어(줄 끝에서 시작) — 위를 향해 심사대로 걸어간다 ──
      this.pTileX = 7; this.pTileY = 10;
      this.facing = 'up'; this.moving = false; this.turnGrace = 0;
      const sx = this.pTileX * TILE + TILE / 2, sy = this.pTileY * TILE + TILE / 2;
      // 16×16 스프라이트(한 칸): origin 0.5로 타일 중심에 정렬. 플레이어 닉네임 라벨은 없다(깨끗한 화면).
      this.player = this.add.image(sx, sy, 'ax_pc_up_n').setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);

      // 아버지(민준 옆 동행, 정지).
      this.dadTileX = 6; this.dadTileY = 10;
      this.dad = this.add.image(
        this.dadTileX * TILE + TILE / 2, this.dadTileY * TILE + TILE / 2, 'ax_dad_up_n',
      ).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(TSCALE);
      this.add.text(this.dad.x, this.dad.y + LABEL_DY, '아버지', this.labelStyle())
        .setOrigin(0.5, 0).setDepth(10000);

      // 펫(플레이어 추적).
      this.petTargetX = this.pTileX + 1; this.petTargetY = this.pTileY;
      this.petPX = this.petTargetX * TILE + TILE / 2;
      this.petPY = this.petTargetY * TILE + TILE / 2;
      this.petFlip = false;
      this.pet = this.add.image(this.petPX, this.petPY, this.petTexKey(0)).setScale(TSCALE * this.petLevelScale());

      this.cameras.main.startFollow(this.player, true, 0.18, 0.18);

      // 심사대 앞 도착 판정 타일(카운터 바로 아래 칸).
      this.arriveTileX = 7; this.arriveTileY = 5;
      this.arrived = false;

      // 입력(광장과 동일 경로 — heldDirs 스택 + 탭 이동).
      this.heldDirs = [];
      this.tapTile = null;
      this.input.keyboard.on('keydown', (e) => {
        if (this.inputLocked) return;
        const d = keyToDir(e.key); if (!d) return;
        this.tapTile = null;
        if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
      });
      this.input.keyboard.on('keyup', (e) => {
        const d = keyToDir(e.key); if (d) this.heldDirs = this.heldDirs.filter((x) => x !== d);
      });
      this.input.on('pointerdown', (p) => {
        if (this.inputLocked) return;
        this.tapTile = { x: Math.floor(p.worldX / TILE), y: Math.floor(p.worldY / TILE) };
        this.heldDirs.length = 0;
      });

      // ── 원격 피어(공항 씬 공유) ── 광장과 동일 렌더·닉네임 라벨을 공용 헬퍼로 재사용한다.
      //   'peers:update'(GameCanvas 버스 위임)에서 scene==='airport' 인 피어만 이 씬에 표시한다.
      this.peers = new Map();
      this.lastEmit = 0;
      this.lastDistEmit = 0;   // 근접 음성 거리 emit 스로틀(광장 500ms 타이머와 동일 주기)
      // 도트 닉네임 폰트(Galmuri9) 로드 상태 — 미로드 시 모노 폴백, 로드 완료 시 라벨을 다시 굽는다.
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
      });

      // 씬 진입 → 걷기 페이즈.
      ctx.notifyPhase('walking');

      // create 말미 — 피어 스냅샷 재적용 + 전체 키 거리 1회 emit(씬 전환 음성 잔류 차단, Codex P1-2).
      ctx.onReady?.();
    }

    // 'peers:update' 위임 — 공항 씬 피어만(scene==='airport') 렌더(광장 피어는 필터로 제외).
    applyPeers(incoming) {
      applyPeersToScene(this, incoming, { charPrefix: 'ax_pr', sceneName: 'airport' });
    }
    // 폰트 로드 완료 후 라벨을 Galmuri9 로 다시 굽는다(폴백 → 도트 교체).
    refreshPeerLabels() {
      for (const [, p] of this.peers) p.label?.setStyle(peerLabelStyle(this.fontReady));
    }

    labelStyle() {
      return {
        fontFamily: 'monospace', fontSize: '10px', color: GBC.ink,
        backgroundColor: GBC.cream, padding: { x: 4, y: 2 }, resolution: 1,
      };
    }

    petTexKey(frame) {
      const key = PET_KEYS.includes(ctx.petRef?.current?.key) ? ctx.petRef.current.key : 'dog';
      return `ax_pet_${key}_${frame}`;
    }
    petLevelScale() {
      const lv = ctx.petRef?.current?.level || 1;
      return Math.min(1 + (lv - 1) * 0.06, 1.6);
    }

    blocked(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
      const t = this.map[ty][tx];
      if (t === 'wall' || t === 'counter') return true;
      if (t === 'gate') return !this.exitOpen;              // 잠긴 게이트만 막힘
      if (tx === this.officerTileX && ty === this.officerTileY) return true;
      if (tx === this.dadTileX && ty === this.dadTileY) return true;
      return false;
    }

    startStep(dir) {
      const [dx, dy] = DIRV[dir];
      const prevX = this.pTileX, prevY = this.pTileY;
      this.pTileX += dx; this.pTileY += dy;
      this.moving = true;
      const tx = this.pTileX * TILE + TILE / 2, ty = this.pTileY * TILE + TILE / 2;
      this.tweens.add({
        targets: this.player, x: tx, y: ty, duration: STEP_MS, ease: 'Linear',
        onComplete: () => {
          this.moving = false; this.petTargetX = prevX; this.petTargetY = prevY;
          this.onStepDone();
        },
      });
    }

    // 스텝 완료마다 도착/출구 판정.
    onStepDone() {
      if (!this.arrived && this.pTileX === this.arriveTileX && this.pTileY === this.arriveTileY) {
        this.arrived = true;
        this.inputLocked = true;
        this.heldDirs.length = 0; this.tapTile = null;
        this.faceForDialogue();
        ctx.notifyPhase('arrived');   // React가 텍스트박스 시퀀스를 연다
      }
      if (this.exitOpen && this.pTileX === this.gateTileX && this.pTileY === this.gateTileY) {
        this.returnPlaza();
      }
    }

    tapStepDir() {
      if (!this.tapTile) return null;
      if (this.tapTile.x === this.pTileX && this.tapTile.y === this.pTileY) { this.tapTile = null; return null; }
      if (this.tapTile.x !== this.pTileX) return this.tapTile.x > this.pTileX ? 'right' : 'left';
      if (this.tapTile.y !== this.pTileY) return this.tapTile.y > this.pTileY ? 'down' : 'up';
      return null;
    }

    // ── 외부(GBC 셸·키보드) 입력 주입 — 광장과 동일 인터페이스 ──
    extInputDown(d) {
      if (this.inputLocked || !VALID_DIR.has(d)) return;
      this.tapTile = null;
      if (!this.heldDirs.includes(d)) this.heldDirs.push(d);
    }
    extInputUp(d) { this.heldDirs = this.heldDirs.filter((x) => x !== d); }

    // ── React가 부르는 스토리 연출 명령 ──
    faceForDialogue() {
      this.facing = 'up';
      this.officerFacing = 'down';
      this.officer.setTexture('ax_officer_down_n').setFlipX(false);
    }
    stampShake() { this.cameras.main.shake(180, 0.004); }   // 도장 장면 — 가벼운 흔들림(파티클 없음)
    openExit() {
      if (this.exitOpen) return;
      this.exitOpen = true;
      this.gate.setTexture('ax_gate_open');
      this.map[this.gateTileY][this.gateTileX] = 'gate';    // 유지(blocked가 exitOpen로 통과 허용)
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 130, () => this.spawnHeart());
    }
    // 대사·문답이 끝나 다시 걸을 수 있게(출구로 이동).
    unlockWalk() { this.inputLocked = false; }

    returnPlaza() { this.scene.start('world'); }

    // 버스 연출(광장과 동일 시그니처 — quest:scored/done 재사용).
    questScoredFx({ correct } = {}) { if (correct) this.spawnHeart(); }
    questDoneFx() {
      this.tweens.add({ targets: this, petJumpVal: 1, duration: 220, ease: 'Quad.easeOut', yoyo: true, repeat: 1 });
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 120, () => this.spawnHeart());
    }
    spawnHeart() {
      if (!this.pet) return;
      const h = this.add.image(this.pet.x, this.pet.y - 12, 'ax_heart').setScale(TSCALE).setDepth(10001);
      this.tweens.add({ targets: h, y: h.y - 26, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
    }

    update(time, delta) {
      // 플레이어 이동 상태기계(광장과 동일).
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

      this.setCharFrame(this.player, 'ax_pc', this.facing, this.moving, time);
      this.player.setDepth(this.player.y);
      this.setCharFrame(this.officer, 'ax_officer', this.officerFacing, false, time);
      this.officer.setDepth(this.officer.y);
      this.dad.setDepth(this.dad.y);

      // 펫 추적(광장과 동일 로직 축약).
      const petObj = ctx.petRef?.current || {};
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
      const petFrameMs = petMoving ? WALK_MS : PET_IDLE_MS;
      this.pet.setTexture(this.petTexKey(Math.floor(time / petFrameMs) % 2));
      this.pet.setScale(TSCALE * this.petLevelScale());
      this.pet.setFlipX(this.petFlip);
      let petRenderY = this.petPY;
      if (petObj.mood === 'happy' || petObj.mood === 'excited') petRenderY -= Math.abs(Math.sin(time / 1000 * 6)) * 4;
      petRenderY -= (this.petJumpVal || 0) * 18;
      this.pet.setPosition(Math.round(this.petPX), Math.round(petRenderY));
      this.pet.setDepth(this.petPY);

      // ── 원격 피어(공항 씬) 갱신 — 그리드 스텝 + 닉네임 라벨 추적(공용 헬퍼). ──
      updateScenePeers(this, time, { charPrefix: 'ax_pr' });

      // ── 근접 음성 거리 emit — 공용 헬퍼(같은 씬=공항 실거리 · 다른 씬=광장 Infinity), 500ms 스로틀. ──
      // 광장 WorldScene 은 타이머로 이 emit 을 돌리지만, 공항은 자체 update() 에서 스로틀로 돌린다.
      // 이로써 공항 이동 후 ① 광장 피어의 stale 거리로 음성이 유지되지 않고 ② 공항 피어가 음성에 편입된다.
      if (time - this.lastDistEmit > 500) {
        this.lastDistEmit = time;
        emitPeerDistances(this, bus);
      }

      // ── local:state — ~100ms 스로틀. scene:'airport' + 공항 좌표계로 실어 보낸다. ──
      // WorldPage 가 net.sendState 로 중계하면 다른 공항 접속자의 applyPeers(airport 필터)가 렌더하고,
      // 광장 접속자는 scene 필터로 걸러낸다(하위호환).
      // ── persistable 계약(session.js isPersistablePosition 참고) ──
      //   공항 좌표는 항상 persistable:false — 영속 스폰 원천에서 제외한다. 공항 진입 직전의
      //   플라자 좌표(게이트 앞)가 이미 저장돼 있어, 재접속 시 거기서 스폰되는 게 자연스럽다.
      if (time - this.lastEmit > 100) {
        this.lastEmit = time;
        bus.emit('local:state', {
          x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.facing,
          scene: 'airport', persistable: false,
        });
      }
    }
  };
}
