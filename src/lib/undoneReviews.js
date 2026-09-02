/**
 * 되돌린 채점 제외 — W 후속 ② (W R2 설계 §후속, #1077 5504350927).
 *
 * review_events는 RLS가 SELECT·INSERT뿐이라 undo가 원 이벤트를 못 지운다. 대신 세 undo 지점
 * (복습 화면·인라인·퀘스트)이 같은 모양의 보상 이벤트를 남긴다:
 *   { source:'ui', item_key, correct:true, detail:{ qtype:'undo', undo_of:{ item_key, rating, reviewed_at } } }
 * 보상 이벤트 자체는 isGradedReviewEvent(ui 제외)가 이미 거르지만, **되돌린 원 이벤트는 그대로
 * 집계된다** — 주간 리포트·산출 단어·약점·헷갈림 큐·숙련 rung이 취소한 채점을 센다. 이 모듈이
 * 그 이음새를 닫는다: 원 이벤트는 (item_key, created_at)이 undo_of의 (item_key, reviewed_at)과
 * 같은 행이다(온라인 경로가 reviewedAt을 created_at으로 실어 보내는 계약 — progressStore·
 * useInlineReview·QuestReview). 시각 비교는 epoch ms — PostgREST가 돌려주는 '+00:00' 표기와
 * 클라이언트가 보낸 'Z' 표기는 문자열로는 다르다.
 *
 * 순수 모듈 — 조회는 undoneReviewsRows.js(마커 전용 조회)와 각 로더 몫.
 */

/** undo 보상 이벤트인가 — 세 지점 공통 모양(source ui + qtype undo + undo_of). */
export function isUndoEvent(e) {
  return !!e && e.source === 'ui' && e.detail?.qtype === 'undo' && !!e.detail?.undo_of;
}

function keyOf(itemKey, ts) {
  if (!itemKey || !ts) return null;
  const ms = new Date(ts).getTime();
  return `${itemKey}|${Number.isFinite(ms) ? ms : String(ts)}`;
}

/** 마커들이 가리키는 원 채점 키 집합 — reviewed_at 없는 마커는 아무것도 가리키지 않는다. */
export function undoneKeySet(markers) {
  const set = new Set();
  for (const m of markers || []) {
    if (!isUndoEvent(m)) continue;
    const k = keyOf(m.detail.undo_of.item_key ?? m.item_key, m.detail.undo_of.reviewed_at);
    if (k) set.add(k);
  }
  return set;
}

/**
 * 되돌린 원 이벤트와 undo 마커를 뺀 배열. undo가 하나도 없으면 입력 배열 그대로.
 * @param {Array} events - 소비처가 집계할 행들(item_key·created_at 필요)
 * @param {Array} [markers=events] - undo 마커 출처. 로더가 detail 없이 긁거나 source를 좁혀 긁는
 *   경우(주간 리포트·헷갈림 큐) 마커 전용 조회 결과를 따로 넘긴다; 생략하면 events 안의 마커를 쓴다.
 */
export function dropUndoneEvents(events, markers = events) {
  const list = Array.isArray(events) ? events : [];
  const undone = undoneKeySet(markers);
  if (undone.size === 0 && !list.some(isUndoEvent)) return list;
  return list.filter((e) => !isUndoEvent(e) && !undone.has(keyOf(e?.item_key, e?.created_at)));
}
