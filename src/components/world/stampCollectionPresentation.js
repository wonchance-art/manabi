export const STAMP_FACT_LINE_DURATION_MS = 5200;
export const STAMP_DEFAULT_DURATION_MS = 3500;
export const QUEST_DONE_HEART_DELAYS_MS = Object.freeze([0, 120, 240]);

export function stampCollectionDurationMs(stamp) {
  return stamp?.factLine ? STAMP_FACT_LINE_DURATION_MS : STAMP_DEFAULT_DURATION_MS;
}

export function presentQuestScored(scene, { correct } = {}) {
  if (correct) scene.spawnHeart();
}

export function presentQuestDone(scene) {
  scene.tweens.add({
    targets: scene,
    petJumpVal: 1,
    duration: 220,
    ease: 'Quad.easeOut',
    yoyo: true,
    repeat: 1,
  });
  for (const delay of QUEST_DONE_HEART_DELAYS_MS) {
    scene.time.delayedCall(delay, () => scene.spawnHeart());
  }
}
