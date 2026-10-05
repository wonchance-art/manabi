/** 첫 문제 노출의 공통 한도 계약. 로컬 카운터나 어휘 이력으로 영수증을 만들지 않는다. */
import { UUID } from './learningSources.js';
import { learningDay, schedulerTime } from './fsrsScheduler.js';
import { NEW_PER_DAY_OPTIONS } from './vocabStudy.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && UUID.test(value) && value === value.toLowerCase();
const operationId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER;
const reject = (code = 'fsrs_admission_unavailable', status = 503) => { throw Object.assign(new Error(code), { code, status }); };
const dayAt = value => new Date(learningDay(value, 'Asia/Seoul', 4) * 86400000).toISOString().slice(0, 10);
function time(value) {
  if (typeof value !== 'string') reject();
  const match = /^(.*T\d{2}:\d{2}:\d{2})\.(\d{4,6})(Z|[+-]\d{2}:\d{2})$/.exec(value);
  try { return new Date(schedulerTime(match ? `${match[1]}.${match[2].slice(0, 3)}${match[3]}` : value)).toISOString(); }
  catch { reject(); }
}

export function normalizeAdmissionRequest(body, actorId) {
  if (!id(actorId)) reject('fsrs_auth_required', 401);
  if (!object(body) || !['admit', 'configure'].includes(body.action)) reject('fsrs_invalid_request', 400);
  const keys = ['action', 'accountId', 'operationId', 'expectedPolicyRevision', body.action === 'admit' ? 'cardId' : 'dailyNewLimit'];
  if (Object.keys(body).length !== keys.length || Object.keys(body).some(key => !keys.includes(key))
    || !operationId(body.operationId) || !integer(body.expectedPolicyRevision)
    || (body.action === 'admit' ? !id(body.cardId) : !NEW_PER_DAY_OPTIONS.includes(body.dailyNewLimit))) reject('fsrs_invalid_request', 400);
  if (body.accountId !== actorId) reject('fsrs_account_changed', 409);
  return Object.fromEntries(keys.map(key => [key, body[key]]));
}

export function normalizeAdmissionStatus(raw, { actorId } = {}) {
  if (!id(actorId) || !object(raw) || raw.version !== 1 || raw.actorId !== actorId
    || raw.timeZone !== 'Asia/Seoul' || raw.rolloverHour !== 4
    || !['installed', 'enabled', 'active', 'fsrsEnabled'].every(key => typeof raw[key] === 'boolean')) reject();
  const now = time(raw.now), startsAt = raw.startsAt === null ? null : time(raw.startsAt);
  if (raw.learningDay !== dayAt(now)) reject();
  // Epoch은 KST 04시의 명시적 경계여야 한다. disabled 이후에도 원래 epoch은 보존한다.
  if (startsAt && (new Date(startsAt).getUTCHours() !== 19 || new Date(startsAt).getUTCMinutes() !== 0
    || new Date(startsAt).getUTCSeconds() !== 0 || new Date(startsAt).getUTCMilliseconds() !== 0)) reject();
  if (raw.active !== (raw.enabled && startsAt !== null && schedulerTime(now) >= schedulerTime(startsAt))
    || (raw.enabled && startsAt === null)) reject();
  if (!raw.installed) {
    if (raw.enabled || raw.active || raw.fsrsEnabled || startsAt !== null
      || ['limit', 'policyRevision', 'used', 'remaining', 'fsrsUsed', 'legacyUsed', 'admittedLegacyCardIds'].some(key => raw[key] !== null)) reject();
  } else {
    if (!NEW_PER_DAY_OPTIONS.includes(raw.limit) || !['policyRevision', 'used', 'remaining', 'fsrsUsed', 'legacyUsed'].every(key => integer(raw[key]))
      || raw.used !== raw.fsrsUsed + raw.legacyUsed || raw.remaining !== Math.max(0, raw.limit - raw.used)
      || !Array.isArray(raw.admittedLegacyCardIds) || raw.admittedLegacyCardIds.some(value => !id(value))
      || new Set(raw.admittedLegacyCardIds).size !== raw.admittedLegacyCardIds.length) reject();
  }
  return { version: 1, actorId, installed: raw.installed, enabled: raw.enabled, active: raw.active,
    fsrsEnabled: raw.fsrsEnabled, startsAt, now, learningDay: raw.learningDay, timeZone: 'Asia/Seoul', rolloverHour: 4,
    limit: raw.limit, policyRevision: raw.policyRevision, used: raw.used, remaining: raw.remaining,
    fsrsUsed: raw.fsrsUsed, legacyUsed: raw.legacyUsed,
    admittedLegacyCardIds: raw.admittedLegacyCardIds === null ? null : [...raw.admittedLegacyCardIds] };
}

export function canUseLegacyAdmissionCompatibility(status) {
  try {
    const checked = normalizeAdmissionStatus(status, { actorId: status?.actorId });
    return !checked.active && !checked.fsrsEnabled
      && (checked.startsAt === null || schedulerTime(checked.now) < schedulerTime(checked.startsAt));
  } catch { return false; }
}

export function nextAdmissionDayAt(status) {
  const checked = normalizeAdmissionStatus(status, { actorId: status?.actorId });
  // 고정 KST 04시 = 해당 지역 날짜의 UTC 전날 19시. 날짜 판정은 공통 learningDay만 사용한다.
  return new Date((learningDay(checked.now, 'Asia/Seoul', 4) + 1) * 86400000 - 5 * 3600000).toISOString();
}

export function validateAdmissionReceipt(raw, { request } = {}) {
  const command = normalizeAdmissionRequest(request, request?.accountId);
  if (!object(raw) || raw.version !== 1 || raw.actorId !== command.accountId
    || raw.operationId !== command.operationId || typeof raw.duplicate !== 'boolean') reject();
  const quota = normalizeAdmissionStatus(raw.quota, { actorId: command.accountId });
  if (!quota.installed) reject();
  if (command.action === 'configure') {
    if (quota.policyRevision < command.expectedPolicyRevision + 1) reject();
    if (!raw.duplicate && (quota.policyRevision !== command.expectedPolicyRevision + 1 || quota.limit !== command.dailyNewLimit)) reject();
    return { version: 1, actorId: raw.actorId, operationId: raw.operationId, duplicate: raw.duplicate, quota };
  }
  if (raw.cardId !== command.cardId || raw.admitted !== true || typeof raw.consumed !== 'boolean'
    || !quota.admittedLegacyCardIds.includes(raw.cardId)) reject();
  const admittedAt = time(raw.admittedAt), startsAt = raw.startsAt === null ? null : time(raw.startsAt);
  const firstQuestionAt = raw.firstQuestionAt === null ? null : time(raw.firstQuestionAt);
  if (raw.learningDay !== dayAt(admittedAt) || schedulerTime(admittedAt) > schedulerTime(quota.now)
    || (startsAt !== null && startsAt !== quota.startsAt)
    || (firstQuestionAt && schedulerTime(firstQuestionAt) > schedulerTime(admittedAt))
    || (raw.consumed && (!firstQuestionAt || firstQuestionAt !== admittedAt || !startsAt
      || schedulerTime(admittedAt) < schedulerTime(startsAt)))
    || quota.policyRevision < command.expectedPolicyRevision
    || (!raw.duplicate && quota.policyRevision !== command.expectedPolicyRevision)) reject();
  return { version: 1, actorId: raw.actorId, operationId: raw.operationId, cardId: raw.cardId,
    admitted: true, consumed: raw.consumed, duplicate: raw.duplicate, firstQuestionAt, admittedAt,
    startsAt, learningDay: raw.learningDay, quota };
}
