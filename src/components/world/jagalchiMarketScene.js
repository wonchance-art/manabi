export const JAGALCHI_MARKET_SCENE_KEY = 'jagalchi-market-scene';

export const JAGALCHI_MARKET_ACTS = Object.freeze([
  Object.freeze({ id: 'dawn-pier', texture: 'jagalchi_dawn_pier' }),
  Object.freeze({ id: 'auction-floor', texture: 'jagalchi_auction_floor' }),
  Object.freeze({ id: 'hoe-alley', texture: 'jagalchi_hoe_alley' }),
  Object.freeze({ id: 'breakwater-lighthouse', texture: 'jagalchi_breakwater_lighthouse' }),
]);

export function nextJagalchiMarketActIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= JAGALCHI_MARKET_ACTS.length) return null;
  return index + 1 < JAGALCHI_MARKET_ACTS.length ? index + 1 : null;
}

const WIDTH = 160;
const HEIGHT = 144;
const SCALE = 2;

function bakeActTexture(scene, act, index) {
  const graphics = scene.make.graphics({ add: false });
  const palettes = [
    [0x1e2a3a, 0x4a5568, 0xd8c9a0],
    [0x2f2b26, 0x8a7f6f, 0xf0e2b6],
    [0x24404a, 0x6fa3a8, 0xe8d9a8],
    [0x9fc3d0, 0x5a6a70, 0xe5ddc2],
  ];
  const [background, structure, light] = palettes[index];
  graphics.fillStyle(background, 1).fillRect(0, 0, WIDTH, HEIGHT);
  if (index === 0) {
    graphics.fillStyle(structure, 1).fillRect(0, 94, WIDTH, 50);
    graphics.fillStyle(background, 0.7).fillRect(0, 82, WIDTH, 12);
    for (const [x, y, width, height] of [
      [18, 78, 26, 16],
      [48, 84, 22, 10],
      [114, 74, 28, 20],
    ]) {
      graphics.fillStyle(light, 0.82).fillRect(x, y, width, height);
      graphics.fillStyle(structure, 1).fillRect(x + 3, y + 3, width - 6, 2);
    }
  } else if (index === 1) {
    graphics.fillStyle(structure, 0.75).fillRect(0, 36, WIDTH, 108);
    for (const x of [20, 60, 100, 140]) {
      graphics.fillStyle(light, 0.85).fillCircle(x, 22, 6);
      graphics.fillStyle(light, 0.2).fillRect(x - 10, 28, 20, 28);
    }
    for (const y of [68, 94, 120]) {
      for (const x of [12, 48, 84, 120]) {
        graphics.fillStyle(y % 4 ? structure : light, 1).fillRect(x, y, 28, 16);
        graphics.fillStyle(light, 0.72).fillRect(x + 3, y + 3, 22, 2);
      }
    }
  } else if (index === 2) {
    graphics.fillStyle(structure, 0.32).fillRect(0, 28, WIDTH, 116);
    for (const x of [12, 54, 96]) {
      graphics.fillStyle(structure, 0.88).fillRect(x, 64, 34, 50);
      graphics.fillStyle(light, 0.72).fillRect(x + 3, 69, 28, 5);
      graphics.fillStyle(background, 0.65).fillRect(x + 4, 78, 26, 28);
    }
    for (const x of [8, 48, 88, 128]) {
      graphics.fillStyle(light, 0.88).fillRect(x, 18, 28, 12);
      graphics.fillStyle(structure, 1).fillRect(x + 4, 22, 20, 3);
    }
  } else {
    graphics.fillStyle(light, 0.28).fillRect(0, 0, WIDTH, 70);
    graphics.fillStyle(background, 0.45).fillRect(0, 70, WIDTH, 28);
    graphics.fillStyle(structure, 1).fillRect(0, 98, WIDTH, 46);
    graphics.fillStyle(light, 1).fillRect(118, 38, 10, 60);
    graphics.fillStyle(structure, 1).fillRect(115, 32, 16, 8);
    graphics.fillStyle(light, 0.9).fillRect(112, 28, 22, 5);
    graphics.fillStyle(background, 0.85).fillRect(121, 44, 4, 7);
  }
  graphics.generateTexture(act.texture, WIDTH, HEIGHT);
  graphics.destroy();
}

export function buildJagalchiMarketScene(Phaser, ctx = {}) {
  return class JagalchiMarketScene extends Phaser.Scene {
    constructor() {
      super(JAGALCHI_MARKET_SCENE_KEY);
    }

    preload() {
      JAGALCHI_MARKET_ACTS.forEach((act, index) => bakeActTexture(this, act, index));
    }

    create(data = {}) {
      ctx.bindScene?.(this);
      ctx.onEnter?.();
      this.returnScene = data.returnScene || 'city:busan';
      this.returnSpawn = data.returnSpawn || null;
      this.worldReturn = data.worldReturn || null;
      this.returning = false;
      this.actIndex = 0;
      this.cameras.main.setBackgroundColor(0x1e2a3a);
      this.background = this.add.image(WIDTH, HEIGHT, JAGALCHI_MARKET_ACTS[0].texture).setScale(SCALE);
      this.setAct(0);
      this.input.keyboard.on('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'b' || event.key === 'B') this.jagalchiCancel();
        else if (event.key === 'Enter' || event.key === ' ' || event.key === 'a' || event.key === 'A') this.jagalchiInteract();
      });
      this.events.once('shutdown', () => ctx.bindScene?.(null));
    }

    setAct(index) {
      const act = JAGALCHI_MARKET_ACTS[index];
      if (!act) return false;
      this.actIndex = index;
      this.background?.setTexture(act.texture);
      ctx.onActChange?.({ actId: act.id, index, total: JAGALCHI_MARKET_ACTS.length });
      return true;
    }

    jagalchiInteract() {
      if (this.returning) return false;
      const next = nextJagalchiMarketActIndex(this.actIndex);
      if (next == null) {
        ctx.onComplete?.();
        this.returnToCity();
        return true;
      }
      return this.setAct(next);
    }

    jagalchiCancel() {
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
