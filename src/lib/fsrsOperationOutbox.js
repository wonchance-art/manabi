'use client';

import { openDb, STORE_OUTBOX } from './offlineCache';

/** 복습 원본: 캐시의 TTL/LRU나 구형 날짜 기반 채점 큐에서 소비하지 않는다. */
export const FSRS_OPERATION_KIND = 'fsrs-operation-v1';
export const isFsrsOperation = entry => entry?.kind === FSRS_OPERATION_KIND;
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const copy = value => JSON.parse(JSON.stringify(value));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const problem = code => Object.assign(new Error(code), { code });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const vocabularyFields = { word_text: 200, base_form: 200, meaning: 2000, furigana: 500, pos: 80 };

/** 수동 추가도 네트워크보다 먼저 원본을 보존한다. 사용자/일정/출처 필드는 서버 계약 밖이다. */
export function normalizeFsrsSaveRequest(input, accountId) {
  const allowed = ['action', 'accountId', 'operationId', 'cardId', 'vocabulary'];
  const vocab = input?.vocabulary;
  if (!input || input.action !== 'save' || Object.keys(input).some(key => !allowed.includes(key)) ||
      !identity(accountId) || (input.accountId !== undefined && input.accountId !== accountId) ||
      !uuid.test(input.cardId || '') || !/^[A-Za-z0-9_.:-]{1,200}$/.test(input.operationId || '') ||
      !vocab || typeof vocab !== 'object' || Array.isArray(vocab) ||
      Object.keys(vocab).some(key => key !== 'language' && !Object.hasOwn(vocabularyFields, key)) ||
      !['Japanese', 'Chinese', 'Korean', 'English', 'French'].includes(vocab.language)) throw problem('fsrs_invalid_request');
  const vocabulary = {};
  for (const [key, limit] of Object.entries(vocabularyFields)) {
    if (vocab[key] === undefined && key !== 'word_text') continue;
    if (typeof vocab[key] !== 'string') throw problem('fsrs_invalid_request');
    const value = vocab[key].normalize('NFC').trim();
    if (value.length > limit || (key === 'word_text' && !value)) throw problem('fsrs_invalid_request');
    vocabulary[key] = value;
  }
  vocabulary.language = vocab.language;
  return { action: 'save', accountId, operationId: input.operationId, cardId: input.cardId.toLowerCase(), vocabulary };
}
const actionFields = {
  enroll: [], question: ['attemptId', 'answerVisible', 'dailyNewLimit', 'expectedPolicyRevision'],
  reveal: ['attemptId', 'hint'], grade: ['attemptId', 'rating'],
  undo: ['targetOperationId'], abandon: ['attemptId'],
};

/** 브라우저가 계산한 기억 상태·일정·시각은 전송 계약에 포함될 수 없다. */
export function normalizeFsrsRequest(input, accountId) {
  if (input?.action === 'save') return normalizeFsrsSaveRequest(input, accountId);
  const keys = ['action', 'cardId', 'operationId', 'expectedRevision', 'attemptId', 'rating',
    'targetOperationId', 'answerVisible', 'hint', 'dailyNewLimit', 'expectedPolicyRevision', 'accountId'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !keys.includes(key)) || !identity(accountId) ||
      (input.accountId !== undefined && input.accountId !== accountId) ||
      !['enroll', 'question', 'reveal', 'grade', 'undo', 'abandon'].includes(input.action) ||
      !identity(input.cardId) || !identity(input.operationId) ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= Number.MAX_SAFE_INTEGER) {
    throw problem('fsrs_invalid_request');
  }
  const allowed = new Set(['action', 'cardId', 'operationId', 'expectedRevision', 'accountId', ...actionFields[input.action]]);
  if (Object.keys(input).some(key => !allowed.has(key)) || (input.action === 'enroll' && input.expectedRevision !== 0)) {
    throw problem('fsrs_invalid_request');
  }
  if ((['reveal', 'grade', 'abandon'].includes(input.action) && !identity(input.attemptId)) ||
      (input.action === 'grade' && ![1, 2, 3, 4].includes(input.rating)) ||
      (input.action === 'undo' && (!identity(input.targetOperationId) || input.targetOperationId === input.operationId)) ||
      (input.attemptId !== undefined && !identity(input.attemptId)) ||
      (input.expectedPolicyRevision !== undefined && (!Number.isSafeInteger(input.expectedPolicyRevision) || input.expectedPolicyRevision < 0 || input.expectedPolicyRevision >= Number.MAX_SAFE_INTEGER)) ||
      (input.dailyNewLimit !== undefined && (input.action !== 'question' || ![0, 5, 10, 15, 20, 30, 40].includes(input.dailyNewLimit))) ||
      ['answerVisible', 'hint'].some(key => input[key] !== undefined && typeof input[key] !== 'boolean')) {
    throw problem('fsrs_invalid_request');
  }
  return Object.fromEntries(keys.filter(key => key === 'accountId' || input[key] !== undefined)
    .map(key => [key, key === 'accountId' ? accountId : input[key]]));
}

/** 요청 성공 이벤트가 아닌 트랜잭션 COMMIT만 성공으로 반환한다. */
function transact(db, mode, work) {
  return new Promise((resolve, reject) => {
    let result, failure;
    const tx = db.transaction(STORE_OUTBOX, mode);
    tx.oncomplete = () => failure ? reject(failure) : resolve(result);
    tx.onerror = () => reject(failure || tx.error || problem('fsrs_outbox_transaction_failed'));
    tx.onabort = () => reject(failure || tx.error || problem('fsrs_outbox_transaction_aborted'));
    const fail = error => {
      failure = error;
      try { tx.abort(); } catch { reject(error); }
    };
    try { work(tx.objectStore(STORE_OUTBOX), value => { result = value; }, fail); }
    catch (error) { fail(error); }
  });
}

/** 같은 저장소를 쓰되 독립된 형식으로 보존한다. 오류를 빈 큐로 바꾸지 않는다. */
export function createFsrsOperationOutbox({ open = openDb, now = Date.now } = {}) {
  return {
    async append({ accountId, payload, receipt = null, blockReason = null }) {
      const request = normalizeFsrsRequest(payload, accountId);
      if (!['save', 'enroll', 'grade', 'undo'].includes(request.action)) throw problem('fsrs_not_queueable');
      return transact(await open(), 'readwrite', (store, done, fail) => {
        const read = store.getAll();
        read.onerror = () => fail(read.error || problem('fsrs_outbox_read_failed'));
        read.onsuccess = () => {
          try {
            const previous = read.result.find(entry => isFsrsOperation(entry) &&
              entry.accountId === accountId && entry.operationId === request.operationId);
            if (previous) {
              if (!same(previous.payload, request)) throw problem('fsrs_operation_id_conflict');
              done(copy(previous));
              return;
            }
            const entry = { kind: FSRS_OPERATION_KIND, accountId, cardId: request.cardId,
              operationId: request.operationId, payload: request, createdAt: new Date(now()).toISOString(),
              status: blockReason ? 'blocked' : 'queued', blockReason, receipt: receipt ? copy(receipt) : null };
            const add = store.add(entry);
            add.onerror = () => fail(add.error || problem('fsrs_outbox_write_failed'));
            add.onsuccess = () => done({ ...entry, seq: add.result });
          } catch (error) { fail(error); }
        };
      });
    },

    async list(accountId, { includeSettled = false } = {}) {
      if (!identity(accountId)) throw problem('fsrs_invalid_account');
      return transact(await open(), 'readonly', (store, done, fail) => {
        const read = store.getAll();
        read.onerror = () => fail(read.error || problem('fsrs_outbox_read_failed'));
        read.onsuccess = () => done(read.result.filter(entry => isFsrsOperation(entry) &&
          entry.accountId === accountId && (includeSettled || entry.status !== 'settled'))
          .sort((a, b) => a.seq - b.seq));
      });
    },

    /** 의도와 ID는 불변이다. 서버 성공 영수증도 남겨 다시 클릭한 ID를 재사용한다. */
    async mark(entry, { status, response = null, blockReason = null }) {
      if (!['queued', 'blocked', 'conflict', 'stale', 'settled'].includes(status)) throw problem('fsrs_invalid_queue_status');
      return transact(await open(), 'readwrite', (store, done, fail) => {
        const read = store.get(entry.seq);
        read.onerror = () => fail(read.error || problem('fsrs_outbox_read_failed'));
        read.onsuccess = () => {
          const previous = read.result;
          if (!isFsrsOperation(previous) || previous.accountId !== entry.accountId ||
              previous.operationId !== entry.operationId || !same(previous.payload, entry.payload)) {
            fail(problem('fsrs_outbox_identity_conflict'));
            return;
          }
          if (previous.status === 'settled') { done(previous); return; }
          const next = { ...previous, status, response: response ? copy(response) : null, blockReason };
          const write = store.put(next);
          write.onerror = () => fail(write.error || problem('fsrs_outbox_write_failed'));
          write.onsuccess = () => done(next);
        };
      });
    },
  };
}
