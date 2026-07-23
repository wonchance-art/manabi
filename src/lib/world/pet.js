/**
 * '학습 월드' 펫 상태 파생 라이브러리 — rung과 같은 철학:
 * 펫의 레벨·XP·기분은 review_events에서 유도되는 값일 뿐, 저장 컬럼이 아니다.
 * FSRS(간격 반복)·rung(숙련 사다리) 계산에는 절대 간섭하지 않는다 — 순수 조회·순수 함수만.
 *
 * 소유 파일: 이 모듈과 __tests__/worldPet.test.js. 다른 학습 로직은 건드리지 않는다.
 */

import { PET_STORAGE_KEY } from './storageSchema.js';

/** 선택 가능한 펫 종 — 순서가 선택 UI 노출 순서. */
export const PET_SPECIES = [
  { key: 'dog', emoji: '🐕', name: '멍이' },
  { key: 'cat', emoji: '🐈', name: '냥이' },
  { key: 'rabbit', emoji: '🐰', name: '토토' },
  { key: 'fox', emoji: '🦊', name: '여우' },
  { key: 'turtle', emoji: '🐢', name: '거북' },
];

export { PET_STORAGE_KEY };
const DEFAULT_PET_KEY = 'dog';

/**
 * 저장된 펫 선택 조회 — SSR 안전(window 없으면 기본값).
 * 손상되었거나 목록에 없는 값은 기본값으로 취급한다.
 * @returns {string} PET_SPECIES의 key 중 하나
 */
export function getPetChoice() {
  if (typeof window === 'undefined') return DEFAULT_PET_KEY;
  try {
    const saved = window.localStorage.getItem(PET_STORAGE_KEY);
    return PET_SPECIES.some(p => p.key === saved) ? saved : DEFAULT_PET_KEY;
  } catch {
    return DEFAULT_PET_KEY;
  }
}

/**
 * 펫 선택 저장 — SSR 안전, 알 수 없는 key는 무시.
 * @param {string} key - PET_SPECIES의 key 중 하나
 */
export function setPetChoice(key) {
  if (typeof window === 'undefined') return;
  if (!PET_SPECIES.some(p => p.key === key)) return;
  try {
    window.localStorage.setItem(PET_STORAGE_KEY, key);
  } catch {
    // 저장 실패(사생활 모드 등)는 조용히 무시 — 펫은 다음 방문 시 기본값으로 보임
  }
}

/**
 * 레벨 n → n+1에 필요한 누적 정답 수(그 레벨 '안에서'의 요구치).
 * 1레벨(레벨 1→2)은 10문항, 이후 레벨마다 +5씩 완만히 증가(10, 15, 20, 25 …).
 * 순수 계단식 선형 증가 — 초반 성취감은 빠르게, 후반은 서서히 늘어나는 손맛을 준다.
 * @param {number} level - 현재 레벨(1부터)
 * @returns {number} 그 레벨에서 다음 레벨까지 필요한 정답 수
 */
function levelRequirement(level) {
  return 10 + Math.max(0, level - 1) * 5;
}

/**
 * 학습 이벤트 파생값 → 펫 상태.
 * level/xp/xpToNext: totalCorrect(누적 정답)를 levelRequirement 계단으로 나눠 유도.
 * mood: 오늘 학습량(todayCorrect)·오늘 세션 여부(sessionsToday)로 3분기.
 *   - todayCorrect === 0 이고 오늘 세션도 없으면 'sleepy'
 *   - todayCorrect 10개 이상, 또는 오늘 세션이 있으면(sessionsToday>0) 'excited' (우선)
 *   - 그 외(1~9개, 세션 없음)는 'happy'
 * @param {{totalCorrect?: number, todayCorrect?: number, sessionsToday?: number}} input
 * @returns {{level: number, xp: number, xpToNext: number, mood: 'sleepy'|'happy'|'excited'}}
 */
export function derivePetState({ totalCorrect = 0, todayCorrect = 0, sessionsToday = 0 } = {}) {
  let level = 1;
  let remaining = Math.max(0, Number(totalCorrect) || 0);
  let need = levelRequirement(level);
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = levelRequirement(level);
  }

  let mood;
  if (todayCorrect >= 10 || sessionsToday > 0) mood = 'excited';
  else if (todayCorrect >= 1) mood = 'happy';
  else mood = 'sleepy';

  return { level, xp: remaining, xpToNext: need, mood };
}

/** KST 기준 오늘 0시의 UTC ISO 문자열 (review_events.created_at 하한 — growthStats.kstWeekStartIso와 동일 기법의 일 단위 버전). */
function kstTodayStartIso(nowMs = Date.now()) {
  const kst = new Date(nowMs + 9 * 3600 * 1000);
  const dayStartUtcMs = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600 * 1000;
  return new Date(dayStartUtcMs).toISOString();
}

/**
 * 펫 파생에 필요한 입력을 review_events에서 가볍게 조회한다.
 * 행 데이터는 가져오지 않고 count(head:true)만 쓴다 — FSRS/rung 계산과 무관, 순수 집계 조회.
 * 실패(에러·예외) 시 조용히 {0,0,0}을 반환해 펫 표시가 학습 흐름을 막지 않게 한다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<{totalCorrect: number, todayCorrect: number, sessionsToday: number}>}
 */
export async function fetchPetInputs(supabase, userId) {
  const empty = { totalCorrect: 0, todayCorrect: 0, sessionsToday: 0 };
  if (!supabase || !userId) return empty;
  try {
    const todayIso = kstTodayStartIso();
    const [totalRes, todayRes, sessionRes] = await Promise.all([
      supabase.from('review_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('source', 'vocab').eq('correct', true),
      supabase.from('review_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('source', 'vocab').eq('correct', true).gte('created_at', todayIso),
      supabase.from('review_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('source', 'vocab').gte('created_at', todayIso),
    ]);
    if (totalRes.error || todayRes.error || sessionRes.error) return empty;
    return {
      totalCorrect: totalRes.count || 0,
      todayCorrect: todayRes.count || 0,
      sessionsToday: (sessionRes.count || 0) > 0 ? 1 : 0,
    };
  } catch {
    return empty;
  }
}
