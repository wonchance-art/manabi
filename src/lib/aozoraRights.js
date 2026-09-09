// 青空文庫 작품의 공개 여부를 보수적으로 판정하는 순수 계약.
// 법률 판단을 자동화하지 않고, 사람이 남긴 검토 증거가 완전한지만 fail-closed로 검사한다.

export const AOZORA_RIGHTS_STATUS = Object.freeze({
  CANDIDATE: 'candidate',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
});

export const AOZORA_RIGHTS_BASIS = Object.freeze({
  PUBLIC_DOMAIN: 'public-domain',
  PERMISSION: 'permission',
  UNKNOWN: 'unknown',
});

const STATUS_VALUES = new Set(Object.values(AOZORA_RIGHTS_STATUS));
const BASIS_VALUES = new Set(Object.values(AOZORA_RIGHTS_BASIS));
const ISO_DATE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function isRealIsoDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validHttpsUrl(value, field) {
  invariant(typeof value === 'string' && value, `${field} is required`);
  let url;
  try { url = new URL(value); } catch { throw new TypeError(`${field} must be a valid URL`); }
  invariant(url.protocol === 'https:', `${field} must use HTTPS`);
  return url;
}

/** 권리 검토 기록의 형식만 검증한다. 이 함수의 성공 자체가 공개 허가는 아니다. */
export function validateAozoraRights(rights) {
  invariant(rights && typeof rights === 'object' && !Array.isArray(rights), 'rights must be an object');
  invariant(STATUS_VALUES.has(rights.status), 'Unsupported Aozora rights status');
  invariant(BASIS_VALUES.has(rights.basis), 'Unsupported Aozora rights basis');

  if (rights.status === AOZORA_RIGHTS_STATUS.APPROVED) {
    invariant(rights.basis !== AOZORA_RIGHTS_BASIS.UNKNOWN, 'Approved rights must have a known basis');
    invariant(typeof rights.reviewedBy === 'string' && rights.reviewedBy.trim(), 'Approved rights require reviewedBy');
    invariant(typeof rights.reviewedAt === 'string' && isRealIsoDate(rights.reviewedAt), 'Approved rights require a valid reviewedAt date');
    validHttpsUrl(rights.evidenceUrl, 'Approved rights evidenceUrl');
    invariant(Array.isArray(rights.reviewedJurisdictions) && rights.reviewedJurisdictions.length > 0,
      'Approved rights require reviewedJurisdictions');
    invariant(rights.reviewedJurisdictions.every((item) => typeof item === 'string' && /^[A-Z]{2}$/.test(item)),
      'reviewedJurisdictions must contain ISO alpha-2 codes');
    invariant(new Set(rights.reviewedJurisdictions).size === rights.reviewedJurisdictions.length,
      'reviewedJurisdictions must not contain duplicates');
  }
  return true;
}

/** MVP 공개 정책: 명시적으로 승인된 퍼블릭 도메인 일본어 원작만 허용한다. */
export function aozoraRightsPublishable(rights, attribution = {}) {
  try { validateAozoraRights(rights); } catch { return false; }
  return rights.status === AOZORA_RIGHTS_STATUS.APPROVED
    && rights.basis === AOZORA_RIGHTS_BASIS.PUBLIC_DOMAIN
    && Object.hasOwn(attribution, 'translator')
    && attribution.translator === null
    && Object.hasOwn(attribution, 'illustrator')
    && attribution.illustrator === null;
}
