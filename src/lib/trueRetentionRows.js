/**
 * 실제 기억률 재료 조회(TRUE-RET-001 · docs/design/true-retention.md 「조회 계획」) — 계산은 trueRetention.buildTrueRetention 정본.
 *
 *  · 어휘 채점: review_events `source=vocab` — 정본 완전 조회(readCompleteLegacyRows, 주간 리포트와 같은 길: 지금 시각 상한 · created_at, id 순 ·
 *    건수가 흔들리면 1회 다시). detail은 통째로 받지 않고 셈에 쓰는 칸만 경로로 골라 받는다(뜻 · 문장 같은 긴 칸 제외).
 *  · undo 마커: undoneReviewsRows.fetchUndoMarkers 그대로(실패는 빈 배열 — 새 일정 undo는 아래 연산으로도 빠진다).
 *  · 직전 카드: fsrs_operations `kind in (grade, undo)` — previousCard의 상태 · 간격과 undoneOperationId만(본인 RLS SELECT
 *    fsrs_operation_owner · authenticated GRANT SELECT, m09 repair 018).
 * range 'recent' = 대표 기간(지난 30학습일)만 — 현황 진입 때 받는다. 'all' = 처음부터 — 표 모달을 열 때만(1년 · 전체 줄).
 * 채점 · 연산 조회가 끝내 불완전하면 던진다(반쪽 표를 「측정값」으로 보이지 않는다 — 화면은 「—」 · 다시 시도).
 */
import { supabase } from './supabase';
import { readCompleteLegacyRows } from './legacyReviewSync';
import { fetchUndoMarkers } from './undoneReviewsRows';
import { learningDay, learningDayStart } from './fsrsScheduler';
import { TRUE_RETENTION_RECENT_DAYS } from './trueRetention';

export const TRUE_RETENTION_RANGES = Object.freeze(['recent', 'all']);
/** 「전체」의 아래 끝 — 창 없음과 같다(조회 꼴을 하나로 두려고 늘 gte를 건다). */
export const ALL_TIME_FROM = '1970-01-01T00:00:00.000Z';
/** react-query 키 — 언어 칩은 계산에서 거른다(칩을 바꿔도 다시 받지 않는다). */
export const trueRetentionQueryKey = (userId, range) => ['true-retention', userId, range];

/** 짧은 창의 시작 시각 — 오늘 학습일(04시 경계)에서 TRUE_RETENTION_RECENT_DAYS − 1일 전 학습일의 시작. */
export function trueRetentionSinceIso(range, now = Date.now()) {
  if (range !== 'recent') return null;
  return new Date(learningDayStart(learningDay(now) - (TRUE_RETENTION_RECENT_DAYS - 1))).toISOString();
}

// 셈에 쓰는 detail 칸(trueRetention.scheduledAnswer · 직전 간격)만 — 경로 선택은 자료실 상태 폴링(status:processed_json->>status) 선례.
export const TRUE_RETENTION_EVENT_COLUMNS = 'id, source, item_key, correct, created_at, lang, word_id:detail->>word_id, rating:detail->rating, '
  + 'mode:detail->>mode, qtype:detail->>qtype, warmup:detail->warmup, fsrs_operation_id:detail->>fsrs_operation_id, '
  + 'prev_interval_days:detail->prev_interval_days';
export const TRUE_RETENTION_OPERATION_COLUMNS = 'id, kind, received_at, prev_state:operation->previousCard->>state, '
  + 'prev_days:operation->previousCard->>scheduledDays, undone_id:operation->>undoneOperationId';

const DETAIL_KEYS = ['word_id', 'rating', 'mode', 'qtype', 'warmup', 'fsrs_operation_id', 'prev_interval_days'];
function eventRow(row) {
  const detail = {};
  for (const key of DETAIL_KEYS) if (row[key] != null) detail[key] = row[key];
  return { id: row.id, source: row.source, item_key: row.item_key, correct: row.correct, created_at: row.created_at, lang: row.lang, detail };
}
function operationRow(row) {
  return {
    id: row.id,
    kind: row.kind,
    previousCard: row.prev_state ? { state: row.prev_state, scheduledDays: Number(row.prev_days) } : null,
    operation: row.undone_id ? { undoneOperationId: row.undone_id } : {},
  };
}

/**
 * @param {string} userId
 * @param {{ range?: 'recent'|'all', now?: number }} [opts]
 * @returns {Promise<{ events: Array, undoMarkers: Array, operations: Array, now: number, range: string }>}
 */
export async function fetchTrueRetentionRows(userId, { range = 'recent', now = Date.now() } = {}) {
  if (!userId) return { events: [], undoMarkers: [], operations: [], now, range };
  const sinceIso = trueRetentionSinceIso(range, now);
  const untilIso = new Date(now).toISOString();
  const eventsFrom = sinceIso || ALL_TIME_FROM;
  // 정본 완전 조회 꼴(readCompleteLegacyRows(() => supabase.from(...)) — browserQueryTrim ⑥ 계약이 이 꼴로 읽기를 판정한다.
  const readEvents = () => readCompleteLegacyRows(() => supabase.from('review_events').select(TRUE_RETENTION_EVENT_COLUMNS, { count: 'exact' })
    .eq('user_id', userId).eq('source', 'vocab').gte('created_at', eventsFrom).lte('created_at', untilIso),
  { orderBy: ['created_at', 'id'] });
  // 연산은 서버가 받은 시각 — 오프라인 큐로 늦게 받은 채점은 받은 시각 > 채점 시각이라 같은 창에 든다. 기기 시계가 서버보다 앞서
  // 받은 시각이 채점 시각보다 이를 수 있는 창 첫머리만 하루 넉넉히 연다(남는 연산은 짝 이벤트가 없어 셈에 들지 않는다).
  const operationsFrom = sinceIso ? new Date(Date.parse(sinceIso) - 86400000).toISOString() : ALL_TIME_FROM;
  const readOperations = () => readCompleteLegacyRows(() => supabase.from('fsrs_operations').select(TRUE_RETENTION_OPERATION_COLUMNS, { count: 'exact' })
    .eq('user_id', userId).in('kind', ['grade', 'undo']).gte('received_at', operationsFrom).lte('received_at', untilIso),
  { orderBy: ['received_at', 'id'] });
  const [events, operations, undoMarkers] = await Promise.all([
    readEvents().catch(() => readEvents()),
    readOperations().catch(() => readOperations()),
    // 긴 창은 마커도 넉넉히(한 응답 상한 1000) — 새 일정 undo는 연산의 undoneOperationId가 따로 지킨다.
    fetchUndoMarkers(userId, sinceIso ? { sinceIso } : { limit: 1000 }),
  ]);
  return { events: events.map(eventRow), undoMarkers, operations: operations.map(operationRow), now, range };
}
