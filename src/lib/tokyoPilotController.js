import {
  TOKYO_PILOT_INTERACTION,
  TOKYO_PILOT_PHASE,
  applyTokyoPilotEvent,
  createTokyoPilotJourney,
  restoreTokyoPilotJourney,
} from './tokyoPilotJourney.js';
import { resolveTokyoPilotLanguageAction } from './tokyoPilotLanguage.js';
import { TOKYO_PILOT_SCENE } from './tokyoPilotMap.js';

const INTERACTION_BY_PHASE = Object.freeze({
  [TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL]: TOKYO_PILOT_INTERACTION.RAIL_SIGN,
  [TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION]: TOKYO_PILOT_INTERACTION.ASK_SHIBUYA_BOUND,
  [TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA]: TOKYO_PILOT_INTERACTION.ARRIVAL_ANNOUNCEMENT,
  [TOKYO_PILOT_PHASE.SHIBUYA_ASK_DIRECTIONS]: TOKYO_PILOT_INTERACTION.ASK_DIRECTIONS,
  [TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER]: TOKYO_PILOT_INTERACTION.CAFE_ORDER,
});

const SCENE_BY_PHASE = Object.freeze({
  [TOKYO_PILOT_PHASE.HANEDA_ARRIVED]: TOKYO_PILOT_SCENE.HANEDA,
  [TOKYO_PILOT_PHASE.HANEDA_FIND_RAIL]: TOKYO_PILOT_SCENE.HANEDA,
  [TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION]: TOKYO_PILOT_SCENE.HANEDA,
  [TOKYO_PILOT_PHASE.HANEDA_BOARD]: TOKYO_PILOT_SCENE.HANEDA,
  [TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA]: TOKYO_PILOT_SCENE.TRAIN,
  [TOKYO_PILOT_PHASE.TRAIN_SHIBUYA]: TOKYO_PILOT_SCENE.TRAIN,
  [TOKYO_PILOT_PHASE.SHIBUYA_FIND_EXIT]: TOKYO_PILOT_SCENE.SHIBUYA,
  [TOKYO_PILOT_PHASE.SHIBUYA_CROSSING]: TOKYO_PILOT_SCENE.SHIBUYA,
  [TOKYO_PILOT_PHASE.SHIBUYA_ASK_DIRECTIONS]: TOKYO_PILOT_SCENE.SHIBUYA,
  [TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER]: TOKYO_PILOT_SCENE.SHIBUYA,
  [TOKYO_PILOT_PHASE.COMPLETE]: TOKYO_PILOT_SCENE.SHIBUYA,
});

function assert(condition, message) {
  if (!condition) throw new Error(`tokyoPilotController: ${message}`);
}

export function tokyoPilotSceneForState(state) {
  const restored = restoreTokyoPilotJourney(state);
  return SCENE_BY_PHASE[restored.phase];
}

export function tokyoPilotInteractionForState(state) {
  const restored = restoreTokyoPilotJourney(state);
  return INTERACTION_BY_PHASE[restored.phase] ?? null;
}

/** 공간 anchor가 여정 진행을 일으키는 경우에만 상태기계 이벤트를 반환한다. */
export function tokyoPilotEventForAnchor(state, anchorId) {
  const { phase } = restoreTokyoPilotJourney(state);
  if (phase === TOKYO_PILOT_PHASE.HANEDA_ARRIVED && anchorId === 'haneda-arrivals-exit') {
    return Object.freeze({ type: 'arrivals-exited' });
  }
  if (phase === TOKYO_PILOT_PHASE.HANEDA_BOARD && anchorId === 'haneda-train-door') {
    return Object.freeze({ type: 'train-boarded', destinationId: 'shibuya' });
  }
  if (phase === TOKYO_PILOT_PHASE.TRAIN_SHIBUYA && anchorId === 'train-shibuya-door') {
    return Object.freeze({ type: 'train-disembarked', stationId: 'shibuya' });
  }
  if (phase === TOKYO_PILOT_PHASE.SHIBUYA_FIND_EXIT && anchorId === 'shibuya-crossing-exit') {
    return Object.freeze({ type: 'exit-reached', exitId: 'crossing', correct: true });
  }
  if (phase === TOKYO_PILOT_PHASE.SHIBUYA_CROSSING && anchorId === 'shibuya-crossing') {
    return Object.freeze({ type: 'crossing-reached' });
  }
  if (phase === TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER && anchorId === 'shibuya-meeting') {
    return Object.freeze({ type: 'meeting-completed' });
  }
  return null;
}

export function createTokyoPilotController(options = {}) {
  let state = options.initialState
    ? restoreTokyoPilotJourney(options.initialState)
    : createTokyoPilotJourney();

  const notify = (previousScene) => {
    const sceneId = tokyoPilotSceneForState(state);
    if (sceneId !== previousScene) options.onSceneChange?.(sceneId, state);
    options.onChange?.(state);
    return state;
  };

  const dispatch = (event) => {
    const previousScene = tokyoPilotSceneForState(state);
    state = applyTokyoPilotEvent(state, event);
    return notify(previousScene);
  };

  return Object.freeze({
    snapshot() { return state; },
    reset() {
      const previousScene = tokyoPilotSceneForState(state);
      state = createTokyoPilotJourney();
      return notify(previousScene);
    },
    dispatch,
    resolveLanguage(evaluation) {
      const interactionId = tokyoPilotInteractionForState(state);
      assert(interactionId, `phase ${state.phase} has no language interaction`);
      return dispatch(resolveTokyoPilotLanguageAction(interactionId, evaluation));
    },
    enterAnchor(anchorId) {
      const event = tokyoPilotEventForAnchor(state, anchorId);
      return event ? dispatch(event) : state;
    },
  });
}
