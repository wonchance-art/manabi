/**
 * 약점 프로파일 재료 조회 (v2-A R1).
 *
 * `fetchWeeklyReportRows`를 넓히지 않고 따로 둔다 — 그쪽은 `source, correct, created_at`
 * 3필드로 2주 2000행을 긁고 학습 그룹 스냅샷 push까지 같은 조회를 쓴다. 태그 유도에
 * 필요한 `item_key`·`detail`을 거기 얹으면 약점 줄과 무관한 경로가 함께 무거워진다
 * (confusedQueue가 전용 조회를 따로 판 것과 같은 결).
 *
 * 실패는 빈 배열 — 약점 줄만 사라지고 나머지 카드는 그대로 그려진다.
 */
import { supabase } from './supabase';
import { WEAKNESS_SINCE_DAYS } from './weaknessProfile';
import { dropUndoneEvents } from './undoneReviews';

/**
 * 최근 채점 이벤트(태그 유도용).
 * @param {string} userId
 * @param {{sinceMs?: number, limit?: number}} [opts] sinceMs 미지정이면 14일
 */
export async function fetchWeaknessRows(userId, { sinceMs, limit = 600 } = {}) {
  if (!userId) return [];
  const since = sinceMs ?? Date.now() - WEAKNESS_SINCE_DAYS * 86400000;
  try {
    const { data, error } = await supabase
      .from('review_events')
      .select('source, item_key, correct, detail, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(since).toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    // 되돌린 채점 제외(W 후속 ②) — source 필터가 없어 마커가 같은 조회에 들어 있다
    return dropUndoneEvents(data || []);
  } catch {
    return [];
  }
}
