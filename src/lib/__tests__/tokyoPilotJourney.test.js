import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_ACTION_KIND,
  LANGUAGE_ASSIST_LEVEL,
  LANGUAGE_OUTCOME,
  TOKYO_PILOT_INTERACTION,
  TOKYO_PILOT_JOURNEY_ID,
  TOKYO_PILOT_PHASE,
  applyTokyoPilotEvent,
  createTokyoPilotJourney,
  restoreTokyoPilotJourney,
  tokyoPilotCheckpoint,
  tokyoPilotCompleted,
  tokyoPilotNextObjective,
} from '../tokyoPilotJourney';

const resolve = (state, interactionId, overrides = {}) => applyTokyoPilotEvent(state, {
  type: 'language-action-resolved',
  interactionId,
  kind: LANGUAGE_ACTION_KIND.COMPOSE,
  outcome: LANGUAGE_OUTCOME.INDEPENDENT,
  assistLevel: LANGUAGE_ASSIST_LEVEL.NONE,
  attempts: 1,
  ...overrides,
});

function reachHanedaPlatform() {
  let state = createTokyoPilotJourney();
  state = applyTokyoPilotEvent(state, { type: 'arrivals-exited' });
  state = resolve(state, TOKYO_PILOT_INTERACTION.RAIL_SIGN, { kind: LANGUAGE_ACTION_KIND.OBSERVE });
  return resolve(state, TOKYO_PILOT_INTERACTION.ASK_SHIBUYA_BOUND);
}

function reachShibuya() {
  let state = reachHanedaPlatform();
  state = applyTokyoPilotEvent(state, { type: 'train-boarded', destinationId: 'shibuya' });
  state = resolve(state, TOKYO_PILOT_INTERACTION.ARRIVAL_ANNOUNCEMENT, { kind: LANGUAGE_ACTION_KIND.LISTEN });
  state = applyTokyoPilotEvent(state, { type: 'train-disembarked', stationId: 'shibuya' });
  return state;
}

describe('도쿄 현지어 파일럿 — 초기 계약', () => {
  it('하네다 도착 상태와 고정 버전으로 시작한다', () => {
    const state = createTokyoPilotJourney();
    expect(state).toMatchObject({
      version: 1,
      journeyId: TOKYO_PILOT_JOURNEY_ID,
      phase: TOKYO_PILOT_PHASE.HANEDA_ARRIVED,
      checkpointId: 'haneda-arrivals',
      visited: ['haneda'],
      completed: false,
    });
  });

  it('상태와 중첩 컬렉션은 외부에서 바꿀 수 없다', () => {
    const state = createTokyoPilotJourney();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.interactions)).toBe(true);
    expect(Object.isFrozen(state.visited)).toBe(true);
    expect(() => state.visited.push('shibuya')).toThrow();
  });
});

describe('도쿄 현지어 파일럿 — 정상 여정', () => {
  it('하네다 표지 관찰부터 질문·승차까지 순서대로 진행한다', () => {
    let state = createTokyoPilotJourney();
    state = applyTokyoPilotEvent(state, { type: 'arrivals-exited' });
    expect(state.phase).toBe(TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL);
    state = resolve(state, TOKYO_PILOT_INTERACTION.RAIL_SIGN, { kind: LANGUAGE_ACTION_KIND.OBSERVE });
    expect(state.phase).toBe(TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION);
    state = resolve(state, TOKYO_PILOT_INTERACTION.ASK_SHIBUYA_BOUND, {
      outcome: LANGUAGE_OUTCOME.COMMUNICATED_MINIMAL,
    });
    expect(state.phase).toBe(TOKYO_PILOT_PHASE.HANEDA_BOARD);
    state = applyTokyoPilotEvent(state, { type: 'train-boarded', destinationId: 'shibuya' });
    expect(state.phase).toBe(TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA);
  });

  it('방송 인식·시부야 하차·길 묻기·주문 뒤 여정을 완주한다', () => {
    let state = reachShibuya();
    expect(state.visited).toEqual(['haneda', 'shibuya']);
    state = applyTokyoPilotEvent(state, { type: 'exit-reached', exitId: 'crossing', correct: true });
    state = applyTokyoPilotEvent(state, { type: 'crossing-reached' });
    state = resolve(state, TOKYO_PILOT_INTERACTION.ASK_DIRECTIONS);
    state = applyTokyoPilotEvent(state, { type: 'cafe-entered' });
    state = resolve(state, TOKYO_PILOT_INTERACTION.CAFE_ORDER, { kind: LANGUAGE_ACTION_KIND.TYPE });
    state = applyTokyoPilotEvent(state, { type: 'meeting-completed' });

    expect(tokyoPilotCompleted(state)).toBe(true);
    expect(tokyoPilotCheckpoint(state)).toBe('complete');
    expect(tokyoPilotNextObjective(state)).toBeNull();
    expect(Object.keys(state.interactions)).toHaveLength(5);
  });

  it('phase에서 체크포인트와 다음 목표를 일관되게 산출한다', () => {
    const state = reachHanedaPlatform();
    expect(tokyoPilotCheckpoint(state)).toBe('haneda-platform');
    expect(tokyoPilotNextObjective(state)).toBe('board-train');
  });
});

describe('도쿄 현지어 파일럿 — 실패 회복', () => {
  it('언어 상호작용의 회복 결과와 지원 수준을 기록한다', () => {
    let state = applyTokyoPilotEvent(createTokyoPilotJourney(), { type: 'arrivals-exited' });
    state = resolve(state, TOKYO_PILOT_INTERACTION.RAIL_SIGN, {
      outcome: LANGUAGE_OUTCOME.RECOVERED,
      assistLevel: LANGUAGE_ASSIST_LEVEL.KEYWORD,
      attempts: 2,
    });
    expect(state.interactions[TOKYO_PILOT_INTERACTION.RAIL_SIGN]).toMatchObject({
      outcome: LANGUAGE_OUTCOME.RECOVERED,
      assistLevel: LANGUAGE_ASSIST_LEVEL.KEYWORD,
      attempts: 2,
    });
    expect(state.mistakes).toEqual([{ interactionId: TOKYO_PILOT_INTERACTION.RAIL_SIGN, recovered: true }]);
  });

  it('시나가와 오하차는 여정을 막지 않고 안전 체크포인트에 남긴다', () => {
    let state = reachHanedaPlatform();
    state = applyTokyoPilotEvent(state, { type: 'train-boarded', destinationId: 'shibuya' });
    state = applyTokyoPilotEvent(state, { type: 'train-disembarked', stationId: 'shinagawa' });
    expect(state.phase).toBe(TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA);
    expect(state.checkpointId).toBe('train-after-shinagawa');
    expect(state.mistakes.at(-1)).toEqual({ interactionId: 'train.wrong-stop', recovered: true });
  });

  it('잘못된 시부야 출구는 같은 단계에서 복귀시킨다', () => {
    const state = applyTokyoPilotEvent(reachShibuya(), {
      type: 'exit-reached', exitId: 'wrong-side', correct: false,
    });
    expect(state.phase).toBe(TOKYO_PILOT_PHASE.SHIBUYA_FIND_EXIT);
    expect(state.mistakes.at(-1)).toEqual({ interactionId: 'shibuya.wrong-exit', recovered: true });
  });
});

describe('도쿄 현지어 파일럿 — fail closed', () => {
  it('순서를 건너뛴 이벤트를 거부한다', () => {
    expect(() => applyTokyoPilotEvent(createTokyoPilotJourney(), { type: 'meeting-completed' }))
      .toThrow(/not allowed/);
    expect(() => applyTokyoPilotEvent(createTokyoPilotJourney(), { type: 'train-boarded', destinationId: 'shibuya' }))
      .toThrow(/not allowed/);
    let train = reachHanedaPlatform();
    train = applyTokyoPilotEvent(train, { type: 'train-boarded', destinationId: 'shibuya' });
    expect(() => applyTokyoPilotEvent(train, { type: 'train-stop-reached', stationId: 'shibuya' }))
      .toThrow(/not allowed/);
  });

  it('알 수 없는 이벤트·목적지·interaction을 거부한다', () => {
    expect(() => applyTokyoPilotEvent(createTokyoPilotJourney(), { type: 'surprise' })).toThrow(/unknown event/);
    expect(() => applyTokyoPilotEvent(reachHanedaPlatform(), { type: 'train-boarded', destinationId: 'ueno' }))
      .toThrow(/destination/);
    const state = applyTokyoPilotEvent(createTokyoPilotJourney(), { type: 'arrivals-exited' });
    expect(() => resolve(state, 'unknown')).toThrow(/unknown interaction/);
  });

  it('시도 횟수와 enum을 엄격히 검증한다', () => {
    const state = applyTokyoPilotEvent(createTokyoPilotJourney(), { type: 'arrivals-exited' });
    expect(() => resolve(state, TOKYO_PILOT_INTERACTION.RAIL_SIGN, { attempts: 0 })).toThrow(/positive integer/);
    expect(() => resolve(state, TOKYO_PILOT_INTERACTION.RAIL_SIGN, { assistLevel: 'answer' })).toThrow(/assist level/);
  });

  it('지원 수준을 낮춘 재기록을 거부한다', () => {
    const saved = {
      ...createTokyoPilotJourney(),
      phase: TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL,
      checkpointId: 'ignored',
      interactions: {
        [TOKYO_PILOT_INTERACTION.RAIL_SIGN]: {
          kind: LANGUAGE_ACTION_KIND.OBSERVE,
          outcome: LANGUAGE_OUTCOME.ASSISTED,
          assistLevel: LANGUAGE_ASSIST_LEVEL.KEYWORD,
          attempts: 1,
        },
      },
    };
    expect(() => resolve(saved, TOKYO_PILOT_INTERACTION.RAIL_SIGN, {
      kind: LANGUAGE_ACTION_KIND.OBSERVE,
      assistLevel: LANGUAGE_ASSIST_LEVEL.READING,
    })).toThrow(/cannot decrease/);
  });
});

describe('도쿄 현지어 파일럿 — 저장·결정성', () => {
  it('JSON 왕복 뒤 상태를 복원하고 체크포인트를 phase에서 바로잡는다', () => {
    const state = reachShibuya();
    const saved = { ...JSON.parse(JSON.stringify(state)), checkpointId: 'tampered' };
    expect(restoreTokyoPilotJourney(saved)).toEqual(state);
  });

  it('잘못된 버전·phase·완료 플래그를 거부한다', () => {
    const state = createTokyoPilotJourney();
    expect(() => restoreTokyoPilotJourney({ ...state, version: 2 })).toThrow(/version/);
    expect(() => restoreTokyoPilotJourney({ ...state, phase: 'tokyo.anywhere' })).toThrow(/phase/);
    expect(() => restoreTokyoPilotJourney({ ...state, completed: true })).toThrow(/completed flag/);
  });

  it('같은 이벤트열은 byte-identical 결과를 만든다', () => {
    const run = () => JSON.stringify(reachShibuya());
    expect(run()).toBe(run());
  });

  it('완료 상태에 후속 이벤트를 적용해도 의미 상태가 불변이다', () => {
    let state = reachShibuya();
    state = applyTokyoPilotEvent(state, { type: 'exit-reached', exitId: 'crossing', correct: true });
    state = applyTokyoPilotEvent(state, { type: 'crossing-reached' });
    state = resolve(state, TOKYO_PILOT_INTERACTION.ASK_DIRECTIONS);
    state = resolve(state, TOKYO_PILOT_INTERACTION.CAFE_ORDER);
    state = applyTokyoPilotEvent(state, { type: 'meeting-completed' });
    expect(applyTokyoPilotEvent(state, { type: 'surprise' })).toEqual(state);
  });
});
