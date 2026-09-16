/**
 * 도쿄 현지어 파일럿의 진행 상태기계.
 *
 * Phaser·React·저장소와 무관한 순수 모듈이다. 화면은 이 모듈이 허용한 다음 상태만
 * 소비하고, 실제 대사·정답 판정은 콘텐츠 소유 모듈에 남긴다.
 */

export const TOKYO_PILOT_JOURNEY_ID = 'tokyo-arrival-v1';
export const TOKYO_PILOT_VERSION = 1;

export const TOKYO_PILOT_PHASE = Object.freeze({
  HANEDA_ARRIVED: 'haneda.arrived',
  HANEDA_FIND_RAIL: 'haneda.find-rail',
  HANEDA_ASK_DESTINATION: 'haneda.ask-destination',
  HANEDA_BOARD: 'haneda.board',
  TRAIN_SHINAGAWA: 'train.shinagawa',
  TRAIN_SHIBUYA: 'train.shibuya',
  SHIBUYA_FIND_EXIT: 'shibuya.find-exit',
  SHIBUYA_CROSSING: 'shibuya.crossing',
  SHIBUYA_ASK_DIRECTIONS: 'shibuya.ask-directions',
  SHIBUYA_CAFE_ORDER: 'shibuya.cafe-order',
  COMPLETE: 'complete',
});

export const TOKYO_PILOT_INTERACTION = Object.freeze({
  RAIL_SIGN: 'haneda.rail-sign',
  ASK_SHIBUYA_BOUND: 'haneda.ask-shibuya-bound',
  ARRIVAL_ANNOUNCEMENT: 'train.arrival-announcement',
  ASK_DIRECTIONS: 'shibuya.ask-directions',
  CAFE_ORDER: 'shibuya.cafe-order',
});

export const LANGUAGE_ACTION_KIND = Object.freeze({
  OBSERVE: 'observe',
  CHOOSE: 'choose',
  COMPOSE: 'compose',
  TYPE: 'type',
  LISTEN: 'listen',
});

export const LANGUAGE_ASSIST_LEVEL = Object.freeze({
  NONE: 'none',
  READING: 'reading',
  KEYWORD: 'keyword',
  FULL: 'full',
});

export const LANGUAGE_OUTCOME = Object.freeze({
  INDEPENDENT: 'independent',
  COMMUNICATED_MINIMAL: 'communicated-minimal',
  ASSISTED: 'assisted',
  RECOVERED: 'recovered-after-mistake',
  SKIPPED: 'skipped',
});

const PHASES = new Set(Object.values(TOKYO_PILOT_PHASE));
const INTERACTIONS = new Set(Object.values(TOKYO_PILOT_INTERACTION));
const ACTION_KINDS = new Set(Object.values(LANGUAGE_ACTION_KIND));
const ASSIST_LEVELS = new Set(Object.values(LANGUAGE_ASSIST_LEVEL));
const OUTCOMES = new Set(Object.values(LANGUAGE_OUTCOME));

const CHECKPOINT_BY_PHASE = Object.freeze({
  [TOKYO_PILOT_PHASE.HANEDA_ARRIVED]: 'haneda-arrivals',
  [TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL]: 'haneda-concourse',
  [TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION]: 'haneda-concourse',
  [TOKYO_PILOT_PHASE.HANEDA_BOARD]: 'haneda-platform',
  [TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA]: 'train-after-shinagawa',
  [TOKYO_PILOT_PHASE.TRAIN_SHIBUYA]: 'shibuya-platform',
  [TOKYO_PILOT_PHASE.SHIBUYA_FIND_EXIT]: 'shibuya-platform',
  [TOKYO_PILOT_PHASE.SHIBUYA_CROSSING]: 'shibuya-crossing',
  [TOKYO_PILOT_PHASE.SHIBUYA_ASK_DIRECTIONS]: 'shibuya-crossing',
  [TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER]: 'shibuya-cafe',
  [TOKYO_PILOT_PHASE.COMPLETE]: 'complete',
});

const OBJECTIVE_BY_PHASE = Object.freeze({
  [TOKYO_PILOT_PHASE.HANEDA_ARRIVED]: 'leave-arrivals',
  [TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL]: 'find-rail',
  [TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION]: 'ask-destination',
  [TOKYO_PILOT_PHASE.HANEDA_BOARD]: 'board-train',
  [TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA]: 'continue-to-shibuya',
  [TOKYO_PILOT_PHASE.TRAIN_SHIBUYA]: 'disembark-at-shibuya',
  [TOKYO_PILOT_PHASE.SHIBUYA_FIND_EXIT]: 'find-crossing-exit',
  [TOKYO_PILOT_PHASE.SHIBUYA_CROSSING]: 'reach-crossing',
  [TOKYO_PILOT_PHASE.SHIBUYA_ASK_DIRECTIONS]: 'ask-directions',
  [TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER]: 'order-and-meet',
  [TOKYO_PILOT_PHASE.COMPLETE]: null,
});

const ASSIST_RANK = Object.freeze({ none: 0, reading: 1, keyword: 2, full: 3 });

function assert(condition, message) {
  if (!condition) throw new Error(`tokyoPilotJourney: ${message}`);
}

function unique(values) { return [...new Set(values)]; }

function freezeState(state) {
  const interactions = Object.fromEntries(Object.entries(state.interactions).map(
    ([id, value]) => [id, Object.freeze({ ...value })],
  ));
  return Object.freeze({
    ...state,
    interactions: Object.freeze(interactions),
    mistakes: Object.freeze(state.mistakes.map((mistake) => Object.freeze({ ...mistake }))),
    visited: Object.freeze([...state.visited]),
  });
}

function nextState(state, phase, patch = {}) {
  return freezeState({
    ...state,
    ...patch,
    phase,
    checkpointId: CHECKPOINT_BY_PHASE[phase],
    visited: unique(patch.visited ?? state.visited),
  });
}

export function createTokyoPilotJourney() {
  return freezeState({
    version: TOKYO_PILOT_VERSION,
    journeyId: TOKYO_PILOT_JOURNEY_ID,
    phase: TOKYO_PILOT_PHASE.HANEDA_ARRIVED,
    checkpointId: 'haneda-arrivals',
    interactions: {},
    mistakes: [],
    visited: ['haneda'],
    completed: false,
  });
}

function validateInteraction(id, value) {
  assert(INTERACTIONS.has(id), `unknown interaction: ${String(id)}`);
  assert(value && typeof value === 'object' && !Array.isArray(value), `invalid interaction: ${id}`);
  assert(ACTION_KINDS.has(value.kind), `invalid action kind: ${String(value.kind)}`);
  assert(OUTCOMES.has(value.outcome), `invalid outcome: ${String(value.outcome)}`);
  assert(ASSIST_LEVELS.has(value.assistLevel), `invalid assist level: ${String(value.assistLevel)}`);
  assert(Number.isInteger(value.attempts) && value.attempts >= 1, 'attempts must be a positive integer');
}

export function restoreTokyoPilotJourney(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'saved state must be an object');
  assert(value.version === TOKYO_PILOT_VERSION, `unsupported version: ${String(value.version)}`);
  assert(value.journeyId === TOKYO_PILOT_JOURNEY_ID, `unknown journey: ${String(value.journeyId)}`);
  assert(PHASES.has(value.phase), `unknown phase: ${String(value.phase)}`);
  assert(value.interactions && typeof value.interactions === 'object' && !Array.isArray(value.interactions), 'interactions must be an object');
  for (const [id, interaction] of Object.entries(value.interactions)) validateInteraction(id, interaction);
  assert(Array.isArray(value.mistakes), 'mistakes must be an array');
  assert(Array.isArray(value.visited) && value.visited.every((id) => id === 'haneda' || id === 'shibuya'), 'invalid visited place');
  assert(value.completed === (value.phase === TOKYO_PILOT_PHASE.COMPLETE), 'completed flag does not match phase');

  return freezeState({
    version: TOKYO_PILOT_VERSION,
    journeyId: TOKYO_PILOT_JOURNEY_ID,
    phase: value.phase,
    checkpointId: CHECKPOINT_BY_PHASE[value.phase],
    interactions: Object.fromEntries(Object.entries(value.interactions).map(([id, entry]) => [id, { ...entry }])),
    mistakes: value.mistakes.map((entry) => ({ ...entry })),
    visited: unique(value.visited),
    completed: value.completed,
  });
}

function requirePhase(state, ...allowed) {
  assert(allowed.includes(state.phase), `event is not allowed in phase ${state.phase}`);
}

function applyLanguageAction(state, event) {
  const { interactionId, kind, outcome, assistLevel, attempts } = event;
  validateInteraction(interactionId, { kind, outcome, assistLevel, attempts });

  const existing = state.interactions[interactionId];
  if (existing) {
    assert(ASSIST_RANK[assistLevel] >= ASSIST_RANK[existing.assistLevel], 'assist level cannot decrease');
  }

  const required = {
    [TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL]: TOKYO_PILOT_INTERACTION.RAIL_SIGN,
    [TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION]: TOKYO_PILOT_INTERACTION.ASK_SHIBUYA_BOUND,
    [TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA]: TOKYO_PILOT_INTERACTION.ARRIVAL_ANNOUNCEMENT,
    [TOKYO_PILOT_PHASE.SHIBUYA_ASK_DIRECTIONS]: TOKYO_PILOT_INTERACTION.ASK_DIRECTIONS,
    [TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER]: TOKYO_PILOT_INTERACTION.CAFE_ORDER,
  }[state.phase];
  assert(required === interactionId, `interaction ${interactionId} is not allowed in phase ${state.phase}`);

  const interactions = { ...state.interactions, [interactionId]: { kind, outcome, assistLevel, attempts } };
  const mistakes = outcome === LANGUAGE_OUTCOME.RECOVERED
    ? [...state.mistakes, { interactionId, recovered: true }]
    : state.mistakes;

  const nextPhase = {
    [TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL]: TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION,
    [TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION]: TOKYO_PILOT_PHASE.HANEDA_BOARD,
    [TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA]: TOKYO_PILOT_PHASE.TRAIN_SHIBUYA,
    [TOKYO_PILOT_PHASE.SHIBUYA_ASK_DIRECTIONS]: TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER,
    [TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER]: TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER,
  }[state.phase];
  return nextState(state, nextPhase, { interactions, mistakes });
}

export function applyTokyoPilotEvent(state, event) {
  const current = restoreTokyoPilotJourney(state);
  assert(event && typeof event === 'object' && !Array.isArray(event), 'event must be an object');
  if (current.completed) return current;

  switch (event.type) {
    case 'arrivals-exited':
      requirePhase(current, TOKYO_PILOT_PHASE.HANEDA_ARRIVED);
      return nextState(current, TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL);
    case 'language-action-resolved':
      return applyLanguageAction(current, event);
    case 'gate-tapped':
      requirePhase(current, TOKYO_PILOT_PHASE.HANEDA_BOARD);
      return current;
    case 'train-boarded':
      requirePhase(current, TOKYO_PILOT_PHASE.HANEDA_BOARD);
      assert(event.destinationId === 'shibuya', 'train destination must be shibuya');
      return nextState(current, TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA);
    case 'train-stop-reached':
      requirePhase(current, TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA, TOKYO_PILOT_PHASE.TRAIN_SHIBUYA);
      assert(event.stationId === 'shinagawa' || event.stationId === 'shibuya', 'unknown train stop');
      if (event.stationId === 'shinagawa') {
        requirePhase(current, TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA);
        return current;
      }
      requirePhase(current, TOKYO_PILOT_PHASE.TRAIN_SHIBUYA);
      return nextState(current, TOKYO_PILOT_PHASE.TRAIN_SHIBUYA);
    case 'train-disembarked':
      requirePhase(current, TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA, TOKYO_PILOT_PHASE.TRAIN_SHIBUYA);
      assert(event.stationId === 'shinagawa' || event.stationId === 'shibuya', 'unknown disembark station');
      if (event.stationId === 'shinagawa') {
        return nextState(current, TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA, {
          mistakes: [...current.mistakes, { interactionId: 'train.wrong-stop', recovered: true }],
        });
      }
      return nextState(current, TOKYO_PILOT_PHASE.SHIBUYA_FIND_EXIT, {
        visited: [...current.visited, 'shibuya'],
      });
    case 'exit-reached':
      requirePhase(current, TOKYO_PILOT_PHASE.SHIBUYA_FIND_EXIT);
      assert(typeof event.exitId === 'string' && event.exitId.length > 0, 'exit id is required');
      if (event.correct !== true) {
        return nextState(current, TOKYO_PILOT_PHASE.SHIBUYA_FIND_EXIT, {
          mistakes: [...current.mistakes, { interactionId: 'shibuya.wrong-exit', recovered: true }],
        });
      }
      return nextState(current, TOKYO_PILOT_PHASE.SHIBUYA_CROSSING);
    case 'crossing-reached':
      requirePhase(current, TOKYO_PILOT_PHASE.SHIBUYA_CROSSING);
      return nextState(current, TOKYO_PILOT_PHASE.SHIBUYA_ASK_DIRECTIONS);
    case 'cafe-entered':
      requirePhase(current, TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER);
      assert(Boolean(current.interactions[TOKYO_PILOT_INTERACTION.ASK_DIRECTIONS]), 'directions must be resolved first');
      return current;
    case 'meeting-completed':
      requirePhase(current, TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER);
      assert(Boolean(current.interactions[TOKYO_PILOT_INTERACTION.CAFE_ORDER]), 'cafe order must be resolved first');
      return nextState(current, TOKYO_PILOT_PHASE.COMPLETE, { completed: true });
    default:
      throw new Error(`tokyoPilotJourney: unknown event: ${String(event.type)}`);
  }
}

export function tokyoPilotCheckpoint(state) {
  return restoreTokyoPilotJourney(state).checkpointId;
}

export function tokyoPilotNextObjective(state) {
  return OBJECTIVE_BY_PHASE[restoreTokyoPilotJourney(state).phase];
}

export function tokyoPilotCompleted(state) {
  return restoreTokyoPilotJourney(state).completed;
}
