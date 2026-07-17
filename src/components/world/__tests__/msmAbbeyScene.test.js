import { describe, expect, it, vi } from 'vitest';
import {
  buildMsmAbbeyScene,
  MSM_ABBEY_ACTS,
  MSM_ABBEY_SCENE_KEY,
  nextMsmAbbeyActIndex,
} from '../msmAbbeyScene.js';
import { MSM_ABBEY_ACT_COPY, msmAbbeyActCopy } from '../msmAbbeyContent.js';

describe('Mont-Saint-Michel abbey scene skeleton', () => {
  it('locks the requested four-act order to stable structural ids', () => {
    expect(MSM_ABBEY_SCENE_KEY).toBe('msm-abbey-scene');
    expect(MSM_ABBEY_ACTS.map((act) => act.id)).toEqual([
      'grand-staircase',
      'abbey-church',
      'la-merveille-cloister',
      'west-terrace',
    ]);
  });

  it('advances deterministically and returns null after the west terrace', () => {
    expect(nextMsmAbbeyActIndex(0)).toBe(1);
    expect(nextMsmAbbeyActIndex(1)).toBe(2);
    expect(nextMsmAbbeyActIndex(2)).toBe(3);
    expect(nextMsmAbbeyActIndex(3)).toBeNull();
    expect(nextMsmAbbeyActIndex(-1)).toBeNull();
  });

  it('maps every structural act to Claude-owned bilingual copy', () => {
    expect(Object.keys(MSM_ABBEY_ACT_COPY)).toEqual(MSM_ABBEY_ACTS.map((act) => act.id));
    for (const act of MSM_ABBEY_ACTS) {
      expect(msmAbbeyActCopy(act.id)).toMatchObject({
        title: expect.any(String), ko: expect.any(String), fr: expect.any(String),
        reading: expect.any(String), gloss: expect.any(String),
      });
    }
    expect(msmAbbeyActCopy('unknown')).toBeNull();
  });

  it('returns to the originating city tile after the final act', () => {
    class Scene {
      constructor(key) { this.key = key; }
    }
    const onActChange = vi.fn();
    const onReturn = vi.fn();
    const AbbeyScene = buildMsmAbbeyScene({ Scene }, { onActChange, onReturn });
    const scene = new AbbeyScene();
    scene.background = { setTexture: vi.fn() };
    scene.scene = { start: vi.fn() };
    scene.returnScene = 'city:mont-saint-michel';
    scene.returnSpawn = { scene: 'city:mont-saint-michel', x: 286, y: 164 };
    scene.worldReturn = { scene: 'overworld:emea', x: 1, y: 2 };
    scene.returning = false;
    scene.actIndex = 2;

    expect(scene.abbeyInteract()).toBe(true);
    expect(onActChange).toHaveBeenLastCalledWith({
      actId: 'west-terrace', index: 3, total: 4,
    });
    expect(scene.abbeyInteract()).toBe(true);
    expect(onReturn).toHaveBeenCalledWith('city:mont-saint-michel');
    expect(scene.scene.start).toHaveBeenCalledWith('city:mont-saint-michel', {
      spawn: scene.returnSpawn,
      worldReturn: scene.worldReturn,
    });
  });
});
