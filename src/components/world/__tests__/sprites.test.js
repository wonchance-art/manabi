import { describe, it, expect } from 'vitest';
import {
  CHAR_W, CHAR_H, CHAR_ORIGIN_Y, CHAR_TILE_PX, PET_W, PET_H,
  CHAR_DIRS, CHAR_POSES, CHAR_WALK_CYCLE, charFrameRows,
  PET_KEYS, petFrameRows, CHAR_PAL_LOCAL, CHAR_PAL_REMOTE, PET_PAL,
  BASE_TILE_PAL, tonePalette, toneColor, timeOfDay, TONE_MODES,
} from '../sprites.js';

// 픽셀맵 무결성 — GameCanvas는 클라 전용(Phaser)이라 단위테스트가 어렵다.
// 여기선 "텍스처로 굽기 전" 픽셀맵 데이터가 규격 크기이고 미정의 색문자가 0임을 보장한다.
// (규격이 깨지면 generateTexture가 조용히 어긋난 스프라이트를 굽는다 — 부팅 시엔 안 터짐.)

const CHAR_CHARS = new Set(['.', ...Object.keys(CHAR_PAL_LOCAL)]);

describe('캐릭터 픽셀맵 (16×24, 4방향×걷기 3패턴)', () => {
  for (const dir of CHAR_DIRS) {
    for (const pose of CHAR_POSES) {
      it(`${dir}/${pose} — 24행 × 16열, 정의된 색문자만`, () => {
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

  it('origin Y는 하단 16px(=타일)에 발이 정렬되는 값(=16/24)', () => {
    expect(CHAR_ORIGIN_Y).toBeCloseTo((CHAR_H - CHAR_TILE_PX / 2) / CHAR_H, 6);
    expect(CHAR_ORIGIN_Y).toBeCloseTo(16 / 24, 6);
  });

  it('걷기 사이클은 [l,n,r,n] 4프레임', () => {
    expect(CHAR_WALK_CYCLE).toEqual(['l', 'n', 'r', 'n']);
    for (const p of CHAR_WALK_CYCLE) expect(CHAR_POSES).toContain(p);
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
