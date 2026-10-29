'use client';

/**
 * 미전송 복습 큐 (v2-N R2, #1077 — 오너 착수 승인 2026-08-31 "N ㄱㄱ").
 *
 * ── 착수 실측이 범위를 좁혔다
 *
 * R1이 읽기를 메운 뒤 오프라인에서 **이미 되는 것**: 단어장 조회(스냅샷 폴백)·복습
 * 세션 시작(`startSession`의 rung 조회가 실패 폴백을 갖고 있다). 깨지는 건 **쓰기
 * 하나뿐**이다 — 채점하면 `recordReviewCompleted`가 `{ok:false}`를 돌려주고 화면엔
 * 「복습 저장 실패 … 이 단어는 다음에 다시 나와요」가 뜬다. 즉 **채점이 유실된다**.
 * (`/study` 일일 세션은 조립이 `studyMaterials.js` = 서버 전용이라 오프라인이 구조적으로
 *  불가하다. 이 라운드 밖이다.)
 *
 * ── 이 큐가 순진한 재시도와 다른 점 둘
 *
 * ① **복습 시각을 싣는다.** `logReviewEvents`는 `created_at`을 안 보내고 서버 기본값
 *    `now()`에 기댄다. 그대로 재시도하면 비행기에서 한 복습이 **착륙 후 시각**으로
 *    찍혀 14일 창(헷갈린 말·유형 큐·약점 프로파일)·주 경계(주간 리포트)·연속 학습일이
 *    전부 밀린다. 그래서 큐는 `reviewedAt`을 담고 flush가 그걸 `created_at`으로 보낸다.
 *    컬럼은 이미 있고 기본값만 덮는 것이라 **마이그레이션 0**이다.
 *
 * ② **덮어쓰기를 막는다.** 어휘 FSRS 상태는 append가 아니라 UPDATE라, 큐를 재생하면
 *    그 사이 다른 기기에서 한 복습을 되돌릴 수 있다. 그래서 flush 전에 서버의
 *    `last_reviewed_at`을 읽어 **내 복습이 더 최신일 때만** 적용한다(`shouldApplyGrade`).
 *    이벤트는 append-only라 이 조건과 무관하게 항상 실린다 — 기록은 잃지 않는다.
 *
 * ── 왜 TTL이 없나 (R1과 다른 점)
 *
 * R1 캐시는 **파생 사본**이라 낡으면 버리는 게 맞다(TTL 7일). 이 큐가 담은 것은
 * 파생물이 아니라 **원본 이력**이다 — 버리면 그 복습은 세상에서 사라진다. 그래서
 * TTL이나 개수 초과에 따른 자동 삭제를 두지 않는다. 용량 부족은 저장 실패로 알린다.
 */

import { openDb, STORE_OUTBOX } from './offlineCache';
import { loadVocabularyExclusions, findVocabularyExclusion, exclusionKey } from './vocabularyExclusion';
import { isLearningStorageUnavailableError, learningLanguageCapabilities } from './learningCapabilities';
import { assertLegacyFsrsAllowed } from './fsrsLegacyBoundary';
import { withLegacyReviewLock, readCompleteLegacyRows } from './legacyReviewSync';
import { isLegacyReviewSuperseded } from './legacyReviewSupersede';

/** 구버전 크기 산정 계약. 미전송 원본의 삭제 기준으로 사용하지 않는다. */
export const MAX_OUTBOX = 500;
export const LEGACY_REVIEW_UNDO_KIND = 'legacy-review-undo-v1';
const isUndoIntent = entry => entry?.kind === LEGACY_REVIEW_UNDO_KIND;
const problem = code => Object.assign(new Error(code), { code });
const copy = value => JSON.parse(JSON.stringify(value));
const sameTime = (a, b) => Number.isFinite(Date.parse(a)) && Date.parse(a) === Date.parse(b);
/** 같은 순간인가 — 둘 다 없음(한 번도 채점 안 됨)도 같다. */
const sameMoment = (a, b) => (a == null && b == null) || sameTime(a, b);
const undoMatchesGrade = (undo, grade) => isUndoIntent(undo) && undo.userId === grade.userId
  && grade.kind !== 'fsrs-operation-v1' && !isUndoIntent(grade)
  && grade.source === 'vocab' && undo.itemKey === grade.itemKey && undo.lang === grade.lang
  && undo.wordId === grade.detail?.word_id && sameTime(undo.reviewedAt, grade.reviewedAt);
const assertActor = (userId, getAccountId) => {
  if (getAccountId && getAccountId() !== userId) throw problem('legacy_review_account_changed');
};

/* ──────────────────────────────────────────────────────────────
   순수 판정 — IndexedDB와 분리해 실동작을 계약으로 고정한다(R1 pickEvictions 선례).
   ────────────────────────────────────────────────────────────── */

/**
 * 이 채점을 어휘 행에 적용해도 되는가.
 *
 * 서버 행의 `last_reviewed_at`이 내 복습보다 **나중**이면, 그 사이 다른 기기(또는
 * 온라인 복귀 후)에서 더 최신 복습이 있었다는 뜻이라 적용하지 않는다 — 적용하면
 * 최신 상태를 옛 상태로 되돌린다. 서버 행이 없거나 시각이 없으면 적용한다
 * (한 번도 채점된 적 없는 단어).
 *
 * @param {{reviewedAt:string}} entry 큐 항목
 * @param {{last_reviewed_at?:string}|null} serverRow 지금 서버의 그 단어 행
 */
export function shouldApplyGrade(entry, serverRow) {
  const mine = Date.parse(entry?.reviewedAt ?? '');
  if (!Number.isFinite(mine)) return false;
  const theirs = Date.parse(serverRow?.last_reviewed_at ?? '');
  if (!Number.isFinite(theirs)) return true;
  return mine > theirs;
}

/**
 * 큐 항목 → `review_events` 행. **`created_at`이 핵심** — 이게 빠지면 서버가
 * flush 시각을 찍어 14일 창·주 경계·연속일이 전부 밀린다(위 ①).
 */
export function outboxEventRow(entry, userId) {
  return {
    user_id: userId,
    lang: entry.lang,
    source: entry.source,
    item_key: entry.itemKey,
    correct: entry.correct,
    detail: entry.detail ?? null,
    created_at: entry.reviewedAt,
  };
}

/**
 * 이미 서버에 있는 이벤트를 걸러낸다.
 *
 * 유니크 제약이 없어(스키마 변경은 하드리밋) 재전송이 중복 행을 만든다. 중복은
 * 정답률·약점 집계를 부풀리므로, flush가 담긴 시각 구간의 기존 이벤트를 한 번
 * 읽어 **(source, item_key, created_at) 완전 일치**를 건너뛴다. `reviewedAt`이
 * ms 정밀도라 완전 일치는 사실상 '이미 착지한 그 이벤트'다.
 */
export function dedupeEntries(entries, existingRows) {
  const keyOf = row => JSON.stringify([row.source, row.item_key ?? row.itemKey, Date.parse(row.created_at ?? row.reviewedAt)]);
  const wildcard = new Set((existingRows || []).filter(row => row.lang == null).map(keyOf));
  const seen = new Set((existingRows || []).map(row => JSON.stringify([keyOf(row), row.lang])));
  return (entries || []).filter(entry => {
    const base = keyOf(entry), key = JSON.stringify([base, entry.lang]);
    if (wildcard.has(base) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 구버전 호환 계산기. 실제 복습 큐는 이 결과로 삭제하지 않는다. */
export function pickOutboxDrops(entries, { max = MAX_OUTBOX } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length <= max) return [];
  const oldestFirst = [...list].sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt));
  return oldestFirst.slice(0, list.length - max).map((e) => e.seq);
}

/* ──────────────────────────────────────────────────────────────
   IndexedDB — 복습 원본은 캐시와 달리 COMMIT 완료만 저장 성공이다.
   ────────────────────────────────────────────────────────────── */

/** 채점 하나를 큐에 넣는다. 실패하면 호출부가 전진하지 않도록 false를 반환한다. */
export async function enqueueReview(entry) {
  if (!entry?.userId || !entry?.itemKey || !entry?.reviewedAt) return false;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      const read = store.getAll();
      let canceled = false;
      read.onsuccess = () => {
        canceled = (read.result || []).some(undo => undoMatchesGrade(undo, entry));
        if (!canceled) store.add({ ...entry });
      };
      read.onerror = () => reject(read.error || new Error('outbox-read-failed'));
      tx.oncomplete = () => canceled ? reject(problem('legacy_review_canceled')) : resolve();
      tx.onerror = () => reject(tx.error || new Error('outbox-write-failed'));
      tx.onabort = () => reject(tx.error || new Error('outbox-write-aborted'));
    });
    return true;
  } catch {
    return false;
  }
}

/** 이 사용자의 미전송 복습 — 오래된 순. */
export async function pendingReviews(userId, { strict = false, includeSettledUndo = false } = {}) {
  if (!userId) return [];
  try {
    const db = await openDb();
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTBOX, 'readonly');
      const req = tx.objectStore(STORE_OUTBOX).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('outbox-read-failed'));
      tx.onabort = () => reject(tx.error || new Error('outbox-read-aborted'));
    });
    return all
      .filter((e) => e.userId === userId && e.kind !== 'fsrs-operation-v1'
        && (!isUndoIntent(e) || includeSettledUndo || e.status !== 'settled'))
      .sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt));
  } catch (error) {
    if (strict) throw error;
    return [];
  }
}

/**
 * 이전 호출도 같은 전송 lock을 사용한다. 명시적으로 미전송인 원본만 취소한다.
 * 이미 전송/부분 성공했거나 원본이 없으면 full snapshot 보상이 필요하다.
 */
export async function removeOutboxEntry({ userId, itemKey, reviewedAt }) {
  if (!userId || !itemKey || !reviewedAt) return 0;
  return withLegacyReviewLock(userId, async () => {
    return reviewTransaction('readwrite', (store, done, fail) => {
      const read = store.getAll();
      read.onerror = () => fail(read.error || new Error('outbox-read-failed'));
      read.onsuccess = () => {
        const rows = read.result.filter(e => e.userId === userId && !isUndoIntent(e)
          && e.kind !== 'fsrs-operation-v1' && e.itemKey === itemKey && sameTime(e.reviewedAt, reviewedAt));
        const seqs = rows.filter((e) => e.itemKey === itemKey && e.reviewedAt === reviewedAt).map((e) => e.seq);
        if (!rows.length || seqs.length !== rows.length
          || rows.some(e => e.source !== 'vocab' || !e.detail?.word_id || e.remoteAttempted !== false)) {
          fail(Object.assign(new Error('outbox-remove-aborted: full undo snapshot required'),
            { code: 'legacy_review_undo_requires_snapshot' }));
          return;
        }
        for (const e of rows) {
          // 원본 복사본과 tombstone을 같은 거래에 보존한 뒤만 미전송 원본을 제거한다.
          store.add({ kind: LEGACY_REVIEW_UNDO_KIND, userId, itemKey, reviewedAt: e.reviewedAt,
            wordId: e.detail.word_id, lang: e.lang, rating: e.detail.rating ?? null, prev: null,
            originals: [copy(e)], status: 'settled', localOnly: true });
          store.delete(e.seq);
        }
        done(seqs.length);
      };
    });
  });
}

/** 요청 onsuccess가 아닌 transaction COMMIT만 성공이다. */
async function reviewTransaction(mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let result, failure;
    const tx = db.transaction(STORE_OUTBOX, mode);
    tx.oncomplete = () => failure ? reject(failure) : resolve(result);
    tx.onerror = () => reject(failure || tx.error || new Error('outbox-write-failed'));
    tx.onabort = () => reject(failure || tx.error || new Error('outbox-write-aborted'));
    const fail = error => {
      failure = error;
      try { tx.abort(); } catch { reject(error); }
    };
    try { work(tx.objectStore(STORE_OUTBOX), value => { result = value; }, fail); }
    catch (error) { fail(error); }
  });
}

const SRS_FIELDS = ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'];
function undoRequest(input) {
  if (!input || ['userId', 'itemKey', 'wordId', 'lang'].some(key => typeof input[key] !== 'string' || !input[key])
    || !Number.isFinite(Date.parse(input.reviewedAt)) || !input.prev || typeof input.prev !== 'object'
    || Array.isArray(input.prev) || ![1, 2, 3, 4, null].includes(input.rating ?? null)) {
    throw problem('legacy_review_invalid_undo');
  }
  const prev = {};
  for (const key of SRS_FIELDS) if (input.prev[key] !== undefined) prev[key] = input.prev[key];
  prev.last_reviewed_at ??= null;
  if (prev.last_reviewed_at !== null && (!Number.isFinite(Date.parse(prev.last_reviewed_at))
    || Date.parse(prev.last_reviewed_at) >= Date.parse(input.reviewedAt))) throw problem('legacy_review_invalid_undo');
  for (const key of ['interval', 'ease_factor', 'repetitions']) {
    if (prev[key] !== undefined && prev[key] !== null && (typeof prev[key] !== 'number' || !Number.isFinite(prev[key]))) {
      throw problem('legacy_review_invalid_undo');
    }
  }
  if (prev.next_review_at != null && !Number.isFinite(Date.parse(prev.next_review_at))) throw problem('legacy_review_invalid_undo');
  return { userId: input.userId, itemKey: input.itemKey, wordId: input.wordId,
    lang: input.lang, rating: input.rating ?? null, reviewedAt: new Date(input.reviewedAt).toISOString(), prev };
}

function appendUndoIntent(request) {
  return reviewTransaction('readwrite', (store, done, fail) => {
    const read = store.getAll();
    read.onerror = () => fail(read.error || new Error('outbox-read-failed'));
    read.onsuccess = () => {
      try {
        const previous = read.result.find(e => isUndoIntent(e) && e.userId === request.userId
          && e.wordId === request.wordId && e.lang === request.lang && e.itemKey === request.itemKey
          && sameTime(e.reviewedAt, request.reviewedAt));
        if (previous) {
          if (!previous.localOnly && (JSON.stringify(previous.prev) !== JSON.stringify(request.prev)
            || previous.rating !== request.rating)) throw problem('legacy_review_undo_conflict');
          done(previous);
          return;
        }
        const originals = read.result.filter(e => undoMatchesGrade({ kind: LEGACY_REVIEW_UNDO_KIND, ...request }, e));
        if (originals.some(e => e.detail?.rating != null && e.detail.rating !== request.rating)) {
          throw problem('legacy_review_undo_conflict');
        }
        const intent = { kind: LEGACY_REVIEW_UNDO_KIND, ...request, originals: copy(originals),
          status: 'pending', createdAt: new Date(Math.max(Date.now(), Date.parse(request.reviewedAt) + 1)).toISOString() };
        const add = store.add(intent);
        add.onerror = () => fail(add.error || new Error('outbox-write-failed'));
        add.onsuccess = () => done({ ...intent, seq: add.result });
      } catch (error) { fail(error); }
    };
  });
}

function settleUndoIntent(intent, compensated) {
  return reviewTransaction('readwrite', (store, done, fail) => {
    const read = store.getAll();
    read.onerror = () => fail(read.error || new Error('outbox-read-failed'));
    read.onsuccess = () => {
      const previous = read.result.find(e => e.seq === intent.seq);
      if (!isUndoIntent(previous) || previous.userId !== intent.userId || previous.wordId !== intent.wordId
        || previous.itemKey !== intent.itemKey || previous.lang !== intent.lang || previous.rating !== intent.rating
        || JSON.stringify(previous.prev) !== JSON.stringify(intent.prev)
        || !sameTime(previous.reviewedAt, intent.reviewedAt)) { fail(problem('legacy_review_undo_conflict')); return; }
      const write = store.put({ ...previous, status: 'settled', compensated });
      write.onerror = () => fail(write.error || new Error('outbox-write-failed'));
      for (const e of read.result) if (undoMatchesGrade(previous, e)) store.delete(e.seq);
      done({ ok: true, queued: false, status: 'settled', compensated });
    };
  });
}

async function markReviewsAttempted(entries) {
  if (!entries.length) return;
  return reviewTransaction('readwrite', (store, done, fail) => {
    const read = store.getAll();
    read.onerror = () => fail(read.error || new Error('outbox-read-failed'));
    read.onsuccess = () => {
      for (const entry of entries) {
        const previous = read.result.find(e => e.seq === entry.seq && e.userId === entry.userId
          && e.source === entry.source && e.itemKey === entry.itemKey && sameTime(e.reviewedAt, entry.reviewedAt));
        if (!previous || read.result.some(undo => undoMatchesGrade(undo, previous))) {
          fail(problem('legacy_review_original_changed')); return;
        }
        store.put({ ...previous, remoteAttempted: true });
      }
      done();
    };
  });
}

function undoMarkerMatches(event, intent) {
  const target = event.detail?.undo_of;
  return event.source === 'ui' && event.item_key === intent.itemKey && event.lang === intent.lang
    && event.detail?.qtype === 'undo' && target?.item_key === intent.itemKey
    && sameTime(target.reviewed_at, intent.reviewedAt)
    && (!target.word_id || target.word_id === intent.wordId);
}

async function compensateUndo(client, intent, { getAccountId } = {}) {
  const actor = () => assertActor(intent.userId, getAccountId);
  actor();
  if (intent.status === 'settled') return { ok: true, queued: false, status: 'settled', compensated: !!intent.compensated };
  await assertLegacyFsrsAllowed(client, { userId: intent.userId, cardId: intent.wordId,
    itemKey: intent.itemKey, language: intent.lang });
  actor();
  const history = await readCompleteLegacyRows(() => client.from('review_events')
    .select('id, source, item_key, lang, correct, detail, created_at', { count: 'exact' })
    .eq('user_id', intent.userId).gte('created_at', intent.reviewedAt)
    .lte('created_at', new Date(Math.max(Date.now(), Date.parse(intent.createdAt))).toISOString()),
  { orderBy: ['created_at', 'id'] });
  actor();
  const readWord = async () => {
    const rows = await readCompleteLegacyRows(() => client.from('user_vocabulary')
      .select('id, user_id, interval, ease_factor, repetitions, next_review_at, last_reviewed_at', { count: 'exact' })
      .eq('user_id', intent.userId).in('id', [intent.wordId]));
    actor();
    if (rows.some(row => row.id !== intent.wordId || (row.user_id != null && row.user_id !== intent.userId))
      || rows.length > 1) throw problem('legacy_review_account_changed');
    return rows[0];
  };
  const word = await readWord();
  let restored = false;
  if (word && sameTime(word.last_reviewed_at, intent.reviewedAt)) {
    actor();
    const { error } = await client.from('user_vocabulary').update(intent.prev)
      .eq('user_id', intent.userId).eq('id', intent.wordId).eq('last_reviewed_at', intent.reviewedAt);
    if (error) throw error;
    actor();
    const current = await readWord();
    if (current && sameTime(current.last_reviewed_at, intent.reviewedAt)) throw problem('legacy_review_undo_unconfirmed');
    restored = true;
  }
  const originalExists = history.some(e => e.source === 'vocab' && e.lang === intent.lang
    && e.item_key === intent.itemKey && sameTime(e.created_at, intent.reviewedAt)
    && (!e.detail?.word_id || e.detail.word_id === intent.wordId));
  const markerExists = history.some(e => undoMarkerMatches(e, intent));
  if (originalExists && !markerExists) {
    actor();
    const { error } = await client.from('review_events').insert([{
      user_id: intent.userId, lang: intent.lang, source: 'ui', item_key: intent.itemKey, correct: true,
      created_at: intent.createdAt, detail: { qtype: 'undo', word_id: intent.wordId,
        undo_of: { item_key: intent.itemKey, rating: intent.rating, reviewed_at: intent.reviewedAt, word_id: intent.wordId } },
    }]);
    if (error) throw error;
    actor();
  }
  const result = await settleUndoIntent(intent, originalExists || markerExists || restored);
  actor();
  return result;
}

/** durable 취소 이후 원 grade는 전송하지 않는다. 원격 보상 확인 전에는 성공을 반환하지 않는다. */
export async function undoQueuedReview(client, input, options = {}) {
  const request = undoRequest(input);
  if (!client) throw problem('legacy_review_client_required');
  return withLegacyReviewLock(request.userId, async () => {
    assertActor(request.userId, options.getAccountId);
    const intent = await appendUndoIntent(request);
    assertActor(request.userId, options.getAccountId);
    // 같은 lock 아래 원본 모두가 명시적 무전송이면 원격 보상할 일이 없다.
    if (intent.status !== 'settled' && intent.originals.length
      && intent.originals.every(entry => entry.remoteAttempted === false)) {
      const result = await settleUndoIntent(intent, false);
      assertActor(request.userId, options.getAccountId);
      return result;
    }
    return compensateUndo(client, intent, options);
  });
}

async function removeSeqs(seqs) {
  if (!seqs?.length) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, 'readwrite');
    const os = tx.objectStore(STORE_OUTBOX);
    seqs.forEach((s) => os.delete(s));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('outbox-remove-failed'));
    tx.onabort = () => reject(tx.error || new Error('outbox-remove-aborted'));
  });
}

/**
 * 큐를 서버로 보낸다. 성공분만 큐에서 지운다 — 실패하면 그대로 남아 다음 기회에 간다.
 *
 * 순서: ① 중복 제거용 기존 이벤트 1회 조회 ② 이벤트 일괄 insert(append-only)
 *       ③ 단어 행 1회 조회 → `shouldApplyGrade`가 통과한 것만 FSRS UPDATE.
 * ②와 필요한 ③까지 성공해야 지운다. 이미 더 최신인 카드만 ③을 생략한다.
 * 부분 실패는 원본을 남겨 재시도하고 같은 카드의 뒤쪽 채점도 보류한다.
 *
 * `load`·`remove`는 주입식이다(`syncVocabEncounters`의 storage 주입 선례) — IndexedDB
 * 없는 환경에서 계약이 공허하게 통과하지 않게 하려는 것이 첫 이유다.
 *
 * @returns {{sent:number, kept:number, applied:number}}
 */
export async function flushReviews(client, userId, options = {}) {
  if (!client || !userId) return { sent: 0, kept: 0, applied: 0 };
  return withLegacyReviewLock(userId, () => flushReviewsLocked(client, userId, options));
}

async function flushReviewsLocked(client, userId, {
  persist,
  load,
  remove = removeSeqs,
  prepare,
  getAccountId,
} = {}) {
  const actor = () => assertActor(userId, getAccountId);
  actor();
  const records = (load ? await load(userId) : await pendingReviews(userId, { strict: true, includeSettledUndo: true }))
    .filter(entry => entry.userId === userId && entry.kind !== 'fsrs-operation-v1');
  actor();
  const undos = records.filter(isUndoIntent);
  let undoSent = 0, undoKept = 0;
  const undoHeldIds = new Set();
  for (const intent of undos.filter(e => e.status !== 'settled')) {
    try { await compensateUndo(client, intent, { getAccountId }); undoSent += 1; }
    catch {
      actor();
      undoKept += 1;
      undoHeldIds.add(intent.wordId);
    }
  }
  actor();
  const entries = records.filter(entry => !isUndoIntent(entry) && !undos.some(undo => undoMatchesGrade(undo, entry)));
  const retained = () => ({ sent: undoSent, kept: entries.length + undoKept, applied: 0 });
  if (entries.length === 0) return retained();

  try {
    const exclusions = await loadVocabularyExclusions(client, userId);
    actor();
    const blocked = entries.filter(entry => entry.source === 'vocab' && (
      findVocabularyExclusion(exclusions, { vocabularyId: entry.detail?.word_id, language: entry.lang, word: entry.itemKey }) ||
      (!entry.detail?.word_id && exclusions.some(row => exclusionKey(row.language, row.word_text) === exclusionKey(entry.lang, entry.itemKey)))
    ));
    const blockedSeq = new Set(blocked.map(entry => entry.seq));
    entries.filter(entry => undoHeldIds.has(entry.detail?.word_id)).forEach(entry => blockedSeq.add(entry.seq));
    // 항목마다 경계를 묻고, 그 답(증거)을 같은 항목의 일정 쓰기(persist)가 나눠 쓴다(F5② — 항목당 경계 RPC 2 → 1).
    const boundaries = new Map();
    for (const entry of entries) {
      if (entry.source !== 'vocab' || blockedSeq.has(entry.seq)) continue;
      try {
        const proof = await assertLegacyFsrsAllowed(client, { userId, cardId: entry.detail?.word_id,
          itemKey: entry.itemKey, language: entry.lang });
        if (proof) boundaries.set(entry.seq, proof);
        actor();
      } catch { blockedSeq.add(entry.seq); }
    }
    const holdKorean = () => entries.filter(entry => entry.lang === 'Korean').forEach(entry => blockedSeq.add(entry.seq));
    if (entries.some(entry => entry.lang === 'Korean')) {
      let supported = false;
      try {
        const {data, error} = await client.rpc('learning_language_capabilities');
        supported = !error && learningLanguageCapabilities('Korean', data).review;
      } catch { /* RPC 미배포/연결 실패도 기존 오프라인 의도는 보존한다. */ }
      if (!supported) holdKorean();
    }
    let sendable = entries.filter(entry => !blockedSeq.has(entry.seq));
    actor();
    if (!sendable.length) return retained();
    // 제외된 단어의 기존 미전송 기록은 보존하고, 다른 단어는 계속 보낸다.
    // ① 담긴 시각 구간의 기존 이벤트를 한 번만 읽어 중복을 거른다.
    const times = sendable.map((e) => Date.parse(e.reviewedAt)).filter(Number.isFinite);
    const existing = await readCompleteLegacyRows(() => client
      .from('review_events')
      .select('id, source, lang, item_key, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', new Date(Math.min(...times)).toISOString())
      .lte('created_at', new Date(Math.max(...times)).toISOString()), { orderBy: ['created_at', 'id'] });
    actor();

    let fresh = dedupeEntries(sendable, existing || []);
    // 미전송이라는 증거는 원격 쓰기 전에 내구성 있게 해제한다. 기존 주입 어댑터는 선택적이다.
    if (prepare) await prepare(sendable);
    else if (!load) await markReviewsAttempted(sendable);
    actor();

    // ② 이벤트 적재 — 여기서 실패하면 아무것도 지우지 않는다(전부 다음 기회에).
    if (fresh.length > 0) {
      const insert = async list => {
        try {
          actor();
          const result = await client.from('review_events').insert(list.map(e => outboxEventRow(e, userId)));
          actor();
          return result;
        } catch (error) { return {error}; }
      };
      const { error } = await insert(fresh);
      if (error) {
        if (!isLearningStorageUnavailableError(error) || !fresh.some(entry => entry.lang === 'Korean')) {
          return retained();
        }
        // DB guard가 일괄 INSERT를 원자적으로 거절했다. rollback된 한국어만 보류하고
        // 같은 시각/중복 대조를 유지한 나머지를 전송한다.
        holdKorean();
        sendable = sendable.filter(entry => !blockedSeq.has(entry.seq));
        fresh = fresh.filter(entry => !blockedSeq.has(entry.seq));
        if (!sendable.length || (fresh.length && (await insert(fresh)).error)) {
          return retained();
        }
      }
    }

    // ③ 어휘 FSRS — 내 복습이 서버보다 최신일 때만. 잘린 조회는 보류하고 삭제된 카드는 건너뛴다.
    let applied = 0;
    const wordIds = [...new Set(sendable.map((e) => e.detail?.word_id).filter(Boolean))];
    if (wordIds.length > 0 && !persist) {
      sendable.filter(e => e.nextStats && e.detail?.word_id).forEach(e => blockedSeq.add(e.seq));
    } else if (wordIds.length > 0) {
      const rows = await readCompleteLegacyRows(() => client
        .from('user_vocabulary')
        .select('id, last_reviewed_at', { count: 'exact' })
        .eq('user_id', userId)
        .in('id', wordIds));
      actor();
      const byId = new Map((rows || []).map((r) => [r.id, r]));
      const failedIds = new Set();
      for (const e of sendable) {
        if (blockedSeq.has(e.seq)) continue;
        const id = e.detail?.word_id;
        if (failedIds.has(id)) { blockedSeq.add(e.seq); continue; }
        if (!id || !byId.has(id) || !e.nextStats) continue;
        if (!shouldApplyGrade(e, byId.get(id))) continue;
        // 비교 후 쓰기(독립 리뷰 2026-10-25 KST) — 이 채점을 계산한 바탕(expectedLastReviewedAt)이 지금 서버 행과 다르면 그 사이 다른
        // 기기가 먼저 복습한 것이다: 이벤트(기록)는 위에서 이미 실었고 일정은 그 복습대로 둔다(완료 — 다시 보낼 일이 아니다).
        // 바탕이 같으면 방금 읽은 서버 값으로 비교 후 쓰기를 한다 — 읽기와 쓰기 사이에 끼어든 다른 기기의 채점도 덮지 않는다.
        const server = byId.get(id).last_reviewed_at ?? null;
        if (Object.hasOwn(e, 'expectedLastReviewedAt') && !sameMoment(e.expectedLastReviewedAt, server)) continue;
        try {
          actor();
          await persist(client, id, e.nextStats, e.reviewedAt, { boundary: boundaries.get(e.seq), expectedLastReviewedAt: server });
          actor();
          applied += 1;
          byId.set(id, { ...byId.get(id), last_reviewed_at: e.reviewedAt });
        } catch (error) {
          if (isLegacyReviewSuperseded(error)) continue; // 쓰는 사이 다른 기기가 먼저 바꿨다 — 위와 같은 처리

          blockedSeq.add(e.seq);
          failedIds.add(id);
          if (e.lang === 'Korean' && isLearningStorageUnavailableError(error)) holdKorean();
          // 독립 단어는 계속 보내되 실패한 카드의 순서와 재시도 의도는 보존한다.
        }
      }
    }

    const completed = sendable.filter(entry => !blockedSeq.has(entry.seq));
    actor();
    if (completed.length) await remove(completed.map((e) => e.seq));
    actor();
    return { sent: completed.length + undoSent, kept: entries.length - completed.length + undoKept, applied };
  } catch {
    actor();
    return retained();
  }
}
