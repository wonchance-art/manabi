import { supabase } from './supabase';

/**
 * 학습 활동(단어 저장, 복습)이 발생했을 때 호출.
 * 오늘 이미 업데이트됐으면 DB 함수 내부에서 무시됨.
 * onUpdate 콜백이 주어지면 DB 업데이트 후 실행 (e.g. fetchProfile).
 */
export async function recordActivity(userId, onUpdate) {
  if (!userId) return;
  const { error } = await supabase.rpc('update_streak', { uid: userId });
  if (!error && onUpdate) onUpdate();
}
