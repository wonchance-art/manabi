/** 전체 어휘 읽기와 새 수동 단어의 원자 저장. 예전 일정 컬럼에 새 기억을 덮어쓰지 않는다. */
import { UUID, LEARNING_LANGUAGES } from '../learningSources.js';
import { hasCjkText } from '../constants.js';
import { introduceFsrsCard, schedulerTime, validateFsrsCard } from '../fsrsScheduler.js';
import { requireLearningCapability } from './learningCapabilities.js';
import { VOCABULARY_LEARNING_SUMMARY_FIELDS } from '../vocabularyLearningRead.js';

const reject = (code, status = 503) => { throw Object.assign(new Error(code), { code, status }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && UUID.test(value) && value === value.toLowerCase();
const operationId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);
const ownKeys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
const limits = { word_text: 200, base_form: 200, meaning: 2000, furigana: 500, pos: 80 };

function databaseError(error) {
  if (!error) return;
  const message = String(error.message || '');
  if (/replay_mismatch|operation_conflict|card_id_conflict|requested_card_conflict|request_conflict/.test(message)) reject('fsrs_save_conflict', 409);
  if (/excluded|known_word/.test(message)) reject('fsrs_card_excluded', 409);
  if (/language_conflict|ambiguous/.test(message)) reject('fsrs_save_conflict', 409);
  if (/forbidden|owner|not_available/.test(message)) reject('fsrs_card_not_found', 404);
  if (/invalid.*request|invalid.*vocabulary/.test(message)) reject('fsrs_invalid_request', 400);
  reject('fsrs_storage_unavailable');
}

async function rpc(client, name, args) {
  let response;
  try { response = await client.rpc(name, args); } catch { reject('fsrs_storage_unavailable'); }
  databaseError(response?.error);
  return response?.data;
}

// PostgreSQL 집계 metadata만 ms로 정규화한다. raw vocabulary의 원래 timestamp는 그대로 둔다.
function metadataTime(value, roundUp = false) {
  if (typeof value !== 'string') reject('fsrs_snapshot_unavailable');
  const match = /^(.*T\d{2}:\d{2}:\d{2})\.(\d{4,6})(Z|[+-]\d{2}:\d{2})$/.exec(value);
  const normalized = match ? `${match[1]}.${match[2].slice(0, 3)}${match[3]}` : value;
  try {
    const ms = schedulerTime(normalized) + (match && roundUp && /[1-9]/.test(match[2].slice(3)) ? 1 : 0);
    return new Date(ms).toISOString();
  } catch { reject('fsrs_snapshot_unavailable'); }
}

function checkedRow(row, userId) {
  if (!object(row) || !id(row.id) || row.user_id !== userId || typeof row.word_text !== 'string'
      || !VOCABULARY_LEARNING_SUMMARY_FIELDS.every(key => Object.hasOwn(row, key))
      || (row.language !== null && !LEARNING_LANGUAGES.includes(row.language))
      || ['base_form', 'meaning', 'created_at', 'last_reviewed_at', 'next_review_at'].some(key => row[key] !== null && typeof row[key] !== 'string')
      || (row.interval !== null && (typeof row.interval !== 'number' || !Number.isFinite(row.interval)))
      || (row.ease_factor !== null && (typeof row.ease_factor !== 'number' || !Number.isFinite(row.ease_factor)))
      || (row.repetitions !== null && (!Number.isSafeInteger(row.repetitions) || row.repetitions < 0))) reject('fsrs_snapshot_unavailable');
  return row;
}

function checkedRegistry(entry, row, userId) {
  if (!object(entry) || entry.cardId !== row.id || entry.userId !== userId
      || !['enrolled', 'eligible', 'known', 'excluded'].every(key => typeof entry[key] === 'boolean')
      || (entry.eligible && (entry.known || entry.excluded))
      || !Object.hasOwn(entry, 'nextQuestionAt') || !Object.hasOwn(entry, 'firstQuestionAt')) reject('fsrs_snapshot_unavailable');
  if (!entry.enrolled) {
    if (entry.card !== null || entry.nextQuestionAt !== null || entry.firstQuestionAt !== null || entry.attempt != null) reject('fsrs_snapshot_unavailable');
    return { ...entry };
  }
  try { validateFsrsCard(entry.card); } catch { reject('fsrs_snapshot_unavailable'); }
  const nextQuestionAt = metadataTime(entry.nextQuestionAt, true);
  if (schedulerTime(nextQuestionAt) < schedulerTime(entry.card.due)) reject('fsrs_snapshot_unavailable');
  const firstQuestionAt = entry.firstQuestionAt === null ? null : metadataTime(entry.firstQuestionAt);
  if (firstQuestionAt && schedulerTime(firstQuestionAt) < schedulerTime(entry.card.introducedAt) + 30000) reject('fsrs_snapshot_unavailable');
  if (entry.attempt && (entry.attempt.userId !== userId || entry.attempt.cardId !== row.id)) reject('fsrs_snapshot_unavailable');
  return { ...entry, nextQuestionAt, firstQuestionAt };
}

export function validateVocabularyLearningSnapshot(snapshot, userId) {
  if (!id(userId)) reject('fsrs_auth_required', 401);
  if (!object(snapshot) || snapshot.version !== 1 || snapshot.actorId !== userId || typeof snapshot.enabled !== 'boolean'
      || snapshot.registryAvailable !== true || snapshot.complete !== true || !Array.isArray(snapshot.rows)
      || !Array.isArray(snapshot.registry) || snapshot.rows.length !== snapshot.registry.length) reject('fsrs_snapshot_unavailable');
  const rows = snapshot.rows.map(row => checkedRow(row, userId)), byId = new Map(rows.map(row => [row.id, row]));
  if (byId.size !== rows.length) reject('fsrs_snapshot_unavailable');
  const seen = new Set();
  const registry = snapshot.registry.map(entry => {
    const row = byId.get(entry?.cardId);
    if (!row || seen.has(row.id)) reject('fsrs_snapshot_unavailable');
    seen.add(row.id);
    return checkedRegistry(entry, row, userId);
  });
  return { version: 1, actorId: userId, enabled: snapshot.enabled, registryAvailable: true, complete: true,
    rows, registry, now: metadataTime(snapshot.now) };
}

/** 호출자는 requireUser()가 확인한 userId만 넘긴다. SSR와 GET이 같은 단일 snapshot을 사용한다. */
export async function readVocabularyLearningSnapshot({ serviceClient, userId }) {
  if (!id(userId)) reject('fsrs_auth_required', 401);
  const snapshot = await rpc(serviceClient, 'fsrs_vocabulary_snapshot', { p_actor: userId });
  return validateVocabularyLearningSnapshot(snapshot, userId);
}

export function normalizeManualVocabularyRequest(body, userId) {
  if (!id(userId)) reject('fsrs_auth_required', 401);
  if (!object(body) || body.action !== 'save' || !ownKeys(body, ['action', 'accountId', 'operationId', 'cardId', 'vocabulary'])
      || !id(body.cardId) || !operationId(body.operationId) || !object(body.vocabulary)
      || !ownKeys(body.vocabulary, [...Object.keys(limits), 'language'])) reject('fsrs_invalid_request', 400);
  if (body.accountId !== userId) reject('fsrs_account_changed', 409);
  if (!LEARNING_LANGUAGES.includes(body.vocabulary.language)) reject('fsrs_invalid_request', 400);
  const vocabulary = { language: body.vocabulary.language };
  for (const [key, maximum] of Object.entries(limits)) {
    const value = body.vocabulary[key];
    if (value !== undefined && typeof value !== 'string') reject('fsrs_invalid_request', 400);
    vocabulary[key] = (value ?? '').normalize('NFC').trim();
    if (vocabulary[key].length > maximum || !vocabulary[key].isWellFormed()
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(vocabulary[key])) reject('fsrs_invalid_request', 400);
  }
  if (!vocabulary.word_text) reject('fsrs_invalid_request', 400);
  if (!vocabulary.base_form) vocabulary.base_form = hasCjkText(vocabulary.word_text) ? vocabulary.word_text : vocabulary.word_text.toLowerCase();
  if (vocabulary.base_form.length > limits.base_form) reject('fsrs_invalid_request', 400);
  return { action: 'save', accountId: userId, operationId: body.operationId, cardId: body.cardId, vocabulary };
}

export async function saveManualVocabulary({ authClient, serviceClient, userId, body, now = new Date() }) {
  const request = normalizeManualVocabularyRequest(body, userId);
  if (request.vocabulary.language === 'Korean') {
    try { await requireLearningCapability(authClient, 'Korean'); } catch { reject('fsrs_storage_unavailable'); }
  }
  // RPC가 enabled·소유자·identity receipt를 같은 트랜잭션에서 검사한다. 브라우저 nextCard는 없다.
  const initialCard = introduceFsrsCard(now);
  const response = await rpc(serviceClient, 'fsrs_save_manual_vocabulary', {
    p_actor: userId, p_request: request, p_initial_card: initialCard,
  });
  if (!object(response) || response.version !== 1 || response.actorId !== userId || response.operationId !== request.operationId
      || response.requestedCardId !== request.cardId || !id(response.vocabularyId)
      || !['created', 'enrolled', 'duplicate'].every(key => typeof response[key] === 'boolean')) reject('fsrs_save_receipt_invalid');
  const row = checkedRow(response.row, userId);
  if (row.id !== response.vocabularyId || (!response.duplicate && row.word_text.normalize('NFC').trim() !== request.vocabulary.word_text)
      || (response.created && (row.id !== request.cardId || !response.enrolled))) reject('fsrs_save_receipt_invalid');
  const state = checkedRegistry(response.state, row, userId);
  if (state.enrolled !== response.enrolled) reject('fsrs_save_receipt_invalid');
  // 신규 저장의 응답만 새 기억임을 확인한다. 재전송은 이후 평가를 포함한 현재 상태를 돌려준다.
  if (response.created && !response.duplicate && (state.card.revision !== 0 || state.card.state !== 'New'
      || state.card.introducedAt !== initialCard.introducedAt || state.card.due !== initialCard.due)) reject('fsrs_save_receipt_invalid');
  return { ok: true, version: 1, actorId: userId, operationId: response.operationId, requestedCardId: response.requestedCardId,
    vocabularyId: row.id, created: response.created, enrolled: state.enrolled, duplicate: response.duplicate,
    row, state, now: metadataTime(response.now) };
}
