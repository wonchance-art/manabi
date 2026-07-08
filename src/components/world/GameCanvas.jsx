'use client';

// 🌱 학습 월드 — Phaser 게임 캔버스 (솔로 코어).
// 외부 에셋 0 — 모든 타일/캐릭터는 Graphics.generateTexture 또는 이모지 텍스트로 즉석 생성.
// phaser는 무거우므로 이 파일은 next/dynamic(ssr:false)로만 로드된다(/world 라우트 전용 청크).
//
// 통합 계약은 ./bus.js 주석 참고:
//   emit 'local:state' {x,y,dir}  (~100ms) · on 'peers:update' (원격 렌더) · emit 'peers:dist' (500ms).
// 원격 플레이어 렌더를 미리 구현해 둠 — 솔로에선 아무도 'peers:update'를 emit하지 않아 무해.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import bus from './bus';

const TILE = 32;
const COLS = 40;
const ROWS = 30;
const WORLD_W = TILE * COLS;
const WORLD_H = TILE * ROWS;
const SPEED = 150;          // px/s
const QUEST_RANGE = 64;     // 표지판 근접 반경(px)

// 파스텔 톤 (0xRRGGBB)
const COLOR = {
  grass: 0xbfe3b5, grassDot: 0xa6d69b,
  path: 0xe9dcbb, pathDot: 0xd8c79a,
  water: 0xaed6f2, waterRipple: 0xcfe8f9,
  trunk: 0xc09a6b, canopy: 0x8ecb7c, canopyHi: 0xa9d996,
};

// 결정적(재로드해도 배치 동일) 유사난수 — 나무 흩뿌리기용.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// 8방향 문자열(원격 렌더가 참고 가능하도록 dir 동봉). 정지 시 null.
function dir8(vx, vy) {
  if (!vx && !vy) return null;
  const dirs = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  const idx = (Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8;
  return dirs[idx];
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
  // 십자 길
  for (let c = 1; c < COLS - 1; c++) { m[14][c] = 'path'; m[15][c] = 'path'; }
  for (let r = 1; r < ROWS - 1; r++) { m[r][19] = 'path'; m[r][20] = 'path'; }
  // 중앙 광장
  for (let r = 12; r <= 17; r++) for (let c = 16; c <= 23; c++) m[r][c] = 'path';
  // 연못
  for (let r = 4; r <= 6; r++) for (let c = 5; c <= 9; c++) m[r][c] = 'water';
  // 나무 흩뿌리기 (잔디 위에만, 스폰/표지판 근처는 비움)
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

export default function GameCanvas({ nickname = '나', pet = { emoji: '🐕', level: 1, mood: 'happy' } }) {
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  // 게임을 재생성하지 않고 최신 props를 씬이 읽도록 ref로 흘려보낸다.
  const nickRef = useRef(nickname);
  const petRef = useRef(pet);
  const [nearQuest, setNearQuest] = useState(false);

  useEffect(() => { nickRef.current = nickname || '나'; }, [nickname]);
  useEffect(() => { petRef.current = pet || { emoji: '🐕', level: 1, mood: 'happy' }; }, [pet]);

  useEffect(() => {
    let destroyed = false;
    let game = null;

    (async () => {
      const Phaser = (await import('phaser')).default;
      if (destroyed || !hostRef.current) return;

      // 씬을 이 클로저 안에서 정의 → React ref/setter를 직접 참조.
      class WorldScene extends Phaser.Scene {
        constructor() { super('world'); }

        preload() {
          this.makeTileTexture('t_grass', COLOR.grass, COLOR.grassDot);
          this.makeTileTexture('t_path', COLOR.path, COLOR.pathDot);
          this.makeWaterTexture();
          this.makeTreeTexture();
        }

        makeTileTexture(key, base, dot) {
          const g = this.make.graphics({ add: false });
          g.fillStyle(base, 1); g.fillRect(0, 0, TILE, TILE);
          g.fillStyle(dot, 0.5);
          g.fillRect(5, 6, 3, 3); g.fillRect(22, 12, 3, 3);
          g.fillRect(13, 23, 3, 3); g.fillRect(27, 25, 2, 2);
          g.generateTexture(key, TILE, TILE); g.destroy();
        }

        makeWaterTexture() {
          const g = this.make.graphics({ add: false });
          g.fillStyle(COLOR.water, 1); g.fillRect(0, 0, TILE, TILE);
          g.lineStyle(2, COLOR.waterRipple, 0.9);
          g.beginPath(); g.moveTo(4, 10); g.lineTo(14, 10); g.strokePath();
          g.beginPath(); g.moveTo(18, 22); g.lineTo(28, 22); g.strokePath();
          g.generateTexture('t_water', TILE, TILE); g.destroy();
        }

        makeTreeTexture() {
          const w = TILE, h = 40;
          const g = this.make.graphics({ add: false });
          g.fillStyle(COLOR.trunk, 1); g.fillRect(w / 2 - 3, h - 12, 6, 12);
          g.fillStyle(COLOR.canopy, 1); g.fillCircle(w / 2, 16, 14);
          g.fillStyle(COLOR.canopyHi, 1); g.fillCircle(w / 2 - 4, 12, 6);
          g.generateTexture('t_tree', w, h); g.destroy();
        }

        create() {
          this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
          this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
          this.cameras.main.setBackgroundColor('#bfe3b5');

          const map = buildMap();
          const walls = this.physics.add.staticGroup();

          // 지면 + 충돌체
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              const t = map[r][c];
              const x = c * TILE, y = r * TILE;
              const cx = x + TILE / 2, cy = y + TILE / 2;
              // 나무 밑에도 잔디 지면을 깐다.
              const groundKey = t === 'water' ? 't_water' : t === 'path' ? 't_path' : 't_grass';
              this.add.image(cx, cy, groundKey).setDepth(0);
              if (t === 'tree') {
                this.add.image(cx, cy - 4, 't_tree').setDepth(cy); // y-정렬로 앞/뒤 통과
              }
              if (t === 'water' || t === 'tree') {
                const box = this.add.rectangle(cx, cy, TILE, TILE); // 투명 충돌체
                walls.add(box);
              }
            }
          }

          // 표지판(퀘스트 오브젝트) — 광장 상단 길 위.
          this.signX = 20 * TILE + TILE / 2;
          this.signY = 11 * TILE + TILE / 2;
          this.add.text(this.signX, this.signY, '📮', { fontSize: '30px' }).setOrigin(0.5).setDepth(this.signY);

          // 플레이어(이모지) — 광장 중앙 스폰.
          const spawnX = 20 * TILE + TILE / 2;
          const spawnY = 15 * TILE + TILE / 2;
          this.player = this.add.text(spawnX, spawnY, '🙂', { fontSize: '28px' }).setOrigin(0.5);
          this.physics.add.existing(this.player);
          this.player.body.setSize(22, 22).setOffset(-11, -6);
          this.player.body.setCollideWorldBounds(true);
          this.physics.add.collider(this.player, walls);

          this.nick = this.add.text(spawnX, spawnY + 18, nickRef.current, {
            fontSize: '12px', color: '#2b2b2b',
            backgroundColor: 'rgba(255,255,255,0.75)', padding: { x: 4, y: 1 },
          }).setOrigin(0.5, 0).setDepth(10000);

          // 펫 — 1타일 뒤를 지연 추적.
          this.pet = this.add.text(spawnX - TILE, spawnY, petRef.current.emoji, { fontSize: '22px' }).setOrigin(0.5);
          this.trail = [];               // 플레이어 자취(브레드크럼)
          this.petBounce = 0;

          this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

          // 입력 — 방향키 + WASD + 탭-투-무브.
          this.cursors = this.input.keyboard.createCursorKeys();
          this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' });
          this.tapTarget = null;
          this.input.on('pointerdown', (p) => { this.tapTarget = { x: p.worldX, y: p.worldY }; });

          // ── 원격 플레이어(다음 웨이브) ──
          this.peers = new Map(); // peerId -> { txt, label, tx, ty }
          this.onPeers = (incoming) => this.applyPeers(incoming);
          bus.on('peers:update', this.onPeers);

          // local:state 스로틀 + peers:dist 주기 emit.
          this.lastEmit = 0;
          this.lastDir = 's';
          this.time.addEvent({ delay: 500, loop: true, callback: () => this.emitDistances() });

          // 하트 이펙트(기분: happy) — 씬이 최신 mood를 매번 확인.
          this.time.addEvent({
            delay: 2600, loop: true, callback: () => {
              const mood = petRef.current?.mood;
              if (mood === 'happy' || mood === 'excited') this.spawnHeart();
            },
          });

          this.wasNear = false;

          // 정리 — game.destroy → 씬 shutdown에서 버스/구독 해제.
          this.events.once('shutdown', () => {
            bus.off('peers:update', this.onPeers);
            this.peers.clear();
          });
        }

        applyPeers(incoming) {
          const entries = incoming instanceof Map ? [...incoming.entries()] : Object.entries(incoming || {});
          const seen = new Set();
          for (const [id, st] of entries) {
            if (!st) continue;
            seen.add(id);
            let p = this.peers.get(id);
            if (!p) {
              const txt = this.add.text(st.x, st.y, st.emoji || '🙂', { fontSize: '28px' }).setOrigin(0.5);
              const label = this.add.text(st.x, st.y + 18, st.nick || '', {
                fontSize: '12px', color: '#2b2b2b',
                backgroundColor: 'rgba(255,255,255,0.75)', padding: { x: 4, y: 1 },
              }).setOrigin(0.5, 0).setDepth(10000);
              p = { txt, label, tx: st.x, ty: st.y };
              this.peers.set(id, p);
            }
            p.tx = st.x; p.ty = st.y;
            if (st.emoji) p.txt.setText(st.emoji);
            if (st.nick != null) p.label.setText(st.nick);
          }
          // 이탈 정리
          for (const [id, p] of this.peers) {
            if (!seen.has(id)) { p.txt.destroy(); p.label.destroy(); this.peers.delete(id); }
          }
        }

        emitDistances() {
          if (!this.player || this.peers.size === 0) return;
          const out = {};
          for (const [id, p] of this.peers) {
            out[id] = Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, p.txt.x, p.txt.y));
          }
          bus.emit('peers:dist', out);
        }

        spawnHeart() {
          if (!this.pet) return;
          const h = this.add.text(this.pet.x, this.pet.y - 14, '💗', { fontSize: '16px' }).setOrigin(0.5).setDepth(10001);
          this.tweens.add({ targets: h, y: h.y - 26, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
        }

        update(time, delta) {
          const body = this.player.body;
          const c = this.cursors, w = this.wasd;
          let vx = 0, vy = 0;
          if (c.left.isDown || w.left.isDown) vx -= 1;
          if (c.right.isDown || w.right.isDown) vx += 1;
          if (c.up.isDown || w.up.isDown) vy -= 1;
          if (c.down.isDown || w.down.isDown) vy += 1;

          if (vx || vy) {
            this.tapTarget = null;                 // 키 입력이 탭 목표를 취소
            const len = Math.hypot(vx, vy);
            body.setVelocity((vx / len) * SPEED, (vy / len) * SPEED);
          } else if (this.tapTarget) {
            const dx = this.tapTarget.x - this.player.x, dy = this.tapTarget.y - this.player.y;
            const d = Math.hypot(dx, dy);
            if (d < 4) { body.setVelocity(0, 0); this.tapTarget = null; }
            else { body.setVelocity((dx / d) * SPEED, (dy / d) * SPEED); vx = dx; vy = dy; }
          } else {
            body.setVelocity(0, 0);
          }

          const dir = dir8(body.velocity.x, body.velocity.y);
          if (dir) this.lastDir = dir;

          // 라벨·깊이 정렬
          this.player.setDepth(this.player.y);
          this.nick.setPosition(this.player.x, this.player.y + 18);

          // 펫 지연 추적 — 자취 버퍼의 오래된 지점을 목표로 부드럽게 보간.
          this.trail.push({ x: this.player.x, y: this.player.y });
          if (this.trail.length > 12) this.trail.shift();
          const target = this.trail[0];
          const petObj = petRef.current || {};
          this.pet.setText(petObj.emoji || '🐕');
          this.pet.setScale(Math.min(1 + ((petObj.level || 1) - 1) * 0.06, 1.6)); // 레벨↑ = 살짝 커짐
          this.pet.x = Phaser.Math.Linear(this.pet.x, target.x, 0.12);
          let petBaseY = Phaser.Math.Linear(this.pet.y, target.y, 0.12);
          if (petObj.mood === 'happy' || petObj.mood === 'excited') {  // 기분 좋으면 살짝 바운스
            this.petBounce += delta / 1000;
            petBaseY -= Math.abs(Math.sin(this.petBounce * 6)) * 4;
          }
          this.pet.y = petBaseY;
          this.pet.setDepth(this.pet.y);

          // 원격 플레이어 보간
          for (const [, p] of this.peers) {
            p.txt.x = Phaser.Math.Linear(p.txt.x, p.tx, 0.15);
            p.txt.y = Phaser.Math.Linear(p.txt.y, p.ty, 0.15);
            p.txt.setDepth(p.txt.y);
            p.label.setPosition(p.txt.x, p.txt.y + 18);
          }

          // local:state — ~100ms 스로틀
          if (time - this.lastEmit > 100) {
            this.lastEmit = time;
            bus.emit('local:state', { x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.lastDir });
          }

          // 표지판 근접 → React 오버레이 토글 (경계 넘을 때만)
          const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.signX, this.signY) < QUEST_RANGE;
          if (near !== this.wasNear) { this.wasNear = near; setNearQuest(near); }
        }
      }

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        backgroundColor: '#bfe3b5',
        physics: { default: 'arcade', arcade: { debug: false } },
        scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
        scene: WorldScene,
      });
      gameRef.current = game;
      if (destroyed) { game.destroy(true); gameRef.current = null; }
    })();

    return () => {
      destroyed = true;
      if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 12 }}>
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />

      {/* 조작 힌트 — 게임 밖 HTML 오버레이 */}
      <div style={{
        position: 'absolute', left: 10, bottom: 10, pointerEvents: 'none',
        fontSize: '0.72rem', color: '#fff', background: 'rgba(0,0,0,0.35)',
        padding: '4px 8px', borderRadius: 8, lineHeight: 1.4,
      }}>
        방향키 · WASD · 화면 탭으로 이동
      </div>

      {/* 퀘스트 말풍선 — 근접 시 표시. Phaser 내 DOM 금지 → React 오버레이로 처리. */}
      {nearQuest && (
        <div style={{
          position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)',
          maxWidth: 'min(88%, 420px)', background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border, rgba(0,0,0,0.12))', borderRadius: 14,
          boxShadow: '0 8px 28px rgba(0,0,0,0.22)', padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center',
        }}>
          <span style={{ fontSize: '0.92rem', color: 'var(--text-primary, #222)', lineHeight: 1.55 }}>
            📮 오늘의 학습을 마치면 펫이 자라요
          </span>
          <Link href="/study" className="btn btn--primary btn--sm" style={{ alignSelf: 'center' }}>
            학습하러 가기
          </Link>
        </div>
      )}
    </div>
  );
}
