import { describe, expect, it, vi } from 'vitest';
import { buildTranssibCorridorScene } from '../transsibCorridorScene.js';
import {
  confirmCorridorTerminalPersistence,
  corridorLogoutFallback,
  corridorStopSpawn,
  corridorTripStateAt,
  prepareCorridorTrip,
} from '../../../lib/world/transsibCorridor.js';
import {
  overworldRegionForCorridorStop,
  overworldRegionSpawnForCorridorStop,
} from '../../../lib/world/overworldRegions.js';
import { WORLD_TIME_SCALE } from '../../../lib/world/worldClock.js';

const FakePhaser = {
  Scene: class {
    constructor(sceneId) { this.sceneId = sceneId; }
  },
};

function deferred() {
  let resolve;
  const promise = new Promise((finish) => { resolve = finish; });
  return { promise, resolve };
}

function fakeActor() {
  return {
    visible: true,
    x: 0,
    y: 0,
    setVisible: vi.fn(function setVisible(visible) { this.visible = visible; return this; }),
    setPosition: vi.fn(function setPosition(x, y) { this.x = x; this.y = y; return this; }),
    setDepth: vi.fn(function setDepth() { return this; }),
  };
}

function makeScene({
  stopId = 'khabarovsk',
  inputLocked = true,
  persistPosition = vi.fn().mockResolvedValue(true),
  worldClockRef = { current: { totalGameMinutes: 0 } },
} = {}) {
  const setNearStop = vi.fn();
  const setStatus = vi.fn();
  const requestBoarding = vi.fn();
  const ctx = { worldClockRef, persistPosition, setNearStop, setStatus, requestBoarding };
  const CorridorScene = buildTranssibCorridorScene(FakePhaser, ctx);
  const scene = new CorridorScene();
  const spawn = corridorStopSpawn(stopId);

  Object.assign(scene, {
    inputLocked,
    boarding: false,
    leavingRegion: false,
    disembarking: false,
    pendingDisembark: null,
    heldDirs: ['up'],
    moving: false,
    trip: null,
    currentTripState: null,
    currentStopId: stopId,
    nearStopId: stopId,
    pTileX: spawn.x,
    pTileY: spawn.y,
    lastStatusKey: '',
    player: fakeActor(),
    train: fakeActor(),
    cameras: { main: { stopFollow: vi.fn(), startFollow: vi.fn() } },
    scene: { start: vi.fn() },
  });

  return { scene, ctx };
}

describe('횡단열차 회랑 전환 상태기계', () => {
  it('CSM-1: 프롬프트 입력 락 중에도 전용 가드로 지역 이탈을 한 번만 저장한다', async () => {
    const save = deferred();
    const persistPosition = vi.fn(() => save.promise);
    const { scene, ctx } = makeScene({ stopId: 'vladivostok', persistPosition });

    const leaving = scene.leaveToRegion();
    expect(scene.leavingRegion).toBe(true);
    expect(scene.heldDirs).toEqual([]);
    expect(persistPosition).toHaveBeenCalledWith(overworldRegionSpawnForCorridorStop('vladivostok'));
    await expect(scene.leaveToRegion()).resolves.toBe(false);
    expect(persistPosition).toHaveBeenCalledTimes(1);

    save.resolve(true);
    await expect(leaving).resolves.toBe(true);
    const region = overworldRegionForCorridorStop('vladivostok');
    expect(ctx.setStatus).toHaveBeenLastCalledWith(null);
    expect(scene.scene.start).toHaveBeenCalledWith(region.sceneId, {
      spawn: overworldRegionSpawnForCorridorStop('vladivostok'),
    });
  });

  it('CSM-2: 탑승 선저장 중 프롬프트 락이 풀려도 반대 종착역 요청을 중복 실행하지 않는다', async () => {
    const save = deferred();
    const persistPosition = vi.fn(() => save.promise);
    const { scene, ctx } = makeScene({ persistPosition });

    const boarding = scene.boardTo('moscow');
    expect(scene.boarding).toBe(true);
    expect(persistPosition).toHaveBeenCalledWith(corridorStopSpawn('moscow'));

    scene.inputLocked = false; // React 프롬프트 close effect가 공용 락을 해제하는 실제 순서.
    expect(scene.corridorInteract()).toBe(false);
    await expect(scene.boardTo('vladivostok')).resolves.toBe(false);
    expect(ctx.requestBoarding).not.toHaveBeenCalled();
    expect(persistPosition).toHaveBeenCalledTimes(1);

    save.resolve(true);
    await expect(boarding).resolves.toBe(true);
    expect(scene.trip).toMatchObject({ originId: 'khabarovsk', terminalId: 'moscow' });
    expect(corridorLogoutFallback(scene.trip)).toEqual(corridorStopSpawn('moscow'));
    expect(scene.boarding).toBe(false);
  });

  it('CSM-3: 11.7초 정차 경계를 넘겨도 실패한 중간역 하차를 같은 위치로 재시도한다', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const worldClockRef = { current: {} };
      Object.defineProperty(worldClockRef.current, 'totalGameMinutes', {
        get: () => 18 + (Date.now() / 60_000) * WORLD_TIME_SCALE,
      });
      const firstSave = deferred();
      const persistPosition = vi.fn()
        .mockImplementationOnce(() => firstSave.promise)
        .mockResolvedValueOnce(true);
      const { scene, ctx } = makeScene({ stopId: 'vladivostok', persistPosition, worldClockRef });
      const prepared = prepareCorridorTrip({
        originId: 'vladivostok', terminalId: 'moscow', nowMinute: 0,
      });
      scene.trip = confirmCorridorTerminalPersistence(prepared, corridorStopSpawn('moscow'));
      scene.currentTripState = corridorTripStateAt(scene.trip, worldClockRef.current.totalGameMinutes);
      expect(scene.currentTripState).toMatchObject({ phase: 'stopped', stopId: 'khabarovsk' });

      const firstAttempt = scene.disembarkCurrent();
      expect(ctx.setStatus).toHaveBeenLastCalledWith({
        phase: 'saving-stop', stopId: 'khabarovsk', message: '하차 위치를 저장하고 있어요.',
      });

      vi.advanceTimersByTime(11_750);
      scene.syncTrip();
      expect(scene.currentTripState.phase).toBe('riding');
      expect(ctx.setStatus).toHaveBeenCalledTimes(1);

      firstSave.resolve(false);
      await expect(firstAttempt).resolves.toBe(false);
      expect(ctx.setStatus).toHaveBeenLastCalledWith(expect.objectContaining({
        phase: 'error',
        stopId: 'khabarovsk',
        retry: 'disembark',
        message: '하차 위치를 저장하지 못했어요. Ⓐ 다시 하차할 수 있어요.',
      }));
      expect(scene.pendingDisembark?.state.stopId).toBe('khabarovsk');

      await expect(scene.corridorInteract()).resolves.toBe(true);
      expect(persistPosition).toHaveBeenCalledTimes(2);
      expect(persistPosition).toHaveBeenNthCalledWith(1, corridorStopSpawn('khabarovsk'));
      expect(persistPosition).toHaveBeenNthCalledWith(2, corridorStopSpawn('khabarovsk'));
      expect(scene.trip).toBeNull();
      expect(scene.pendingDisembark).toBeNull();
      expect(scene.currentStopId).toBe('khabarovsk');
      expect(scene.player.visible).toBe(true);
      expect(ctx.setStatus).toHaveBeenLastCalledWith(null);
    } finally {
      vi.useRealTimers();
    }
  });
});
