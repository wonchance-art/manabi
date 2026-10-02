import { TOKYO_PILOT_PHASE } from '../../lib/tokyoPilotJourney.js';
import { getNpcScript } from './npcScripts.js';

const DIALOGS = Object.freeze({
  'haneda-station-agent': Object.freeze({
    phase: TOKYO_PILOT_PHASE.HANEDA_ASK_DESTINATION,
    npcKey: 'ekiin',
    stepStart: 0,
    stepEnd: 2,
  }),
  'train-arrival-announcement': Object.freeze({
    phase: TOKYO_PILOT_PHASE.TRAIN_SHINAGAWA,
    npcKey: 'ekiin',
    stepStart: 2,
    stepEnd: 4,
  }),
  'shibuya-direction-npc': Object.freeze({
    phase: TOKYO_PILOT_PHASE.SHIBUYA_ASK_DIRECTIONS,
    npcKey: 'tokyo-central-east-bookstore',
    stepStart: 0,
    stepEnd: 4,
  }),
  'shibuya-cafe-order': Object.freeze({
    phase: TOKYO_PILOT_PHASE.SHIBUYA_CAFE_ORDER,
    npcKey: 'tokyo-yamanote-west-cafe',
    stepStart: 0,
    stepEnd: null,
  }),
});

export function tokyoPilotDialogForAnchor(anchorId, phase) {
  const dialog = DIALOGS[anchorId];
  if (!dialog || dialog.phase !== phase) return null;
  const script = getNpcScript(dialog.npcKey);
  if (!script) return null;
  return Object.freeze({
    id: anchorId,
    name: script.label,
    npc: dialog.npcKey,
    noStamp: true,
    pilotInteraction: true,
    stepStart: dialog.stepStart,
    stepEnd: dialog.stepEnd,
  });
}
