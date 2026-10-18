import { learningDay } from './fsrsScheduler.js';

// 기존 update_streak의 current_date가 UTC인 것으로 검증된 설치만 이 정책을 활성화한다.
// 신규 문제 예산(KST 04시)·성장 통계(KST 자정)와 별개의 기존 활동 일자다.
export const LEARNING_ACTIVITY_POLICY = Object.freeze({ version: 'streak-freeze-earn-v1', timeZone: 'UTC', rolloverHour: 0 });

export function activityDay(effectiveAt) {
  const day = learningDay(effectiveAt, LEARNING_ACTIVITY_POLICY.timeZone, LEARNING_ACTIVITY_POLICY.rolloverHour);
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

const dayTime = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('invalid_activity_day');
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('invalid_activity_day');
  return time;
};

/** 검증된 baseline 이후 실제 영수증 일자만 재생한다. 저장 시각·구형 이력은 추정하지 않는다. */
export function replayActivityDays(baseline, days) {
  const result = { streak_count: baseline.streak_count ?? null, last_streak_date: baseline.last_streak_date ?? null,
    streak_freeze_count: baseline.streak_freeze_count ?? null };
  for (const field of ['streak_count', 'streak_freeze_count']) {
    if (result[field] !== null && (!Number.isInteger(result[field]) || result[field] < 0 || result[field] > 2147483647)) throw new Error('invalid_activity_profile');
  }
  if (result.last_streak_date !== null) dayTime(result.last_streak_date);
  if (!Array.isArray(days)) throw new Error('invalid_activity_days');
  const ordered = [...new Set(days)].map(day => ({ day, time: dayTime(day) })).sort((a, b) => a.time - b.time);
  for (const { day, time } of ordered) {
    if (result.last_streak_date && day <= result.last_streak_date) continue;
    const gap = result.last_streak_date ? (time - dayTime(result.last_streak_date)) / 86400000 : null;
    const consecutive = gap === 1 || (gap === 2 && result.streak_freeze_count > 0);
    result.streak_freeze_count ??= 0;
    if (consecutive) {
      if (result.streak_count === 2147483647) throw new Error('activity_streak_overflow');
      result.streak_count = (result.streak_count ?? 0) + 1;
      if (gap === 2) result.streak_freeze_count -= 1;
      if (result.streak_count % 7 === 0) result.streak_freeze_count = Math.min(result.streak_freeze_count + 1, 2);
    } else result.streak_count = 1;
    result.last_streak_date = day;
  }
  return result;
}

/**
 * 앱의 실제 login 처리와 독립된 SELECT-only 프로필 갱신. 계정 변경·후착 응답을 버린다.
 *
 * 공유(PROFILE-READ-SHARE-001, 2026-10-17 KST): refresh(actorId, { share: true })는 같은 계정의 **진행 중**이고 **가장 최근**
 * (세대가 그대로인) 읽기가 있으면 새로 보내지 않고 그 결과를 같이 받는다. 세션 경로(getSession · 인증 알림)만 쓴다 —
 * 페이지 로드마다 두 경로가 몇 ms 차이로 같은 select('*')를 보냈다. share가 없는 refresh는 「쓰기 뒤 재읽기」로 보고 늘 새로 읽는다 —
 * 그 읽기가 진행 중 자리를 차지하고 세대를 올리므로, 쓰기 전에 시작된 읽기에는 이후 누구도 합류하지 않는다(쓰기 경계 뒤 읽기만 공유).
 * 세대 검사는 그대로다: 새 읽기 · invalidate가 앞선 읽기의 결과를 버리고, invalidate는 진행 중 읽기도 공유 대상에서 뺀다.
 * 경쟁 순서 표 = __tests__/profileReadShare.test.js 머리말.
 */
export function createProfileReadOnlyRefresh({ getActor, read, onProfile }) {
  let generation = 0, inflight = null;
  async function load(actorId, request) {
    let response;
    try { response = await read(actorId); }
    catch (error) {
      if (request !== generation || getActor() !== actorId) return null;
      throw error;
    }
    const { data, error } = response;
    if (request !== generation || getActor() !== actorId) return null;
    if (error && error.code !== 'PGRST116') throw error;
    if (data && data.id !== actorId) throw new Error('profile_actor_mismatch');
    const profile = error ? null : data ?? null;
    onProfile(profile, actorId);
    return profile;
  }
  return {
    invalidate() { generation += 1; inflight = null; },
    async refresh(actorId, { share = false } = {}) {
      if (!actorId || getActor() !== actorId) return null;
      if (share && inflight && inflight.actorId === actorId && inflight.request === generation) return inflight.promise;
      const request = ++generation;
      const entry = { actorId, request, promise: null };
      entry.promise = load(actorId, request).finally(() => { if (inflight === entry) inflight = null; });
      inflight = entry;
      return entry.promise;
    },
  };
}

/** 명시적 로그인 성공 경로 전용. 서버 callback과 브라우저 로그인은 같은 필드만 기록한다. */
export async function recordExplicitProfileLogin({ client, user, isCurrent = () => true, now = () => new Date() }) {
  const actorId = user?.id;
  if (typeof actorId !== 'string' || !actorId || user.is_anonymous === true || !isCurrent()) return false;
  const { data, error } = await client.from('profiles').select('id').eq('id', actorId).single();
  if (!isCurrent()) return false;
  if (error && error.code !== 'PGRST116') throw error;
  if (data && data.id !== actorId) throw new Error('profile_actor_mismatch');
  if (!data) {
    const metadata = user.user_metadata || {};
    const { error: createError } = await client.from('profiles').upsert([{
      id: actorId,
      display_name: metadata.display_name || metadata.full_name || metadata.name || '새로운 학습자',
    }], { onConflict: 'id', ignoreDuplicates: true });
    if (createError) throw createError;
  }
  if (!isCurrent()) return false;
  const { error: updateError } = await client.from('profiles')
    .update({ last_login_at: now().toISOString() }).eq('id', actorId);
  if (updateError) throw updateError;
  return isCurrent();
}

/** 복습 저장 완료 후 읽기 갱신만 허용한다. 이 결과는 새 활동을 적립할 권한이 아니다. */
export function isSettledFsrsActivity(event, actorId) {
  return Boolean(actorId && event?.accountId === actorId && event.action === 'grade'
    && ['applied', 'replayed'].includes(event.status) && event.operationId
    && event.response?.ok === true && event.response.actorId === actorId
    && event.response.operationId === event.operationId);
}
