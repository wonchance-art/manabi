export const MONT_SAINT_MICHEL_TIDE_CONTRACT = Object.freeze({
  periodGameMinutes: 745,
  epochLowMinute: 420,
  bands: 8,
  phaseOrder: Object.freeze(['low', 'rising', 'high', 'falling']),
  visualOnly: true,
  collisionEnabled: false,
});

const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

export function montSaintMichelTideAt(totalGameMinutes) {
  if (!Number.isFinite(totalGameMinutes)) throw new TypeError('totalGameMinutes must be finite');
  const {
    periodGameMinutes,
    epochLowMinute,
    bands,
    phaseOrder,
  } = MONT_SAINT_MICHEL_TIDE_CONTRACT;
  const elapsed = mod(totalGameMinutes - epochLowMinute, periodGameMinutes);
  const progress = elapsed / periodGameMinutes;
  const phaseIndex = Math.min(phaseOrder.length - 1, Math.floor(progress * phaseOrder.length));
  const triangularLevel = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
  const band = Math.min(bands - 1, Math.floor(triangularLevel * bands));
  const phase = phaseOrder[phaseIndex];
  return Object.freeze({
    phase,
    band,
    elapsed,
    progress,
    revision: `${phase}:${band}`,
  });
}

export function isMontSaintMichelTidalVisualWater(tide, index, band) {
  if (!tide || !Number.isInteger(index) || index < 0) return false;
  if (!Number.isInteger(band) || band < 0 || band >= MONT_SAINT_MICHEL_TIDE_CONTRACT.bands) return false;
  if (tide.safeCorridorMask?.[index]) return false;
  const rank = tide.tidalRank?.[index];
  return Number.isInteger(rank) && rank >= 0 && rank < MONT_SAINT_MICHEL_TIDE_CONTRACT.bands && rank <= band;
}

export function tideCopyKeyForNode(node, tideState) {
  if (!node?.tideCopyHook || !MONT_SAINT_MICHEL_TIDE_CONTRACT.phaseOrder.includes(tideState?.phase)) return null;
  return tideState.phase;
}
