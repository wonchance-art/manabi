/**
 * 도쿄 파일럿의 현지어 판정 결과를 여정 이벤트로 바꾸는 경계.
 *
 * 대사·정답 문자열은 소유하지 않는다. UI/콘텐츠 판정기가 `understood` 같은 의미 결과만
 * 넘기며, 이 모듈은 원문 입력을 받거나 저장하지 않고 진행용 메타데이터만 만든다.
 */

import {
  LANGUAGE_ACTION_KIND,
  LANGUAGE_ASSIST_LEVEL,
  LANGUAGE_OUTCOME,
  TOKYO_PILOT_INTERACTION,
} from './tokyoPilotJourney.js';

export const TOKYO_PILOT_LANGUAGE_CONTRACT = Object.freeze({
  [TOKYO_PILOT_INTERACTION.RAIL_SIGN]: Object.freeze({
    kind: LANGUAGE_ACTION_KIND.OBSERVE,
    minimumSignal: 'rail-direction',
  }),
  [TOKYO_PILOT_INTERACTION.ASK_SHIBUYA_BOUND]: Object.freeze({
    kind: LANGUAGE_ACTION_KIND.COMPOSE,
    minimumSignal: 'destination-and-bound',
  }),
  [TOKYO_PILOT_INTERACTION.ARRIVAL_ANNOUNCEMENT]: Object.freeze({
    kind: LANGUAGE_ACTION_KIND.LISTEN,
    minimumSignal: 'arrival-and-station',
  }),
  [TOKYO_PILOT_INTERACTION.ASK_DIRECTIONS]: Object.freeze({
    kind: LANGUAGE_ACTION_KIND.COMPOSE,
    minimumSignal: 'place-and-location-question',
  }),
  [TOKYO_PILOT_INTERACTION.CAFE_ORDER]: Object.freeze({
    kind: LANGUAGE_ACTION_KIND.TYPE,
    minimumSignal: 'item-and-request',
  }),
});

const ASSIST_LEVELS = new Set(Object.values(LANGUAGE_ASSIST_LEVEL));

function assert(condition, message) {
  if (!condition) throw new Error(`tokyoPilotLanguage: ${message}`);
}

export function tokyoPilotLanguageContract(interactionId) {
  const contract = TOKYO_PILOT_LANGUAGE_CONTRACT[interactionId];
  assert(contract, `unknown interaction: ${String(interactionId)}`);
  return contract;
}

/**
 * 콘텐츠 판정 결과를 개인정보·원문 없는 여정 이벤트로 정규화한다.
 * understood: 의도가 온전히 전달됨, minimal: 핵심어만으로 전달됨,
 * recovered: 앞선 오해 뒤 전달됨, skipped: 전체 보조로 통과함.
 */
export function resolveTokyoPilotLanguageAction(interactionId, evaluation) {
  const contract = tokyoPilotLanguageContract(interactionId);
  assert(evaluation && typeof evaluation === 'object' && !Array.isArray(evaluation), 'evaluation must be an object');
  assert(!Object.hasOwn(evaluation, 'rawText'), 'raw text must not cross the journey boundary');
  assert(!Object.hasOwn(evaluation, 'audio'), 'audio must not cross the journey boundary');

  const attempts = evaluation.attempts;
  const assistLevel = evaluation.assistLevel;
  assert(Number.isInteger(attempts) && attempts >= 1, 'attempts must be a positive integer');
  assert(ASSIST_LEVELS.has(assistLevel), `invalid assist level: ${String(assistLevel)}`);

  const flags = ['understood', 'minimal', 'recovered', 'skipped'];
  for (const flag of flags) assert(typeof evaluation[flag] === 'boolean', `${flag} must be boolean`);
  const successes = flags.filter((flag) => evaluation[flag]);
  assert(successes.length === 1, 'exactly one resolution flag must be true');

  let outcome;
  if (evaluation.recovered) outcome = LANGUAGE_OUTCOME.RECOVERED;
  else if (evaluation.skipped) outcome = LANGUAGE_OUTCOME.SKIPPED;
  else if (evaluation.minimal) outcome = LANGUAGE_OUTCOME.COMMUNICATED_MINIMAL;
  else if (assistLevel === LANGUAGE_ASSIST_LEVEL.NONE) outcome = LANGUAGE_OUTCOME.INDEPENDENT;
  else outcome = LANGUAGE_OUTCOME.ASSISTED;

  return Object.freeze({
    type: 'language-action-resolved',
    interactionId,
    kind: contract.kind,
    outcome,
    assistLevel,
    attempts,
  });
}

/** UI가 힌트를 단계적으로만 열도록 다음 지원 수준을 계산한다. */
export function nextTokyoPilotAssistLevel(level) {
  assert(ASSIST_LEVELS.has(level), `invalid assist level: ${String(level)}`);
  return {
    [LANGUAGE_ASSIST_LEVEL.NONE]: LANGUAGE_ASSIST_LEVEL.READING,
    [LANGUAGE_ASSIST_LEVEL.READING]: LANGUAGE_ASSIST_LEVEL.KEYWORD,
    [LANGUAGE_ASSIST_LEVEL.KEYWORD]: LANGUAGE_ASSIST_LEVEL.FULL,
    [LANGUAGE_ASSIST_LEVEL.FULL]: LANGUAGE_ASSIST_LEVEL.FULL,
  }[level];
}
