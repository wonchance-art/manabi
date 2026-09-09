import { describe, expect, it } from 'vitest';
import {
  TOKYO_PILOT_TILE_PX,
  TOKYO_PILOT_STEP_MS,
  buildTokyoPilotScene,
  nearestTokyoPilotAnchor,
  resolveTokyoPilotSpawn,
  tokyoPilotStepTarget,
} from '../../components/world/TokyoPilotScene';
import {
  TOKYO_PILOT_SCENE,
  buildTokyoPilotGrid,
  tokyoPilotMap,
} from '../tokyoPilotMap';

describe('도쿄 파일럿 회색 박스 scene helper', () => {
  const map = tokyoPilotMap(TOKYO_PILOT_SCENE.HANEDA);
  const grid = buildTokyoPilotGrid(map.id);

  it('픽셀 크기와 반복 이동 간격을 작게 고정한다', () => {
    expect(TOKYO_PILOT_TILE_PX).toBe(16);
    expect(TOKYO_PILOT_STEP_MS).toBe(105);
  });

  it('보행 타일로만 4방 이동하고 벽·범위 밖·알 수 없는 방향을 거부한다', () => {
    expect(tokyoPilotStepTarget(map, grid, [4, 4], 'right')).toEqual([5, 4]);
    expect(tokyoPilotStepTarget(map, grid, [2, 2], 'up')).toBeNull();
    expect(tokyoPilotStepTarget(map, grid, [0, 0], 'left')).toBeNull();
    expect(tokyoPilotStepTarget(map, grid, [4, 4], 'diagonal')).toBeNull();
  });

  it('가장 가까운 anchor만 반환하고 범위 밖에서는 null이다', () => {
    expect(nearestTokyoPilotAnchor(map, [9, 6])?.id).toBe('haneda-arrivals-exit');
    expect(nearestTokyoPilotAnchor(map, [8, 6])?.id).toBe('haneda-arrivals-exit');
    expect(nearestTokyoPilotAnchor(map, [4, 4])).toBeNull();
  });

  it('요청 spawn은 보행 가능할 때만 사용하고 나머지는 기본점으로 복구한다', () => {
    expect(resolveTokyoPilotSpawn(map, grid, [9, 6])).toEqual([9, 6]);
    expect(resolveTokyoPilotSpawn(map, grid, [0, 0])).toEqual(map.spawn);
    expect(resolveTokyoPilotSpawn(map, grid, [-1, 2])).toEqual(map.spawn);
    expect(resolveTokyoPilotSpawn(map, grid, ['4', 4])).toEqual(map.spawn);
    expect(resolveTokyoPilotSpawn(map, grid)).toEqual(map.spawn);
  });

  it('동률 anchor는 선언 순서로 결정돼 프레임과 무관하다', () => {
    const fixture = {
      anchors: [
        { id: 'first', tile: [1, 0] },
        { id: 'second', tile: [0, 1] },
      ],
    };
    expect(nearestTokyoPilotAnchor(fixture, [0, 0])?.id).toBe('first');
  });

  it('Phaser scene key를 계약 scene id로 등록한다', () => {
    class Scene {
      constructor(key) { this.key = key; }
    }
    const SceneClass = buildTokyoPilotScene({ Scene }, TOKYO_PILOT_SCENE.HANEDA);
    expect(new SceneClass().key).toBe(TOKYO_PILOT_SCENE.HANEDA);
  });

  it('셸 방향 입력은 마지막으로 누른 방향을 우선하고 release로 정리한다', () => {
    class Scene {
      constructor(key) { this.key = key; }
    }
    const SceneClass = buildTokyoPilotScene({ Scene }, TOKYO_PILOT_SCENE.HANEDA);
    const scene = new SceneClass();
    scene.heldDirs = [];
    scene.extInputDown('up');
    scene.extInputDown('right');
    expect(scene.heldDirection()).toBe('right');
    scene.extInputUp('right');
    expect(scene.heldDirection()).toBe('up');
    scene.extInputDown('diagonal');
    expect(scene.heldDirs).toEqual(['up']);
  });

  it('알 수 없는 scene은 class 생성 전에 fail closed다', () => {
    expect(() => buildTokyoPilotScene({ Scene: class {} }, 'city:tokyo')).toThrow(/unknown scene/);
  });
});
