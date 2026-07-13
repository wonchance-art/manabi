import { performance } from 'node:perf_hooks';
import {
  applyPeersToScene,
  emitPeerDistances,
  updateScenePeers,
} from '../src/components/world/sprites.js';

function makeDisplayObject(x = 0, y = 0, counters) {
  counters.displayObjects += 1;
  return {
    x,
    y,
    setOrigin() { return this; },
    setScale() { return this; },
    setDepth() { counters.depthWrites += 1; return this; },
    setTexture() { counters.textureWrites += 1; return this; },
    setFlipX() { return this; },
    setPosition(nx, ny) { this.x = nx; this.y = ny; counters.positionWrites += 1; return this; },
    setText() { counters.labelWrites += 1; return this; },
    setStyle() { return this; },
    destroy() { counters.destroyed += 1; },
  };
}

function makeScene() {
  const counters = {
    displayObjects: 0,
    depthWrites: 0,
    textureWrites: 0,
    positionWrites: 0,
    labelWrites: 0,
    destroyed: 0,
    tweens: 0,
  };
  const scene = {
    peers: new Map(),
    fontReady: true,
    player: { x: 16, y: 16 },
    add: {
      image: (x, y) => makeDisplayObject(x, y, counters),
      text: (x, y) => makeDisplayObject(x, y, counters),
    },
    tweens: {
      add(config) {
        counters.tweens += 1;
        config.targets.x = config.x;
        config.targets.y = config.y;
        config.onComplete?.();
      },
    },
  };
  return { scene, counters };
}

function peerSnapshot(peerCount) {
  return new Map(Array.from({ length: peerCount }, (_, index) => [
    `peer-${index}`,
    {
      x: (index % 8) * 32 + 16,
      y: Math.floor(index / 8) * 32 + 16,
      dir: index % 2 ? 'left' : 'down',
      nick: `학습자${index}`,
      scene: 'plaza',
    },
  ]));
}

export function runPeerLoadBenchmark({ peerCount = 64, frames = 600, distancePasses = 200 } = {}) {
  const { scene, counters } = makeScene();
  const incoming = peerSnapshot(peerCount);

  const syncStarted = performance.now();
  applyPeersToScene(scene, incoming, { charPrefix: 'pr', sceneName: 'plaza' });
  const syncMs = performance.now() - syncStarted;

  const renderStarted = performance.now();
  for (let frame = 0; frame < frames; frame += 1) {
    updateScenePeers(scene, frame * (1000 / 60), { charPrefix: 'pr' });
  }
  const renderMs = performance.now() - renderStarted;

  let distanceSamples = 0;
  const bus = {
    emit(_name, payload) {
      distanceSamples += Object.keys(payload).length;
    },
  };
  const distanceStarted = performance.now();
  for (let pass = 0; pass < distancePasses; pass += 1) emitPeerDistances(scene, bus);
  const distanceMs = performance.now() - distanceStarted;

  const round = (value) => Number(value.toFixed(3));
  return {
    peerCount,
    frames,
    distancePasses,
    displayObjects: counters.displayObjects,
    labelPositionWrites: counters.positionWrites,
    textureWrites: counters.textureWrites,
    distanceSamples,
    syncMs: round(syncMs),
    renderMs: round(renderMs),
    distanceMs: round(distanceMs),
    totalMs: round(syncMs + renderMs + distanceMs),
    cullingVerdict: '수십 명은 불필요; 100명대부터 뷰포트 컬링 재측정',
  };
}
