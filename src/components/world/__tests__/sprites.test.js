import { describe, it, expect } from 'vitest';
import {
  CHAR_W, CHAR_H, CHAR_ORIGIN_Y, CHAR_TILE_PX, PET_W, PET_H,
  CHAR_DIRS, CHAR_POSES, CHAR_WALK_CYCLE, charFrameRows,
  PET_KEYS, petFrameRows, CHAR_PAL_LOCAL, CHAR_PAL_REMOTE, PET_PAL,
  BASE_TILE_PAL, tonePalette, toneColor, timeOfDay, TONE_MODES,
  riverStreamRects, RIVER_N, RIVER_E, RIVER_S, RIVER_W,
  emitPeerDistances,
  NPC_KEYS, NPC_W, NPC_H, NPC_PAL, npcMarkerRows,
  GOURMET_PAL, gourmetMarkerRows,
  ensureAvatarCharSet,
} from '../sprites.js';
import { avatarPalette, DEFAULT_AVATAR } from '../../../lib/world/avatar.js';

// 픽셀맵 무결성 — GameCanvas는 클라 전용(Phaser)이라 단위테스트가 어렵다.
// 여기선 "텍스처로 굽기 전" 픽셀맵 데이터가 규격 크기이고 미정의 색문자가 0임을 보장한다.
// (규격이 깨지면 generateTexture가 조용히 어긋난 스프라이트를 굽는다 — 부팅 시엔 안 터짐.)

const CHAR_CHARS = new Set(['.', ...Object.keys(CHAR_PAL_LOCAL)]);

describe('캐릭터 픽셀맵 (16×16 한 칸, 4방향×걷기 3패턴)', () => {
  it('규격은 16×16(오리지널 골드 필드 비율)', () => {
    expect(CHAR_W).toBe(16);
    expect(CHAR_H).toBe(16);
  });

  for (const dir of CHAR_DIRS) {
    for (const pose of CHAR_POSES) {
      it(`${dir}/${pose} — 16행 × 16열, 정의된 색문자만`, () => {
        const rows = charFrameRows(dir, pose);
        expect(rows).toHaveLength(CHAR_H);
        for (const row of rows) {
          expect(row).toHaveLength(CHAR_W);
          for (const ch of row) expect(CHAR_CHARS.has(ch)).toBe(true);
        }
      });
    }
  }

  it('로컬/원격 팔레트는 셔츠색(B)만 다르다', () => {
    const { B: bl, ...restL } = CHAR_PAL_LOCAL;
    const { B: br, ...restR } = CHAR_PAL_REMOTE;
    expect(restL).toEqual(restR);
    expect(bl).not.toBe(br);
  });

  it('origin Y는 타일 중심(=0.5) — 16×16 한 칸이 타일에 꼭 맞는다', () => {
    expect(CHAR_ORIGIN_Y).toBeCloseTo((CHAR_H - CHAR_TILE_PX / 2) / CHAR_H, 6);
    expect(CHAR_ORIGIN_Y).toBeCloseTo(0.5, 6);
  });

  it('걷기 사이클은 [l,n,r,n] 4프레임', () => {
    expect(CHAR_WALK_CYCLE).toEqual(['l', 'n', 'r', 'n']);
    for (const p of CHAR_WALK_CYCLE) expect(CHAR_POSES).toContain(p);
  });

  it('커스텀 외형은 3방향×3포즈 텍스처로 굽고 같은 키를 재사용한다', () => {
    const keys = new Set();
    let generated = 0;
    const scene = {
      textures: {
        exists: (key) => keys.has(key),
        remove: (key) => keys.delete(key),
      },
      make: {
        graphics: () => ({
          fillStyle() {},
          fillRect() {},
          generateTexture(key) { keys.add(key); generated += 1; },
          destroy() {},
        }),
      },
    };
    expect(ensureAvatarCharSet(scene, 'pc_test', avatarPalette(DEFAULT_AVATAR))).toBe(true);
    expect(keys.size).toBe(9);
    expect(generated).toBe(9);
    ensureAvatarCharSet(scene, 'pc_test', avatarPalette(DEFAULT_AVATAR));
    expect(generated).toBe(9);
    ensureAvatarCharSet(scene, 'pc_test', avatarPalette(DEFAULT_AVATAR), { replace: true });
    expect(generated).toBe(18);
  });
});

describe('펫 픽셀맵 (12×16, 5종×idle 2프레임)', () => {
  for (const key of PET_KEYS) {
    for (const frame of [0, 1]) {
      it(`${key} 프레임${frame} — 16행 × 12열, 종 팔레트 색문자만`, () => {
        const rows = petFrameRows(key, frame);
        const allow = new Set(['.', ...Object.keys(PET_PAL[key])]);
        expect(rows).toHaveLength(PET_H);
        for (const row of rows) {
          expect(row).toHaveLength(PET_W);
          for (const ch of row) expect(allow.has(ch)).toBe(true);
        }
      });
    }
  }

  it('두 프레임은 서로 달라야 idle 애니가 살아있다', () => {
    for (const key of PET_KEYS) {
      expect(petFrameRows(key, 0).join('\n')).not.toBe(petFrameRows(key, 1).join('\n'));
    }
  });

  it('알 수 없는 종은 dog로 폴백', () => {
    expect(petFrameRows('unknown', 0)).toEqual(petFrameRows('dog', 0));
  });
});

describe('NPC 마커 픽셀맵 (24×24, 라멘·미코 + 소품)', () => {
  for (const key of NPC_KEYS) {
    it(`${key} — ${NPC_H}행 × ${NPC_W}열, 종 팔레트 색문자만`, () => {
      const rows = npcMarkerRows(key);
      const allow = new Set(['.', ...Object.keys(NPC_PAL[key])]);
      expect(rows).toHaveLength(NPC_H);
      for (const row of rows) {
        expect(row).toHaveLength(NPC_W);
        for (const ch of row) expect(allow.has(ch)).toBe(true);
      }
    });
  }

  it('두 NPC 마커는 서로 다른 도트', () => {
    expect(npcMarkerRows('ramen').join('\n')).not.toBe(npcMarkerRows('shrine').join('\n'));
  });

  it('알 수 없는 key 는 ramen 으로 폴백', () => {
    expect(npcMarkerRows('unknown')).toEqual(npcMarkerRows('ramen'));
  });
});

describe('규슈 맛집 마커 픽셀맵 (24×24, 포장마차)', () => {
  it('맛집(gourmet) 마커는 24×24·팔레트 색문자만', () => {
    const rows = gourmetMarkerRows();
    const allow = new Set(['.', ...Object.keys(GOURMET_PAL)]);
    expect(rows).toHaveLength(NPC_H);
    for (const row of rows) {
      expect(row).toHaveLength(NPC_W);
      for (const ch of row) expect(allow.has(ch)).toBe(true);
    }
  });
});

describe('시간대 GBC 팔레트 (day/sunset/night)', () => {
  it('경계값: 06→day, 16→sunset, 19→night, 03→night', () => {
    const at = (h) => timeOfDay(new Date(2026, 0, 1, h, 0, 0));
    expect(at(6)).toBe('day');
    expect(at(15)).toBe('day');
    expect(at(16)).toBe('sunset');
    expect(at(18)).toBe('sunset');
    expect(at(19)).toBe('night');
    expect(at(3)).toBe('night');
    expect(at(0)).toBe('night');
  });

  it('day는 원본과 동일(항등)', () => {
    expect(tonePalette(BASE_TILE_PAL, 'day')).toEqual(BASE_TILE_PAL);
    expect(toneColor(BASE_TILE_PAL.grass1, 'day')).toBe(BASE_TILE_PAL.grass1);
  });

  it('3팔레트 잔디(grass1) 스냅샷 — 톤이 실제로 갈린다', () => {
    const grass = (m) => toneColor(BASE_TILE_PAL.grass1, m).toString(16).padStart(6, '0');
    expect(grass('day')).toBe('8cc152');    // LADX DX 옐로-그린 필드
    expect(grass('sunset')).toBe('a7b23b'); // 따뜻하게(적/황 up, 청 down)
    expect(grass('night')).toBe('4a765b');  // 어둡게+청 시프트
  });

  it('night는 모든 색을 day보다 어둡게(명도 감소)', () => {
    const lum = (hex) => ((hex >> 16) & 255) + ((hex >> 8) & 255) + (hex & 255);
    const day = tonePalette(BASE_TILE_PAL, 'day');
    const night = tonePalette(BASE_TILE_PAL, 'night');
    for (const k of Object.keys(BASE_TILE_PAL)) {
      expect(lum(night[k])).toBeLessThan(lum(day[k]));
    }
  });

  it('톤 변환 결과는 항상 유효한 24bit 색 범위', () => {
    for (const m of TONE_MODES) {
      const pal = tonePalette(BASE_TILE_PAL, m);
      for (const k of Object.keys(pal)) {
        expect(pal[k]).toBeGreaterThanOrEqual(0);
        expect(pal[k]).toBeLessThanOrEqual(0xffffff);
      }
    }
  });
});

describe('강 오토타일 변형(riverStreamRects — 순수)', () => {
  // 16×16 타일에서 (px,py)가 rects 중 하나에 덮이는가.
  const covers = (rects, px, py) =>
    rects.some(([x, y, w, h]) => px >= x && px < x + w && py >= y && py < y + h);

  it('16개 마스크(0..15) 모두 비지 않은 사각형 목록을 낸다', () => {
    for (let m = 0; m < 16; m++) {
      const rects = riverStreamRects(m);
      expect(Array.isArray(rects)).toBe(true);
      expect(rects.length).toBeGreaterThan(0);
    }
  });

  it('모든 사각형은 0..16 타일 경계 안', () => {
    for (let m = 0; m < 16; m++) {
      for (const [x, y, w, h] of riverStreamRects(m)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(16);
        expect(y + h).toBeLessThanOrEqual(16);
      }
    }
  });

  it('중앙 허브(7,7)는 항상 물줄기가 지난다 — 어떤 조합이든 연결점 존재', () => {
    for (let m = 0; m < 16; m++) expect(covers(riverStreamRects(m), 7, 7)).toBe(true);
  });

  it('연결된 방향만 변 중앙까지 물줄기가 닿는다(끊김 없이 이어짐)', () => {
    // N→(7,0), S→(7,15), W→(0,7), E→(15,7). 비트가 없으면 그 변엔 닿지 않는다.
    const edges = [
      [RIVER_N, 7, 0], [RIVER_S, 7, 15], [RIVER_W, 0, 7], [RIVER_E, 15, 7],
    ];
    for (let m = 0; m < 16; m++) {
      const rects = riverStreamRects(m);
      for (const [bit, px, py] of edges) {
        expect(covers(rects, px, py)).toBe(Boolean(m & bit));
      }
    }
  });

  it('직선(N+S)은 세로 관통, (E+W)는 가로 관통', () => {
    const ns = riverStreamRects(RIVER_N | RIVER_S);
    for (let py = 0; py < 16; py++) expect(covers(ns, 7, py)).toBe(true);
    const ew = riverStreamRects(RIVER_E | RIVER_W);
    for (let px = 0; px < 16; px++) expect(covers(ew, px, 7)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 근접 음성 거리 emit — 같은 씬 피어는 실거리, 다른 씬 피어는 Infinity(voice 자연 해제).
describe('emitPeerDistances — 씬별 거리 emit(공용 헬퍼)', () => {
  // 페이크 씬: player 좌표 + peers(Map<id,{sprite:{x,y}}>) + otherScenePeerIds(Set). bus 는 emit 캡처.
  const fakeScene = (player, peers, others) => ({
    player,
    peers: new Map(peers),
    otherScenePeerIds: others ? new Set(others) : undefined,
  });
  const capture = () => {
    const calls = [];
    return { bus: { emit: (evt, payload) => calls.push([evt, payload]) }, calls };
  };

  it('같은 씬 피어는 플레이어와의 실거리(px, 반올림)를 emit 한다', () => {
    const scene = fakeScene({ x: 0, y: 0 }, [
      ['a', { sprite: { x: 96, y: 0 } }],   // 3타일=96px
      ['b', { sprite: { x: 0, y: 32 } }],   // 1타일=32px
    ]);
    const { bus, calls } = capture();
    emitPeerDistances(scene, bus);
    expect(calls).toHaveLength(1);
    const [evt, payload] = calls[0];
    expect(evt).toBe('peers:dist');
    expect(payload).toEqual({ a: 96, b: 32 });
  });

  it('다른 씬 피어는 Infinity 로 실어 보낸다(voice 해제 트리거)', () => {
    const scene = fakeScene({ x: 0, y: 0 }, [['a', { sprite: { x: 32, y: 0 } }]], ['c', 'd']);
    const { bus, calls } = capture();
    emitPeerDistances(scene, bus);
    const [, payload] = calls[0];
    expect(payload.a).toBe(32);         // 같은 씬 실거리
    expect(payload.c).toBe(Infinity);   // 다른 씬
    expect(payload.d).toBe(Infinity);
  });

  it('대각선 거리는 유클리드(hypot)로 반올림', () => {
    const scene = fakeScene({ x: 0, y: 0 }, [['a', { sprite: { x: 3, y: 4 } }]]); // 5
    const { bus, calls } = capture();
    emitPeerDistances(scene, bus);
    expect(calls[0][1].a).toBe(5);
  });

  it('player 가 없으면 emit 하지 않는다(씬 파괴 사이 안전)', () => {
    const scene = fakeScene(null, [['a', { sprite: { x: 1, y: 1 } }]]);
    const { bus, calls } = capture();
    emitPeerDistances(scene, bus);
    expect(calls).toHaveLength(0);
  });
});
