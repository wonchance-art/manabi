import { supabase } from './supabase';

/**
 * 학습 활동(단어 저장, 복습)이 발생했을 때 호출.
 * 오늘 이미 업데이트됐으면 DB 함수 내부에서 무시됨.
 * 기존 학습 경로 전용이다. FSRS는 grade 트랜잭션에 활동이 포함되므로 여기서 재적립하지 않는다.
 * onUpdate 콜백은 SELECT-only 프로필 refresh여야 한다.
 */
export async function recordActivity(userId, onUpdate) {
  if (!userId) return;
  const { error } = await supabase.rpc('update_streak', { uid: userId });
  if (!error && onUpdate) await onUpdate();
  return !error;
}
