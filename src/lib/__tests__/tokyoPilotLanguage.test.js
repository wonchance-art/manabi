import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_ACTION_KIND,
  LANGUAGE_ASSIST_LEVEL,
  LANGUAGE_OUTCOME,
  TOKYO_PILOT_INTERACTION,
  applyTokyoPilotEvent,
  createTokyoPilotJourney,
} from '../tokyoPilotJourney';
import {
  TOKYO_PILOT_LANGUAGE_CONTRACT,
  nextTokyoPilotAssistLevel,
  resolveTokyoPilotLanguageAction,
  tokyoPilotLanguageContract,
} from '../tokyoPilotLanguage';

const evaluation = (overrides = {}) => ({
  understood: true,
  minimal: false,
  recovered: false,
  skipped: false,
  assistLevel: LANGUAGE_ASSIST_LEVEL.NONE,
  attempts: 1,
  ...overrides,
});

describe('도쿄 파일럿 현지어 상호작용 계약', () => {
  it('다섯 상호작용의 행동 종류와 최소 의미 신호를 고정한다', () => {
    expect(Object.keys(TOKYO_PILOT_LANGUAGE_CONTRACT)).toEqual(Object.values(TOKYO_PILOT_INTERACTION));
    expect(tokyoPilotLanguageContract(TOKYO_PILOT_INTERACTION.RAIL_SIGN)).toEqual({
      kind: LANGUAGE_ACTION_KIND.OBSERVE,
      minimumSignal: 'rail-direction',
    });
    expect(tokyoPilotLanguageContract(TOKYO_PILOT_INTERACTION.ARRIVAL_ANNOUNCEMENT).kind)
      .toBe(LANGUAGE_ACTION_KIND.LISTEN);
    expect(tokyoPilotLanguageContract(TOKYO_PILOT_INTERACTION.CAFE_ORDER).kind)
      .toBe(LANGUAGE_ACTION_KIND.TYPE);
  });

  it('알 수 없는 상호작용은 fail closed다', () => {
    expect(() => tokyoPilotLanguageContract('tokyo.unknown')).toThrow(/unknown interaction/);
  });

  it.each([
    [{}, LANGUAGE_OUTCOME.INDEPENDENT],
    [{ understood: false, minimal: true }, LANGUAGE_OUTCOME.COMMUNICATED_MINIMAL],
    [{ understood: false, recovered: true, attempts: 2 }, LANGUAGE_OUTCOME.RECOVERED],
    [{ understood: false, skipped: true, assistLevel: LANGUAGE_ASSIST_LEVEL.FULL }, LANGUAGE_OUTCOME.SKIPPED],
    [{ assistLevel: LANGUAGE_ASSIST_LEVEL.KEYWORD }, LANGUAGE_OUTCOME.ASSISTED],
  ])('의미 판정 %o를 진행 outcome %s로 정규화한다', (patch, outcome) => {
    expect(resolveTokyoPilotLanguageAction(
      TOKYO_PILOT_INTERACTION.RAIL_SIGN,
      evaluation(patch),
    )).toMatchObject({
      type: 'language-action-resolved',
      interactionId: TOKYO_PILOT_INTERACTION.RAIL_SIGN,
      kind: LANGUAGE_ACTION_KIND.OBSERVE,
      outcome,
    });
  });

  it('원문 입력과 음성은 여정 경계를 통과시키지 않는다', () => {
    expect(() => resolveTokyoPilotLanguageAction(
      TOKYO_PILOT_INTERACTION.RAIL_SIGN,
      evaluation({ rawText: 'private input' }),
    )).toThrow(/raw text/);
    expect(() => resolveTokyoPilotLanguageAction(
      TOKYO_PILOT_INTERACTION.ARRIVAL_ANNOUNCEMENT,
      evaluation({ audio: new Uint8Array([1]) }),
    )).toThrow(/audio/);
  });

  it('복수 결과·결과 없음·잘못된 시도 횟수를 거부한다', () => {
    const id = TOKYO_PILOT_INTERACTION.RAIL_SIGN;
    expect(() => resolveTokyoPilotLanguageAction(id, evaluation({ minimal: true }))).toThrow(/exactly one/);
    expect(() => resolveTokyoPilotLanguageAction(id, evaluation({ understood: false }))).toThrow(/exactly one/);
    expect(() => resolveTokyoPilotLanguageAction(id, evaluation({ attempts: 0 }))).toThrow(/positive integer/);
  });

  it('지원은 원문→읽기→핵심어→전체 순서로만 열린다', () => {
    expect(nextTokyoPilotAssistLevel(LANGUAGE_ASSIST_LEVEL.NONE)).toBe(LANGUAGE_ASSIST_LEVEL.READING);
    expect(nextTokyoPilotAssistLevel(LANGUAGE_ASSIST_LEVEL.READING)).toBe(LANGUAGE_ASSIST_LEVEL.KEYWORD);
    expect(nextTokyoPilotAssistLevel(LANGUAGE_ASSIST_LEVEL.KEYWORD)).toBe(LANGUAGE_ASSIST_LEVEL.FULL);
    expect(nextTokyoPilotAssistLevel(LANGUAGE_ASSIST_LEVEL.FULL)).toBe(LANGUAGE_ASSIST_LEVEL.FULL);
    expect(() => nextTokyoPilotAssistLevel('answer')).toThrow(/invalid assist/);
  });

  it('정규화 이벤트는 기존 여정 상태기계가 그대로 소비한다', () => {
    let state = applyTokyoPilotEvent(createTokyoPilotJourney(), { type: 'arrivals-exited' });
    const event = resolveTokyoPilotLanguageAction(
      TOKYO_PILOT_INTERACTION.RAIL_SIGN,
      evaluation({ understood: false, minimal: true }),
    );
    state = applyTokyoPilotEvent(state, event);
    expect(state.interactions[TOKYO_PILOT_INTERACTION.RAIL_SIGN]).toEqual({
      kind: LANGUAGE_ACTION_KIND.OBSERVE,
      outcome: LANGUAGE_OUTCOME.COMMUNICATED_MINIMAL,
      assistLevel: LANGUAGE_ASSIST_LEVEL.NONE,
      attempts: 1,
    });
  });

  it('같은 의미 판정은 byte-identical 이벤트를 만든다', () => {
    const build = () => JSON.stringify(resolveTokyoPilotLanguageAction(
      TOKYO_PILOT_INTERACTION.ASK_DIRECTIONS,
      evaluation({ assistLevel: LANGUAGE_ASSIST_LEVEL.READING }),
    ));
    expect(build()).toBe(build());
  });
});
