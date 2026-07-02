/**
 * 학습 이벤트 로그 (review_events 테이블, append-only)
 * 모든 학습 기능(vocab/grammar/dictation/writing)의 정오답을 한 곳에 모은다 —
 * 약점 진단·맞춤 드릴의 데이터 축. 실패해도 학습 흐름을 막지 않는다(fire-and-forget).
 */
import { supabase } from './supabase';

/**
 * @param {string} userId
 * @param {Array<{lang: string, source: string, item_key: string, correct: boolean, detail?: Object}>} events
 */
export function logReviewEvents(userId, events) {
  if (!userId || !Array.isArray(events) || events.length === 0) return;
  const rows = events
    .filter(e => e && e.lang && e.source && e.item_key && typeof e.correct === 'boolean')
    .map(e => ({
      user_id: userId,
      lang: e.lang,
      source: e.source,
      item_key: e.item_key,
      correct: e.correct,
      detail: e.detail ?? null,
    }));
  if (rows.length === 0) return;
  supabase.from('review_events').insert(rows).then(() => {}, () => {});
}
