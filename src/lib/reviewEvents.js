/**
 * 학습 이벤트 로그 (review_events 테이블, append-only)
 * 모든 학습 기능(vocab/grammar/dictation/writing)의 정오답을 한 곳에 모은다 —
 * 약점 진단·맞춤 드릴의 데이터 축. 실패해도 학습 흐름을 막지 않는다(fire-and-forget).
 */
import { supabase } from './supabase.js';
import { assertLegacyFsrsAllowedOnce } from './fsrsLegacyBoundary';
import { postgrestKeepalive } from './keepalive';

/**
 * @param {string} userId
 * @param {Array<{lang: string, source: string, item_key: string, correct: boolean, detail?: Object}>} events
 */
/** 이벤트 → review_events 행(logReviewEvents · 닫힘 전송이 같은 모양을 쓴다). */
function reviewEventRows(userId, events) {
  return (events || [])
    .filter(e => e && e.lang && e.source && e.item_key && typeof e.correct === 'boolean')
    .map(e => ({
      user_id: userId,
      lang: e.lang,
      source: e.source,
      item_key: e.item_key,
      correct: e.correct,
      detail: e.detail ?? null,
      // created_at은 **주면 존중, 안 주면 서버 기본값**(가산 변경 — 기존 14개 호출처 무영향).
      // 미전송 큐(v2-N R2)가 이걸 쓴다: 큐가 시각을 안 실으면 비행기에서 한 복습이
      // 착륙 시각으로 찍혀 14일 창·주 경계·연속 학습일이 전부 밀린다. 그리고 온라인
      // 경로도 같은 시계를 써야 flush의 중복 제거가 성립한다(완전 일치 대조).
      ...(e.created_at ? { created_at: e.created_at } : {}),
    }));
}

/** 쓰기 전에 경계 확인(fsrs_legacy_boundary)이 필요한 행 — 어휘 기록 · 어휘 되돌리기 표식. */
const needsLegacyBoundary = row => row.source === 'vocab' || (row.source === 'ui' && row.detail?.qtype === 'undo');

export function logReviewEvents(userId, events, { strict = false, boundary } = {}) {
  if (!userId || !Array.isArray(events) || events.length === 0) return;
  const rows = reviewEventRows(userId, events);
  if (rows.length === 0) return;
  const write = async () => {
    for (const row of rows) {
      if (needsLegacyBoundary(row)) {
        // boundary = 같은 채점이 방금 받은 경계 증거(progressStore) — 같은 카드 · 표기 · 언어면 나눠 쓰고, 아니면 지금처럼 묻는다(F5②).
        await assertLegacyFsrsAllowedOnce(supabase, { userId, cardId: row.detail?.word_id,
          itemKey: row.detail?.undo_of?.item_key || row.item_key, language: row.lang }, boundary);
      }
    }
    const { error } = await supabase.from('review_events').insert(rows);
    if (error) throw error;
  };
  const result = write();
  return strict ? result : result.catch(() => {});
}

/**
 * 탭이 닫히는 순간(pagehide)의 남은 이벤트 묶음 — 정본 전송(keepalive.postgrestKeepalive — 왜 · best-effort 한계는 거기)으로 보낸다
 * (로그인 감사 2026-10-25 KST §5-2: /study가 탭을 닫을 때 남은 0–3개를 supabase-js 보통 요청으로 보내 사라질 수 있었다).
 * 경계 확인이 필요한 행(어휘 기록)은 닫히는 탭에서 그 확인을 기다릴 수 없으므로 건너뛰지 않고 지금처럼 logReviewEvents로 보낸다.
 * 토큰이 없으면(세션 계정이 아님 · 아직 못 받음) 전부 지금처럼. keepalive를 보낸 행은 다시 보내지 않는다(중복 행 방지 — 유니크 제약 없음).
 * @returns {{ keepalive: number, regular: number }} 각 길로 보낸 행 수(계약 확인용)
 */
export function sendReviewEventsOnHide(userId, events, { accessToken, send = logReviewEvents, ...transport } = {}) {
  if (!userId || !Array.isArray(events) || events.length === 0) return { keepalive: 0, regular: 0 };
  const valid = events.filter(e => reviewEventRows(userId, [e]).length === 1);
  const quick = accessToken ? valid.filter(e => !needsLegacyBoundary(e)) : [];
  const regular = valid.filter(e => !quick.includes(e));
  if (quick.length) {
    postgrestKeepalive({ path: 'review_events', method: 'POST', prefer: 'return=minimal',
      body: reviewEventRows(userId, quick), accessToken, ...transport });
  }
  if (regular.length) send(userId, regular);
  return { keepalive: quick.length, regular: regular.length };
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
    /** 남은 이벤트를 꺼내고 비운다(보내지 않는다) — 닫힘 전송(sendReviewEventsOnHide)이 다른 길로 보낼 때. */
    drain() {
      const pending = buffer;
      buffer = [];
      return pending;
    },
    /** 테스트·디버그용 현재 대기 개수 */
    get size() { return buffer.length; },
  };
}
