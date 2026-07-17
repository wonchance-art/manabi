export const MSM_ABBEY_SCENE_KEY = 'msm-abbey-scene';

export const MSM_ABBEY_ACTS = Object.freeze([
  Object.freeze({ id: 'grand-staircase', texture: 'msm_abbey_grand_staircase' }),
  Object.freeze({ id: 'abbey-church', texture: 'msm_abbey_church' }),
  Object.freeze({ id: 'la-merveille-cloister', texture: 'msm_abbey_la_merveille_cloister' }),
  Object.freeze({ id: 'west-terrace', texture: 'msm_abbey_west_terrace' }),
]);

export function nextMsmAbbeyActIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= MSM_ABBEY_ACTS.length) return null;
  return index + 1 < MSM_ABBEY_ACTS.length ? index + 1 : null;
}

const WIDTH = 160;
const HEIGHT = 144;
const SCALE = 2;

function bakeActTexture(scene, act, index) {
  const graphics = scene.make.graphics({ add: false });
  const palettes = [
    [0x3d3a38, 0x80776c, 0xc6baa4],
    [0x282b32, 0x77746f, 0xd8d0bd],
    [0x34433d, 0x889787, 0xc9c1aa],
    [0x6f8b9b, 0xc0b59c, 0xe5d9bb],
  ];
  const [background, stone, light] = palettes[index];
  graphics.fillStyle(background, 1).fillRect(0, 0, WIDTH, HEIGHT);
  graphics.fillStyle(stone, 1).fillRect(0, 96, WIDTH, 48);
  if (index === 0) {
    for (let step = 0; step < 8; step += 1) {
      graphics.fillStyle(step % 2 ? light : stone, 1)
        .fillRect(20 + step * 6, 88 - step * 8, 120 - step * 12, 8);
    }
  } else if (index === 1) {
    for (const x of [20, 52, 84, 116]) graphics.fillStyle(stone, 1).fillRect(x, 22, 12, 90);
    graphics.fillStyle(light, 0.75).fillRect(10, 16, 140, 8);
  } else if (index === 2) {
    for (const x of [16, 48, 80, 112]) {
      graphics.fillStyle(stone, 1).fillRect(x, 42, 24, 54);
      graphics.fillStyle(background, 1).fillCircle(x + 12, 54, 8);
    }
    graphics.fillStyle(light, 0.7).fillRect(0, 96, WIDTH, 4);
  } else {
    graphics.fillStyle(light, 0.9).fillRect(0, 0, WIDTH, 66);
    graphics.fillStyle(stone, 1).fillRect(0, 86, WIDTH, 12);
    graphics.fillStyle(background, 0.55).fillRect(0, 66, WIDTH, 20);
  }
  graphics.generateTexture(act.texture, WIDTH, HEIGHT);
  graphics.destroy();
}

export function buildMsmAbbeyScene(Phaser, ctx = {}) {
  return class MsmAbbeyScene extends Phaser.Scene {
    constructor() {
      super(MSM_ABBEY_SCENE_KEY);
    }

    preload() {
      MSM_ABBEY_ACTS.forEach((act, index) => bakeActTexture(this, act, index));
    }

    create(data = {}) {
      ctx.bindScene?.(this);
      ctx.onEnter?.();
      this.returnScene = data.returnScene || 'city:mont-saint-michel';
      this.returnSpawn = data.returnSpawn || null;
      this.worldReturn = data.worldReturn || null;
      this.returning = false;
      this.actIndex = 0;
      this.cameras.main.setBackgroundColor(0x282b32);
      this.background = this.add.image(WIDTH, HEIGHT, MSM_ABBEY_ACTS[0].texture).setScale(SCALE);
      this.setAct(0);
      this.input.keyboard.on('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'b' || event.key === 'B') this.abbeyCancel();
        else if (event.key === 'Enter' || event.key === ' ' || event.key === 'a' || event.key === 'A') this.abbeyInteract();
      });
      this.events.once('shutdown', () => ctx.bindScene?.(null));
    }

    setAct(index) {
      const act = MSM_ABBEY_ACTS[index];
      if (!act) return false;
      this.actIndex = index;
      this.background?.setTexture(act.texture);
      ctx.onActChange?.({ actId: act.id, index, total: MSM_ABBEY_ACTS.length });
      return true;
    }

    abbeyInteract() {
      if (this.returning) return false;
      const next = nextMsmAbbeyActIndex(this.actIndex);
      if (next == null) {
        ctx.onComplete?.();
        this.returnToCity();
        return true;
      }
      return this.setAct(next);
    }

    abbeyCancel() {
      if (this.returning) return false;
      this.returnToCity();
      return true;
    }

    returnToCity() {
      if (this.returning) return;
      this.returning = true;
      ctx.onReturn?.(this.returnScene);
      this.scene.start(this.returnScene, {
        ...(this.returnSpawn ? { spawn: this.returnSpawn } : {}),
        ...(this.worldReturn ? { worldReturn: this.worldReturn } : {}),
      });
    }
  };
}
