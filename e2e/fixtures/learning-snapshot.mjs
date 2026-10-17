// Synthetic legacy fixture protocol only. No FSRS enrollment or production readiness is implied.
import assert from 'node:assert/strict';
import { learningDay } from '../../src/lib/fsrsScheduler.js';

const SUMMARY_FIELDS = ['id', 'user_id', 'word_text', 'base_form', 'meaning', 'language', 'created_at',
  'interval', 'ease_factor', 'repetitions', 'last_reviewed_at', 'next_review_at', 'source_material_id', 'source_ref'];
const languageCodes = { Japanese: 'ja', Chinese: 'zh', French: 'fr', English: 'en', Korean: 'ko' };

// These compatibility fixtures explicitly have no forward admission receipts. Reviewed
// vocabulary is not evidence of a first-question receipt; its source/schedule stays separate.
export function inactiveLearningAdmission({ actorId, now = new Date().toISOString(), fsrsReceipts = [], legacyReceipts = [] }) {
  assert.ok(Array.isArray(fsrsReceipts) && Array.isArray(legacyReceipts));
  const currentDay = learningDay(now);
  const entries = [...fsrsReceipts.map(receipt => ({ ...receipt, cohort: 'fsrs' })),
    ...legacyReceipts.map(receipt => ({ ...receipt, cohort: 'legacy' }))];
  for (const receipt of entries) {
    assert.equal(receipt.actorId, actorId);
    assert.equal(typeof receipt.cardId, 'string');
    assert.ok(Number.isFinite(Date.parse(receipt.firstQuestionAt)));
  }
  assert.equal(new Set(entries.map(receipt => receipt.cardId)).size, entries.length);
  const count = cohort => entries.filter(receipt => receipt.cohort === cohort && learningDay(receipt.firstQuestionAt) === currentDay).length;
  const fsrsUsed = count('fsrs'), legacyUsed = count('legacy'), used = fsrsUsed + legacyUsed;
  return { version: 1, actorId, installed: true, enabled: false, active: false, fsrsEnabled: false,
    startsAt: null, now, learningDay: new Date(currentDay * 86400000).toISOString().slice(0, 10),
    timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 0, used, remaining: Math.max(0, 15 - used),
    fsrsUsed, legacyUsed, admittedLegacyCardIds: legacyReceipts.map(receipt => receipt.cardId) };
}

export function inactiveFsrsStatus({ actorId, now = new Date().toISOString() }) {
  const admission = inactiveLearningAdmission({ actorId, now });
  return { version: 1, actorId, enabled: false, registryAvailable: true, policyVersion: 'anki-seconds-v1',
    now, firstQuestionsToday: admission.used, admission, cards: [] };
}

export function legacyLearningSnapshot({ actorId, rows, known = [], exclusions = [], fields,
  now = new Date().toISOString() }) {
  assert.ok(Array.isArray(rows));
  assert.ok(fields === null || fields === undefined || fields === 'summary', 'Unknown snapshot field selection');
  const fullRows = rows.map(row => {
    const userId = row.user_id === undefined ? actorId : row.user_id;
    assert.equal(userId, actorId, 'The synthetic snapshot must be actor scoped');
    assert.equal(typeof row.id, 'string');
    assert.equal(typeof row.word_text, 'string');
    // Earlier fixtures omitted nullable DB columns. Supply their protocol representation
    // on a distinct response object; never mutate the fixture's saved source or schedule.
    const response = { base_form: null, meaning: null, language: null, created_at: null, interval: null, ease_factor: null,
      repetitions: null, last_reviewed_at: null, next_review_at: null, source_material_id: null, source_ref: null, ...row, user_id: userId };
    for (const field of ['created_at', 'last_reviewed_at', 'next_review_at']) {
      if (typeof response[field] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(response[field])) {
        const timestamp = `${response[field]}T00:00:00.000Z`;
        assert.equal(new Date(timestamp).toISOString(), timestamp, 'The synthetic date must be a valid calendar date');
        response[field] = timestamp;
      }
    }
    return response;
  });
  assert.equal(new Set(fullRows.map(row => row.id)).size, fullRows.length);
  const registry = fullRows.map(row => {
    const isKnown = known.some(entry => entry.word_text === row.word_text &&
      (entry.lang === languageCodes[row.language] || entry.language === row.language));
    const isExcluded = exclusions.some(entry => entry.vocabulary_id === row.id ||
      (entry.word_text === row.word_text && entry.language === row.language));
    return { cardId: row.id, userId: actorId, enrolled: false, card: null,
      known: isKnown, excluded: isExcluded, eligible: !isKnown && !isExcluded,
      nextQuestionAt: null, firstQuestionAt: null };
  });
  return { version: 1, actorId, enabled: false, registryAvailable: true, complete: true, now,
    rows: fields === 'summary' ? fullRows.map(row => Object.fromEntries(SUMMARY_FIELDS.map(key => [key, row[key]]))) : fullRows,
    registry };
}

// 설치 완료 · 비활성 FSRS 계정의 학습 API 한 벌(learning-flow · material-editing-backend와 같은 모양)을 한곳에서 답한다.
// 저장 단어 읽기(GET /api/learning/vocabulary?view=learning snapshot, dc69aab4) · FSRS 상태 · 첫 질문 한도 · 언어 계약 · 제외 목록.
// 해당 요청이 아니면 null — 부른 쪽이 원래 처리(문맥 조회 · 저장 POST 등)로 넘긴다. rows는 부를 때마다 지금 값을 받도록 함수도 된다.
// snapshotStatus가 200이 아니면 저장 단어 읽기만 그 상태로 실패한다(진짜 요청 실패 — 빈 목록 · 완료 화면과 구분하는 검사용).
// 옛(legacy) 채점 저장 앞의 등록 경계(rpc fsrs_legacy_boundary — src/lib/fsrsLegacyBoundary.js). 등록 안 된 계정이라 기존 경로로 저장한다.
// 이 응답이 없으면 경계 확인이 실패해 채점 PATCH가 나가지 않는다(material-editing-backend와 같은 값).
export const inactiveLegacyBoundary = ({ actorId }) => ({ version: 1, actorId, enrolled: false });

export function inactiveLearningReply(request, { actorId, rows = [], snapshotStatus = 200 }) {
  const url = new URL(request.url()), method = request.method(), path = url.pathname;
  if (path === '/api/learning/vocabulary' && method === 'GET' && url.searchParams.get('view') === 'learning') {
    if (snapshotStatus !== 200) return { status: snapshotStatus, json: { error: 'fixture offline' } };
    return { status: 200, json: legacyLearningSnapshot({ actorId, rows: typeof rows === 'function' ? rows() : rows, fields: url.searchParams.get('fields') }) };
  }
  if (path === '/api/learning/fsrs') {
    assert.equal(method, 'GET', 'Inactive FSRS fixture must not receive a mutation');
    return { status: 200, json: inactiveFsrsStatus({ actorId }) };
  }
  if (path === '/api/learning/admission') {
    assert.equal(method, 'GET', 'Inactive admission fixture must not receive a mutation');
    return { status: 200, json: inactiveLearningAdmission({ actorId }) };
  }
  // 한국어 저장 계약 없음(learningCapabilities normalize(null)과 같은 값) — 일본어 · 중국어는 legacy 지원이라 그대로 저장 · 복습한다.
  if (path === '/api/learning/capabilities' && method === 'GET') return { status: 200, json: { version: 1, languages: {} } };
  if (path === '/api/learning/exclusions' && method === 'GET') return { status: 200, json: { items: [] } };
  return null;
}
