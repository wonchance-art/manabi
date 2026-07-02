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

/**
 * 마이크로배치 큐 — 문항을 하나씩 쌓다 size개가 되면 flush.
 * 세션 중도 이탈에도 최근 기록이 남도록 문항 확정(settle) 시점에 조금씩 보낸다.
 * @param {string} userId
 * @param {{size?: number, flush?: (userId: string, events: Array) => void}} [opts]
 *   flush는 테스트 주입용 — 기본은 logReviewEvents.
 */
export function createReviewEventBatcher(userId, { size = 4, flush = logReviewEvents } = {}) {
  let buffer = [];
  return {
    /** 이벤트 하나 추가 — 임계치에 닿으면 즉시 flush */
    add(event) {
      if (!event) return;
      buffer.push(event);
      if (buffer.length >= size) this.flush();
    },
    /** 잔여 이벤트 강제 flush (세션 종료·마지막 문항) */
    flush() {
      if (buffer.length === 0) return;
      const pending = buffer;
      buffer = [];
      flush(userId, pending);
    },
    /** 테스트·디버그용 현재 대기 개수 */
    get size() { return buffer.length; },
  };
}
