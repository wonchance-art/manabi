export const WORLD_TIME_SCALE = 10.25;
export const WORLD_EPOCH_REAL_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
export const WORLD_EPOCH_GAME_MINUTE = 7 * 60;
export const WORLD_DAY_MINUTES = 24 * 60;

const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

export function worldTimeAt(realNowMs = Date.now()) {
  const elapsedRealMinutes = (Number(realNowMs) - WORLD_EPOCH_REAL_MS) / 60_000;
  const totalGameMinutes = WORLD_EPOCH_GAME_MINUTE + elapsedRealMinutes * WORLD_TIME_SCALE;
  const wholeGameMinutes = Math.floor(totalGameMinutes);
  const day = Math.floor(wholeGameMinutes / WORLD_DAY_MINUTES);
  const minuteOfDay = positiveModulo(wholeGameMinutes, WORLD_DAY_MINUTES);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;

  return {
    realNowMs: Number(realNowMs),
    scale: WORLD_TIME_SCALE,
    totalGameMinutes,
    day,
    minuteOfDay,
    hour,
    minute,
    phase: worldPhase(minuteOfDay),
  };
}

export function worldPhase(minuteOfDay) {
  if (minuteOfDay < 300) return 'late-night';
  if (minuteOfDay < 420) return 'dawn';
  if (minuteOfDay < 720) return 'morning';
  if (minuteOfDay < 1020) return 'day';
  if (minuteOfDay < 1140) return 'evening';
  return 'night';
}

export function formatWorldTime(snapshot, locale = 'ko-KR') {
  if (!snapshot) return '--:--';
  const time = `${String(snapshot.hour).padStart(2, '0')}:${String(snapshot.minute).padStart(2, '0')}`;
  if (locale === 'ja-JP') return `${snapshot.day + 1}日目 ${time}`;
  return `${snapshot.day + 1}일 ${time}`;
}

export function realMsUntilGameMinutes(gameMinutes) {
  return Math.max(0, Number(gameMinutes) * 60_000 / WORLD_TIME_SCALE);
}
