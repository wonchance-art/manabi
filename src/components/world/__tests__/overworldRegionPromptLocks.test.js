import { describe, expect, it, vi } from 'vitest';
import { buildOverworldRegionScene } from '../overworldRegionScene.js';

const FakePhaser = {
  Scene: class {
    constructor(sceneId) { this.sceneId = sceneId; }
  },
};

const EMEA = { id: 'emea', sceneId: 'overworld:emea', width: 720, height: 720 };

function makeScene(ctx = {}) {
  const RegionScene = buildOverworldRegionScene(FakePhaser, EMEA, ctx);
  const scene = new RegionScene();
  scene.inputLocked = true; // React 확인 프롬프트가 씬 입력을 잠근 실제 재현 상태.
  scene.enteringCity = false;
  scene.enteringCorridor = false;
  scene.railBoarding = false;
  scene.leavingByAir = false;
  scene.ferrying = false;
  scene.railTrip = null;
  scene.destroyed = false;
  scene.heldDirs = ['up'];
  scene.pTileX = 271;
  scene.pTileY = 490;
  scene.scene = { start: vi.fn() };
  scene.cameras = {
    main: {
      fadeOut: vi.fn(),
      fadeIn: vi.fn(),
      once: vi.fn(),
    },
  };
  return scene;
}

describe('지역 오버월드 확인 프롬프트 락 분리', () => {
  it('cityPrompt 입력 락 중에도 enterCity가 전용 재진입 가드로 제네바 전환을 시작한다', () => {
    const scene = makeScene({ hasCity: (cityId) => cityId === 'geneva' });
    let fadeComplete;
    scene.cameras.main.once.mockImplementation((event, callback) => {
      expect(event).toBe('camerafadeoutcomplete');
      fadeComplete = callback;
    });

    expect(scene.enterCity('geneva')).toBe(true);
    expect(scene.enteringCity).toBe(true);
    expect(scene.heldDirs).toEqual([]);
    expect(scene.cameras.main.fadeOut).toHaveBeenCalledWith(260, 0, 0, 0);
    expect(scene.enterCity('geneva')).toBe(false);
    expect(scene.cameras.main.fadeOut).toHaveBeenCalledTimes(1);

    fadeComplete();
    expect(scene.scene.start).toHaveBeenCalledWith('city:geneva', {
      worldReturn: { scene: 'overworld:emea', x: 271, y: 490 },
    });
  });

  it('ferryPrompt 입력 락도 ferrying 가드와 분리되어 저장·승선 경로를 시작한다', async () => {
    const persistPosition = vi.fn().mockResolvedValue(true);
    const scene = makeScene({ persistPosition, setNearNode: vi.fn(), setStatus: vi.fn() });
    const source = { id: 'port-a', gate: { type: 'ferry', to: 'port-b' } };
    const destination = { id: 'port-b', gate: { type: 'ferry', to: 'port-a' } };
    scene.nearWorldNode = source;
    scene.worldNodeEntries = [{ node: destination, mode: 'ferry', tile: [12, 13] }];
    scene.player = { x: 10, y: 20 };
    const boat = {
      setOrigin: vi.fn().mockReturnThis(),
      setScale: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
    };
    scene.add = { image: vi.fn(() => boat) };
    scene.tweens = { add: vi.fn() };

    await expect(scene.ferryTo('port-b')).resolves.toBe(true);
    expect(persistPosition).toHaveBeenCalledWith({
      scene: 'overworld:emea', x: 12, y: 13,
    });
    expect(scene.ferrying).toBe(true);
    expect(scene.tweens.add).toHaveBeenCalledOnce();
  });

  it('regionGatePrompt 입력 락 중에도 회랑·철도·항공은 각각 전용 가드로 시작한다', async () => {
    const corridorPersist = vi.fn().mockResolvedValue(true);
    const corridor = makeScene({
      canAccessPreviewRegionsRef: { current: true },
      persistPosition: corridorPersist,
      setNearGate: vi.fn(),
      setStatus: vi.fn(),
    });
    corridor.nearGate = { type: 'transsib-gate', corridorStopId: 'moscow' };
    await expect(corridor.enterCorridor()).resolves.toBe(true);
    expect(corridorPersist).toHaveBeenCalledWith({
      scene: 'transsib-corridor', x: 200, y: 8,
    });
    expect(corridor.scene.start).toHaveBeenCalledWith('transsib-corridor', {
      spawn: { scene: 'transsib-corridor', x: 200, y: 8 },
    });

    const railPersist = vi.fn().mockResolvedValue(true);
    const rail = makeScene({ persistPosition: railPersist, setNearGate: vi.fn(), setStatus: vi.fn() });
    rail.nearGate = { id: 'paris-rail-hub', type: 'rail-hub' };
    rail.player = { setVisible: vi.fn().mockReturnThis() };
    await expect(rail.boardRailTo('madrid-rail-hub')).resolves.toBe(true);
    expect(railPersist).toHaveBeenCalledWith({
      scene: 'overworld:emea', x: 115, y: 632,
    });
    expect(rail.railTrip).toMatchObject({
      phase: 'riding', originId: 'paris-rail-hub', terminalId: 'madrid-rail-hub',
    });

    const airSpawn = { scene: 'plaza', x: 57, y: 211 };
    const airPersist = vi.fn().mockResolvedValue(true);
    const air = makeScene({
      airReturnSpawn: () => airSpawn,
      persistPosition: airPersist,
      setNearGate: vi.fn(),
      setStatus: vi.fn(),
    });
    air.nearGate = { type: 'air-gate' };
    await expect(air.leaveByAir()).resolves.toBe(true);
    expect(airPersist).toHaveBeenCalledWith(airSpawn);
    expect(air.scene.start).toHaveBeenCalledWith('world', { spawn: airSpawn });
  });
});
