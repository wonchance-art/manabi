import { describe, it, expect } from 'vitest';
import { AVATAR_REBAKE_STATIC_TARGETS, overworldRegionAvatarPrefix } from '../avatarRebake.js';
import { buildTranssibCorridorScene } from '../transsibCorridorScene.js';
import { buildOverworldRegionScene } from '../overworldRegionScene.js';
import { OVERWORLD_REGION_LIST } from '../../../lib/world/overworldRegions.js';
import { TRANS_SIBERIAN_CORRIDOR } from '../../../lib/world/transsibCorridor.js';
import { DEFAULT_AVATAR, avatarPalette } from '../../../lib/world/avatar.js';

// Codex #113 P1 회귀 — 신규 이동 씬(횡단열차·오버월드 지역)이 아바타 실루엣(shape)을
// 베이크에 전달하고, GameCanvas 즉시 재베이크 후보 계약(AVATAR_REBAKE_STATIC_TARGETS)이
// 그 씬들을 전부 포함하는지 고정한다. 계약에서 씬이 빠지면 "옷 갈아입어도 그 씬만
// 옛 모습" 버그가 재발한다.

const LENS = avatarPalette(DEFAULT_AVATAR).G; // 안경 렌즈색 — day 톤은 항등이라 그대로 관찰된다

// 기록형 fake 씬: generateTexture 될 때까지 쓰인 fillStyle 색을 텍스처 키별로 남긴다.
const bakeRecorder = () => {
  const baked = new Map();
  const scene = {
    textures: { exists: () => false, remove: () => {} },
    make: {
      graphics: () => {
        const colors = new Set();
        const g = {
          fillStyle(color) { colors.add(color); return g; },
          fillRect() { return g; },
          fillCircle() { return g; },
          fillTriangle() { return g; },
          generateTexture(key) { baked.set(key, new Set(colors)); return g; },
          destroy() {},
        };
        return g;
      },
    },
  };
  return { scene, baked };
};

const FakePhaser = { Scene: class { constructor() {} } };

const preloadInto = (SceneClass) => {
  const instance = new SceneClass();
  const { scene, baked } = bakeRecorder();
  instance.textures = scene.textures;
  instance.make = scene.make;
  instance.preload();
  return baked;
};

describe('AVATAR_REBAKE_STATIC_TARGETS — GameCanvas 재베이크 계약', () => {
  it('월드·공항·횡단열차 고정 3종을 포함한다', () => {
    expect(AVATAR_REBAKE_STATIC_TARGETS).toContainEqual(['pc', 'world']);
    expect(AVATAR_REBAKE_STATIC_TARGETS).toContainEqual(['ax_pc', 'airport']);
    expect(AVATAR_REBAKE_STATIC_TARGETS).toContainEqual(['ts_pc', TRANS_SIBERIAN_CORRIDOR.sceneId]);
  });

  it('모든 오버월드 지역 씬을 (prefix, sceneId) 쌍으로 포함한다', () => {
    expect(OVERWORLD_REGION_LIST.length).toBeGreaterThan(0);
    for (const region of OVERWORLD_REGION_LIST) {
      expect(AVATAR_REBAKE_STATIC_TARGETS).toContainEqual(
        [overworldRegionAvatarPrefix(region.id), region.sceneId],
      );
    }
    expect(AVATAR_REBAKE_STATIC_TARGETS).toHaveLength(3 + OVERWORLD_REGION_LIST.length);
  });

  it('prefix 는 서로 겹치지 않는다(재베이크가 엉뚱한 씬 텍스처를 덮지 않도록)', () => {
    const prefixes = AVATAR_REBAKE_STATIC_TARGETS.map(([prefix]) => prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('지역 prefix 규칙 — 영숫자 외 문자는 _ 로 치환(텍스처 키 안전)', () => {
    expect(overworldRegionAvatarPrefix('asia-pacific')).toBe('region_pc_asia_pacific');
    expect(overworldRegionAvatarPrefix('emea')).toBe('region_pc_emea');
  });
});

describe('신규 이동 씬 preload — 아바타 shape 전달(안경 렌즈가 실제로 구워진다)', () => {
  const withGlasses = { ...DEFAULT_AVATAR, acc: 'glasses' };
  const withoutAcc = { ...DEFAULT_AVATAR, acc: 'none' };

  it('횡단열차 씬: shape(acc=glasses)가 ts_pc 베이크에 반영된다', () => {
    const baked = preloadInto(
      buildTranssibCorridorScene(FakePhaser, { avatarRef: { current: withGlasses } }),
    );
    expect(baked.has('ts_pc_down_n')).toBe(true);
    expect(baked.get('ts_pc_down_n').has(LENS)).toBe(true);
  });

  it('횡단열차 씬 대조군: acc=none 이면 렌즈색이 없다(관찰이 유효하다는 증거)', () => {
    const baked = preloadInto(
      buildTranssibCorridorScene(FakePhaser, { avatarRef: { current: withoutAcc } }),
    );
    expect(baked.get('ts_pc_down_n').has(LENS)).toBe(false);
  });

  for (const region of OVERWORLD_REGION_LIST) {
    it(`지역 씬 ${region.id}: 계약 prefix 로 굽고 shape 도 반영된다`, () => {
      const baked = preloadInto(
        buildOverworldRegionScene(FakePhaser, region, { avatarRef: { current: withGlasses } }),
      );
      const key = `${overworldRegionAvatarPrefix(region.id)}_down_n`;
      expect(baked.has(key)).toBe(true);
      expect(baked.get(key).has(LENS)).toBe(true);
    });
  }
});
