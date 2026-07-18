export const FUJI_CLIMB_SCENE_KEY = 'fuji-climb-scene';

export const FUJI_CLIMB_ACTS = Object.freeze([
  Object.freeze({ id: 'fifth-station', texture: 'fuji_fifth_station' }),
  Object.freeze({ id: 'mountain-hut-night', texture: 'fuji_mountain_hut_night' }),
  Object.freeze({ id: 'goraiko', texture: 'fuji_goraiko' }),
  Object.freeze({ id: 'ohachi-meguri', texture: 'fuji_ohachi_meguri' }),
]);

export function nextFujiClimbActIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= FUJI_CLIMB_ACTS.length) return null;
  return index + 1 < FUJI_CLIMB_ACTS.length ? index + 1 : null;
}

const WIDTH = 160;
const HEIGHT = 144;
const SCALE = 2;

function bakeActTexture(scene, act, index) {
  const graphics = scene.make.graphics({ add: false });
  const palettes = [
    [0x8a5a3c, 0x3e5a44, 0xcfe3ee],
    [0x141a2e, 0x5a4a38, 0xf0c47a],
    [0x2a2440, 0xd96a3c, 0xf4dca0],
    [0x9fb6c8, 0x6a5548, 0xe8e2d2],
  ];
  const [ground, structure, light] = palettes[index];
  graphics.fillStyle(index === 0 || index === 3 ? light : ground, 1).fillRect(0, 0, WIDTH, HEIGHT);
  if (index === 0) {
    graphics.fillStyle(ground, 1).fillRect(0, 96, WIDTH, 48);
    graphics.fillStyle(structure, 0.42).fillTriangle(0, 96, 92, 34, 160, 96);
    graphics.fillStyle(structure, 1).fillRect(92, 72, 44, 25);
    graphics.fillStyle(ground, 1).fillTriangle(88, 72, 114, 55, 140, 72);
    for (const x of [12, 30, 148]) {
      graphics.fillStyle(structure, 1).fillRect(x - 2, 72, 4, 25);
      graphics.fillTriangle(x - 11, 80, x, 54, x + 11, 80);
      graphics.fillTriangle(x - 9, 68, x, 45, x + 9, 68);
    }
    graphics.fillStyle(light, 0.7).fillRect(99, 78, 12, 7);
  } else if (index === 1) {
    graphics.fillStyle(structure, 0.42).fillTriangle(0, 116, 78, 34, 160, 116);
    graphics.fillStyle(structure, 1).fillRect(40, 78, 80, 45);
    graphics.fillStyle(ground, 1).fillTriangle(32, 78, 80, 55, 128, 78);
    for (const x of [50, 72, 94]) {
      graphics.fillStyle(light, 0.92).fillRect(x, 88, 12, 9);
    }
    for (const [x, y] of [[16, 108], [26, 102], [135, 112], [146, 105]]) {
      graphics.fillStyle(light, 0.95).fillCircle(x, y, 2);
    }
    graphics.fillStyle(ground, 0.7).fillRect(0, 122, WIDTH, 22);
  } else if (index === 2) {
    graphics.fillStyle(structure, 0.34).fillRect(0, 52, WIDTH, 15);
    graphics.fillStyle(light, 0.74).fillRect(0, 67, WIDTH, 17);
    graphics.fillStyle(structure, 0.88).fillRect(0, 84, WIDTH, 12);
    for (const [x, y, width] of [[20, 80, 42], [54, 91, 50], [103, 76, 45], [132, 91, 35]]) {
      graphics.fillStyle(light, 0.86).fillEllipse(x, y, width, 14);
    }
    graphics.fillStyle(ground, 1).fillTriangle(0, 144, 82, 69, 160, 144);
    graphics.fillStyle(structure, 0.7).fillTriangle(34, 144, 96, 87, 160, 144);
  } else {
    graphics.fillStyle(light, 0.6).fillRect(0, 45, WIDTH, 25);
    graphics.fillStyle(structure, 0.86).fillTriangle(0, 121, 54, 73, 112, 121);
    graphics.fillStyle(structure, 1).fillTriangle(48, 121, 112, 59, 160, 121);
    graphics.fillStyle(ground, 0.74).fillEllipse(100, 111, 92, 38);
    graphics.fillStyle(structure, 1).fillEllipse(100, 114, 64, 23);
    graphics.fillStyle(light, 0.34).fillEllipse(100, 111, 42, 12);
    graphics.fillStyle(structure, 1).fillRect(0, 121, WIDTH, 23);
  }
  graphics.generateTexture(act.texture, WIDTH, HEIGHT);
  graphics.destroy();
}

export function buildFujiClimbScene(Phaser, ctx = {}) {
  return class FujiClimbScene extends Phaser.Scene {
    constructor() {
      super(FUJI_CLIMB_SCENE_KEY);
    }

    preload() {
      FUJI_CLIMB_ACTS.forEach((act, index) => bakeActTexture(this, act, index));
    }

    create(data = {}) {
      ctx.bindScene?.(this);
      ctx.onEnter?.();
      this.returnScene = data.returnScene || 'city:kawaguchiko';
      this.returnSpawn = data.returnSpawn || null;
      this.worldReturn = data.worldReturn || null;
      this.returning = false;
      this.actIndex = 0;
      this.cameras.main.setBackgroundColor(0x141a2e);
      this.background = this.add.image(WIDTH, HEIGHT, FUJI_CLIMB_ACTS[0].texture).setScale(SCALE);
      this.setAct(0);
      this.input.keyboard.on('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'b' || event.key === 'B') this.fujiCancel();
        else if (event.key === 'Enter' || event.key === ' ' || event.key === 'a' || event.key === 'A') this.fujiInteract();
      });
      this.events.once('shutdown', () => ctx.bindScene?.(null));
    }

    setAct(index) {
      const act = FUJI_CLIMB_ACTS[index];
      if (!act) return false;
      this.actIndex = index;
      this.background?.setTexture(act.texture);
      ctx.onActChange?.({ actId: act.id, index, total: FUJI_CLIMB_ACTS.length });
      return true;
    }

    fujiInteract() {
      if (this.returning) return false;
      const next = nextFujiClimbActIndex(this.actIndex);
      if (next == null) {
        ctx.onComplete?.();
        this.returnToCity();
        return true;
      }
      return this.setAct(next);
    }

    fujiCancel() {
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
