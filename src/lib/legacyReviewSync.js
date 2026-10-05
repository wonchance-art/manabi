/** legacy 기록·전송·취소가 공유하는 actor lock과 완전 조회. DB/기기 간 원자성은 별도다. */
const localLocks = new Map();
const unavailable = () => new Error('legacy_review_incomplete');

// FIFO shared batches stop at the first writer, including while readers are active.
function drainLock(name, state) {
  if (state.writer) return;
  while (state.queue.length) {
    const entry = state.queue[0];
    if (entry.mode === 'exclusive' && state.readers) return;
    state.queue.shift();
    if (entry.mode === 'shared') state.readers += 1;
    else state.writer = true;
    const finish = () => {
      if (entry.mode === 'shared') state.readers -= 1;
      else state.writer = false;
      drainLock(name, state);
    };
    Promise.resolve().then(() => {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
      return typeof locks?.request === 'function'
        ? locks.request(name, { mode: entry.mode }, entry.task)
        : entry.task();
    }).then(value => {
      finish(); entry.resolve(value);
    }, error => {
      finish(); entry.reject(error);
    });
    if (state.writer) return;
  }
  if (!state.readers && localLocks.get(name) === state) localLocks.delete(name);
}

function withNamedLock(name, mode, task) {
  let state = localLocks.get(name);
  if (!state) {
    state = { readers: 0, writer: false, queue: [] };
    localLocks.set(name, state);
  }
  return new Promise((resolve, reject) => {
    state.queue.push({ mode, task, resolve, reject });
    drainLock(name, state);
  });
}

/** task 안에서 같은 actor lock을 다시 얻지 않는다. 실패도 다음 작업을 막지 않는다. */
export function withLegacyReviewLock(userId, task, { mode = 'exclusive' } = {}) {
  if (typeof userId !== 'string' || !userId || typeof task !== 'function'
    || !['shared', 'exclusive'].includes(mode)) {
    return Promise.reject(new Error('legacy_review_invalid_lock'));
  }
  return withNamedLock(`manabi:legacy-review:${userId}`, mode, task);
}

/** 온라인 기록은 actor shared + 별도 카드 exclusive. flush/undo는 actor exclusive다. */
export function withLegacyReviewOnlineLock(userId, key, task) {
  if (typeof key !== 'string' || !key || typeof task !== 'function') {
    return Promise.reject(new Error('legacy_review_invalid_lock'));
  }
  return withLegacyReviewLock(userId, () => withNamedLock(
    `manabi:legacy-review-card:${JSON.stringify([userId, key])}`, 'exclusive', task,
  ), { mode: 'shared' });
}

function checkAbort(signal) {
  if (signal?.aborted) {
    const error = new Error('legacy_review_aborted');
    error.name = 'AbortError';
    throw error;
  }
}

/**
 * makeQuery는 매번 같은 filter/select(count:'exact')의 새 query를 만든다.
 * 기본 id 순서; 복합 순서는 orderBy:['created_at','id']. id는 select에 포함한다.
 * 실제 range query는 exact count·고유 id가 필수다. cap보다 작은 응답도 이어 읽는다.
 * range 없는 기존 단일 완전 응답 어댑터는 data/error/(optional count) shape를 유지한다.
 * 실패·count 변화·중복·빈 중간 page·취소에는 배열을 반환하지 않고 reject한다.
 */
export async function readCompleteLegacyRows(makeQuery, {
  pageSize = 1000, orderBy = 'id', signal,
} = {}) {
  const columns = Array.isArray(orderBy) ? orderBy : [orderBy];
  if (typeof makeQuery !== 'function' || !Number.isSafeInteger(pageSize) || pageSize < 1
    || !columns.length || columns.some(column => typeof column !== 'string' || !column)
    || columns.at(-1) !== 'id') throw unavailable();
  const rows = [], ids = new Set();
  let total = null;
  for (;;) {
    checkAbort(signal);
    let query = makeQuery();
    const paginated = typeof query?.range === 'function';
    if (paginated) {
      if (typeof query.order !== 'function') throw unavailable();
      for (const column of columns) query = query.order(column, { ascending: true });
      if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal);
      query = query.range(rows.length, rows.length + pageSize - 1);
    } else if (rows.length) throw unavailable();
    const response = await query;
    checkAbort(signal);
    if (response?.error) throw response.error;
    if (!Array.isArray(response?.data) || response.complete === false) throw unavailable();
    const count = response.count;
    if (paginated || count != null) {
      if (!Number.isSafeInteger(count) || count < 0 || (total !== null && total !== count)) throw unavailable();
      total = count;
    }
    for (const row of response.data) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw unavailable();
      if (row.id == null) { if (paginated || rows.length) throw unavailable(); }
      else {
        if (!['string', 'number', 'bigint'].includes(typeof row.id)
          || (typeof row.id === 'number' && !Number.isSafeInteger(row.id)) || String(row.id) === '') throw unavailable();
        const key = String(row.id);
        if (ids.has(key)) throw unavailable();
        ids.add(key);
      }
    }
    rows.push(...response.data);
    if (total !== null && rows.length > total) throw unavailable();
    if (!paginated) {
      if (total !== null && rows.length !== total) throw unavailable();
      return rows;
    }
    if (rows.length === total) return rows;
    if (!response.data.length) throw unavailable();
  }
}
