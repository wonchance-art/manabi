import { describe, expect, it, vi } from 'vitest';
import {
  LANGUAGE_ASSIST_LEVEL,
  TOKYO_PILOT_PHASE,
} from '../tokyoPilotJourney';
import { TOKYO_PILOT_SCENE } from '../tokyoPilotMap';
import {
  createTokyoPilotController,
  tokyoPilotEventForAnchor,
  tokyoPilotInteractionForState,
  tokyoPilotSceneForState,
} from '../tokyoPilotController';

const understood = {
  understood: true,
  minimal: false,
  recovered: false,
  skipped: false,
  assistLevel: LANGUAGE_ASSIST_LEVEL.NONE,
  attempts: 1,
};

describe('도쿄 파일럿 controller', () => {
  it('공간 anchor와 현지어 판정을 한 여정으로 조율한다', () => {
    const controller = createTokyoPilotController();
    controller.enterAnchor('haneda-arrivals-exit');
    expect(controller.snapshot().phase).toBe(TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL);
    controller.resolveLanguage(understood);
    expect(controller.snapshot().phase).toBe(TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION);
    controller.resolveLanguage(understood);
    expect(controller.snapshot().phase).toBe(TOKYO_PILOT_PHASE.HANEDA_BOARD);
    controller.enterAnchor('haneda-train-door');
    expect(controller.snapshot().phase).toBe(TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA);
    expect(tokyoPilotSceneForState(controller.snapshot())).toBe(TOKYO_PILOT_SCENE.TRAIN);
    controller.resolveLanguage(understood);
    controller.enterAnchor('train-shibuya-door');
    expect(controller.snapshot().phase).toBe(TOKYO_PILOT_PHASE.SHIBUYA_FIND_EXIT);
    expect(tokyoPilotSceneForState(controller.snapshot())).toBe(TOKYO_PILOT_SCENE.SHIBUYA);
  });

  it('언어 interaction이 없는 단계의 판정 요청을 거부한다', () => {
    const controller = createTokyoPilotController();
    expect(() => controller.resolveLanguage(understood)).toThrow(/has no language interaction/);
  });

  it('현재 단계에 맞지 않는 anchor는 상태를 바꾸지 않는다', () => {
    const controller = createTokyoPilotController();
    const before = controller.snapshot();
    expect(controller.enterAnchor('shibuya-meeting')).toBe(before);
    expect(tokyoPilotEventForAnchor(before, 'shibuya-meeting')).toBeNull();
  });

  it('하네다와 시부야 단계의 scene을 결정적으로 선택한다', () => {
    const controller = createTokyoPilotController();
    expect(tokyoPilotSceneForState(controller.snapshot())).toBe(TOKYO_PILOT_SCENE.HANEDA);
    expect(tokyoPilotInteractionForState(controller.snapshot())).toBeNull();

    controller.enterAnchor('haneda-arrivals-exit');
    expect(tokyoPilotInteractionForState(controller.snapshot())).toBe('haneda.rail-sign');
  });

  it('승차와 시부야 하차 때 scene 변경을 통지한다', () => {
    const onSceneChange = vi.fn();
    const onChange = vi.fn();
    const controller = createTokyoPilotController({ onSceneChange, onChange });
    controller.enterAnchor('haneda-arrivals-exit');
    controller.resolveLanguage(understood);
    controller.resolveLanguage(understood);
    controller.enterAnchor('haneda-train-door');
    controller.resolveLanguage(understood);
    controller.enterAnchor('train-shibuya-door');

    expect(onSceneChange).toHaveBeenCalledTimes(2);
    expect(onSceneChange.mock.calls[0][0]).toBe(TOKYO_PILOT_SCENE.TRAIN);
    expect(onSceneChange).toHaveBeenLastCalledWith(TOKYO_PILOT_SCENE.SHIBUYA, controller.snapshot());
    expect(onChange).toHaveBeenCalledTimes(6);
  });

  it('reset은 초기 상태로 복귀하고 외부 초기 상태를 안전하게 복원한다', () => {
    const first = createTokyoPilotController();
    first.enterAnchor('haneda-arrivals-exit');
    const restored = createTokyoPilotController({ initialState: JSON.parse(JSON.stringify(first.snapshot())) });
    expect(restored.snapshot()).toEqual(first.snapshot());
    expect(restored.reset().phase).toBe(TOKYO_PILOT_PHASE.HANEDA_ARRIVED);
  });

  it('메서드를 구조 분해해도 dispatch 결합이 유지된다', () => {
    const controller = createTokyoPilotController();
    const { enterAnchor, resolveLanguage } = controller;
    enterAnchor('haneda-arrivals-exit');
    resolveLanguage(understood);
    expect(controller.snapshot().phase).toBe(TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION);
  });
});
