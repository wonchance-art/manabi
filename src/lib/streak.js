import { supabase } from './supabase';

/**
 * 학습 활동(단어 저장, 복습)이 발생했을 때 호출.
 * 오늘 이미 업데이트됐으면 DB 함수 내부에서 무시됨.
 * 기존 학습 경로 전용이다. FSRS는 grade 트랜잭션에 활동이 포함되므로 여기서 재적립하지 않는다.
 * onUpdate 콜백은 SELECT-only 프로필 refresh여야 한다.
 *
 * 같은 계정의 연이은 호출은 RPC를 다시 보내지 않는다(STREAK-DEDUPE-001, 2026-10-17 KST). /study는 문항마다
 * recordStudyReviewCompleted → recordActivityRemote로 여기를 불러 세션 하나에 update_streak가 문항 수만큼(합성 로그인 실측 9회)
 * 나갔다 — RPC는 멱등이라 결과는 같고 왕복만 늘었다. 마지막 성공이 ACTIVITY_DEDUPE_MS 안이고 UTC 날짜 · 기기 날짜가 둘 다 같을 때만
 * 건너뛴다(DB의 활동 일자는 설치마다 UTC로 검증된 것만 믿을 수 있어 날짜 경계 근처는 그대로 보낸다). 동시에 온 호출은 한 RPC를 같이 기다린다.
 * 건너뛰어도 onUpdate(프로필 SELECT)는 부른다 — 결과 화면의 스트릭 숫자를 그 콜백으로 갱신하는 호출자가 있다.
 */
export const ACTIVITY_DEDUPE_MS = 10 * 60 * 1000;
const lastSuccess = new Map(); // userId → { at, utc, local }
const inflight = new Map(); // userId → Promise<boolean>
const dayKeys = now => ({ utc: now.toISOString().slice(0, 10), local: `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}` });

export async function recordActivity(userId, onUpdate, { now = new Date() } = {}) {
  if (!userId) return;
  const keys = dayKeys(now), last = lastSuccess.get(userId);
  if (last && now.getTime() - last.at >= 0 && now.getTime() - last.at < ACTIVITY_DEDUPE_MS && last.utc === keys.utc && last.local === keys.local) {
    if (onUpdate) await onUpdate();
    return true;
  }
  let pending = inflight.get(userId);
  if (!pending) {
    pending = supabase.rpc('update_streak', { uid: userId }).then(({ error }) => {
      if (!error) lastSuccess.set(userId, { at: now.getTime(), ...keys });
      return !error;
    }).finally(() => { inflight.delete(userId); });
    inflight.set(userId, pending);
  }
  const ok = await pending;
  if (ok && onUpdate) await onUpdate();
  return ok;
}

/** 단위 계약 · 로그아웃 정리용 — 기억한 성공을 비운다. */
export function forgetActivityDedupe() { lastSuccess.clear(); inflight.clear(); }
