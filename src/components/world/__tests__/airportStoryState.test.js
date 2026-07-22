import { describe, expect, it, vi } from 'vitest';
import { buildAirportScene } from '../airportScene.js';
import {
  AIRPORT_EXIT_ERROR_MESSAGE,
  airportStoryOverlayVisible,
  requestAirportStoryExit,
  resetAirportStoryState,
} from '../airportStoryState.js';

vi.mock('../QuestReview', () => ({ GBC: { ink: '#1c2118', cream: '#f4edcf' } }));

function resetSetters() {
  return {
    setStoryActive: vi.fn(),
    setStoryPhase: vi.fn(),
    setStoryIdx: vi.fn(),
    setShowKo: vi.fn(),
    setAirHubPrompt: vi.fn(),
    setAirHubStatus: vi.fn(),
    setAirportExitStatus: vi.fn(),
  };
}

describe('공항 스토리 이탈 상태머신', () => {
  it('스토리 상태가 남아도 airport가 아닌 씬에는 오버레이를 렌더하지 않는다', () => {
    expect(airportStoryOverlayVisible('airport', true)).toBe(true);
    expect(airportStoryOverlayVisible('plaza', true)).toBe(false);
    expect(airportStoryOverlayVisible('overworld:asia-pacific', true)).toBe(false);
    expect(airportStoryOverlayVisible('airport', false)).toBe(false);
  });

  it('대화·문답·항공 허브·복귀 토스트 상태를 한 번에 초기화한다', () => {
    const setters = resetSetters();

    resetAirportStoryState(setters);

    expect(setters.setStoryActive).toHaveBeenCalledWith(false);
    expect(setters.setStoryPhase).toHaveBeenCalledWith('none');
    expect(setters.setStoryIdx).toHaveBeenCalledWith(0);
    expect(setters.setShowKo).toHaveBeenCalledWith(false);
    expect(setters.setAirHubPrompt).toHaveBeenCalledWith(null);
    expect(setters.setAirHubStatus).toHaveBeenCalledWith(null);
    expect(setters.setAirportExitStatus).toHaveBeenCalledWith(null);
  });

  it('dev guest는 저장 API를 건너뛰고 즉시 광장 전환을 허용한다', async () => {
    const resetStory = vi.fn();
    const setStatus = vi.fn();
    const persistPosition = vi.fn();
    const transition = vi.fn();

    await expect(requestAirportStoryExit({
      devGuest: true,
      userId: null,
      returnSpawn: { scene: 'plaza', x: 12, y: 8 },
      resetStory,
      setStatus,
      persistPosition,
      transition,
    })).resolves.toBe(true);

    expect(resetStory).toHaveBeenCalledOnce();
    expect(persistPosition).not.toHaveBeenCalled();
    expect(setStatus.mock.calls).toEqual([[{ phase: 'saving' }], [null]]);
    expect(transition).toHaveBeenCalledOnce();
  });

  it('로그인 사용자는 다이얼로그를 먼저 닫고 복귀 좌표 저장 성공 뒤에만 전환한다', async () => {
    let finishSave;
    const persistPosition = vi.fn(() => new Promise((resolve) => { finishSave = resolve; }));
    const resetStory = vi.fn();
    const setStatus = vi.fn();
    const transition = vi.fn();
    const returnSpawn = { scene: 'plaza', x: 21, y: 34 };

    const exit = requestAirportStoryExit({
      devGuest: false,
      userId: 'user-1',
      returnSpawn,
      resetStory,
      setStatus,
      persistPosition,
      transition,
    });

    expect(resetStory).toHaveBeenCalledOnce();
    expect(setStatus).toHaveBeenLastCalledWith({ phase: 'saving' });
    expect(persistPosition).toHaveBeenCalledWith(returnSpawn);
    expect(transition).not.toHaveBeenCalled();

    finishSave(true);
    await expect(exit).resolves.toBe(true);
    expect(setStatus).toHaveBeenLastCalledWith(null);
    expect(transition).toHaveBeenCalledOnce();
  });

  it('저장 실패는 전환하지 않고 연결 안내와 멱등 재시도를 제공한다', async () => {
    const persistPosition = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const resetStory = vi.fn();
    const setStatus = vi.fn();
    const transition = vi.fn();
    const request = () => requestAirportStoryExit({
      devGuest: false,
      userId: 'user-1',
      returnSpawn: { scene: 'plaza', x: 4, y: 7 },
      resetStory,
      setStatus,
      persistPosition,
      transition,
    });

    await expect(request()).resolves.toBe(false);
    expect(transition).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith({
      phase: 'error',
      message: AIRPORT_EXIT_ERROR_MESSAGE,
    });

    await expect(request()).resolves.toBe(true);
    expect(persistPosition).toHaveBeenCalledTimes(2);
    expect(transition).toHaveBeenCalledOnce();
  });

  it('씬 전환 자체가 실패해도 기존 심사 다이얼로그는 다시 열리지 않는다', async () => {
    const resetStory = vi.fn();
    const setStatus = vi.fn();

    await expect(requestAirportStoryExit({
      devGuest: false,
      userId: 'user-1',
      returnSpawn: { scene: 'plaza', x: 2, y: 3 },
      resetStory,
      setStatus,
      persistPosition: vi.fn().mockResolvedValue(true),
      transition: vi.fn(() => { throw new Error('scene unavailable'); }),
    })).resolves.toBe(false);

    expect(resetStory).toHaveBeenCalledOnce();
    expect(setStatus).toHaveBeenLastCalledWith({
      phase: 'error',
      message: AIRPORT_EXIT_ERROR_MESSAGE,
    });
  });

  it('씬은 requestReturn 성공에만 전환하고 실패하면 입력을 다시 연다', async () => {
    class FakeScene { constructor(key) { this.key = key; } }
    const starts = vi.fn();
    const successCtx = {
      requestReturn: vi.fn(async (spawn, transition) => {
        expect(spawn).toEqual({ scene: 'plaza', x: 9, y: 10 });
        transition();
        return true;
      }),
    };
    const AirportScene = buildAirportScene({ Scene: FakeScene }, successCtx);
    const scene = new AirportScene();
    scene.returnSpawn = { scene: 'plaza', x: 9, y: 10 };
    scene.inputLocked = false;
    scene.heldDirs = ['up'];
    scene.tapTile = { x: 1, y: 1 };
    scene.scene = { start: starts };

    await expect(scene.returnPlaza()).resolves.toBe(true);
    expect(starts).toHaveBeenCalledWith('world', { spawn: scene.returnSpawn });
    expect(scene.heldDirs).toEqual([]);
    expect(scene.tapTile).toBeNull();

    const failedCtx = { requestReturn: vi.fn().mockResolvedValue(false) };
    const FailedScene = buildAirportScene({ Scene: FakeScene }, failedCtx);
    const failed = new FailedScene();
    failed.returnSpawn = scene.returnSpawn;
    failed.inputLocked = false;
    failed.heldDirs = [];
    failed.scene = { start: vi.fn() };

    await expect(failed.returnPlaza()).resolves.toBe(false);
    expect(failed.scene.start).not.toHaveBeenCalled();
    expect(failed.inputLocked).toBe(false);
  });
});
