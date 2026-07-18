import { describe, expect, it, vi } from 'vitest';
import {
  buildFujiClimbScene,
  FUJI_CLIMB_ACTS,
  FUJI_CLIMB_SCENE_KEY,
  nextFujiClimbActIndex,
} from '../fujiClimbScene.js';

describe('Fuji climb scene skeleton', () => {
  it('locks the requested four-act order and texture ids', () => {
    expect(FUJI_CLIMB_SCENE_KEY).toBe('fuji-climb-scene');
    expect(FUJI_CLIMB_ACTS.map((act) => act.id)).toEqual([
      'fifth-station',
      'mountain-hut-night',
      'goraiko',
      'ohachi-meguri',
    ]);
    expect(FUJI_CLIMB_ACTS.map((act) => act.texture)).toEqual([
      'fuji_fifth_station',
      'fuji_mountain_hut_night',
      'fuji_goraiko',
      'fuji_ohachi_meguri',
    ]);
    expect(Object.isFrozen(FUJI_CLIMB_ACTS)).toBe(true);
    expect(FUJI_CLIMB_ACTS.every((act) => Object.isFrozen(act))).toBe(true);
  });

  it('advances deterministically and rejects every out-of-range boundary', () => {
    expect(nextFujiClimbActIndex(0)).toBe(1);
    expect(nextFujiClimbActIndex(1)).toBe(2);
    expect(nextFujiClimbActIndex(2)).toBe(3);
    expect(nextFujiClimbActIndex(3)).toBeNull();
    expect(nextFujiClimbActIndex(-1)).toBeNull();
    expect(nextFujiClimbActIndex(4)).toBeNull();
    expect(nextFujiClimbActIndex(1.5)).toBeNull();
    expect(nextFujiClimbActIndex('1')).toBeNull();
  });

  it('bakes every act as a stable 160x144 abstract texture', () => {
    const graphics = {};
    for (const method of ['fillStyle', 'fillRect', 'fillTriangle', 'fillCircle', 'fillEllipse']) {
      graphics[method] = vi.fn(() => graphics);
    }
    graphics.generateTexture = vi.fn();
    graphics.destroy = vi.fn();
    class Scene {
      constructor() {
        this.make = { graphics: vi.fn(() => graphics) };
      }
    }
    const FujiScene = buildFujiClimbScene({ Scene });
    const scene = new FujiScene();

    scene.preload();

    expect(scene.make.graphics).toHaveBeenCalledTimes(4);
    expect(graphics.generateTexture.mock.calls).toEqual([
      ['fuji_fifth_station', 160, 144],
      ['fuji_mountain_hut_night', 160, 144],
      ['fuji_goraiko', 160, 144],
      ['fuji_ohachi_meguri', 160, 144],
    ]);
    expect(graphics.destroy).toHaveBeenCalledTimes(4);
  });

  it('uses the Kawaguchiko return contract and completes after the fourth act', () => {
    class Scene {
      constructor(key) {
        this.key = key;
        this.cameras = { main: { setBackgroundColor: vi.fn() } };
        this.add = {
          image: vi.fn(() => ({ setScale: vi.fn().mockReturnThis(), setTexture: vi.fn() })),
        };
        this.input = { keyboard: { on: vi.fn() } };
        this.events = { once: vi.fn() };
        this.scene = { start: vi.fn() };
      }
    }
    const bindScene = vi.fn();
    const onEnter = vi.fn();
    const onActChange = vi.fn();
    const onComplete = vi.fn();
    const onReturn = vi.fn();
    const FujiScene = buildFujiClimbScene({ Scene }, {
      bindScene, onEnter, onActChange, onComplete, onReturn,
    });
    const scene = new FujiScene();
    scene.create();

    expect(scene.key).toBe(FUJI_CLIMB_SCENE_KEY);
    expect(scene.returnScene).toBe('city:kawaguchiko');
    expect(bindScene).toHaveBeenCalledWith(scene);
    expect(onEnter).toHaveBeenCalledOnce();
    expect(onActChange).toHaveBeenLastCalledWith({
      actId: 'fifth-station', index: 0, total: 4,
    });

    expect(scene.fujiInteract()).toBe(true);
    expect(scene.fujiInteract()).toBe(true);
    expect(scene.fujiInteract()).toBe(true);
    expect(onActChange).toHaveBeenLastCalledWith({
      actId: 'ohachi-meguri', index: 3, total: 4,
    });
    expect(scene.fujiInteract()).toBe(true);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onReturn).toHaveBeenCalledWith('city:kawaguchiko');
    expect(scene.scene.start).toHaveBeenCalledWith('city:kawaguchiko', {});
    expect(scene.fujiCancel()).toBe(false);
  });
});
