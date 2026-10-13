// 青空文庫 작품의 공개 여부를 보수적으로 판정하는 순수 계약.
// 법률 판단을 자동화하지 않고, 사람이 남긴 검토 증거가 완전한지만 fail-closed로 검사한다.
//
// 선정 기준(오너 결정 D5, 2026-10-12 KST) — 법률 자문이 아니라 보수적 안전선이다:
//   · 검토 관할 JP·KR·US 세 곳을 **모두** 기록해야 승인으로 본다.
//   · 「1931년 이전 출판」 또는 「1945년 이전 작가 사망」인 원작만 공개한다.
//     - JP: 1967년 이전 사망 작가는 만료 확정(2018 연장 비소급). 1945년 이전 사망이면 충분하다.
//     - KR: 1962년 이전 사망 작가는 만료. 1945년 이전 사망이면 충분하다.
//     - US: 1931년 이전 출판작은 만료(95년). 그 뒤 출판작도 작가가 1945년 이전 사망이면
//       1996-01-01 시점 일본에서 이미 만료(사후 50년)라 URAA 회복 대상이 아니다.
//   · 번역자·삽화가가 없는 원작만(2차 저작자의 권리가 따로 산다).

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

/** 승인 기록이 반드시 포함해야 하는 검토 관할(D5). */
export const AOZORA_REQUIRED_JURISDICTIONS = Object.freeze(['JP', 'KR', 'US']);
/** 이 해 **이전**에 출판된 원작은 공개 가능(D5). */
export const AOZORA_PUBLISHED_BEFORE = 1931;
/** 이 해 **이전**에 사망한 작가의 원작은 공개 가능(D5). */
export const AOZORA_AUTHOR_DIED_BEFORE = 1945;

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

/** 서력 연도 형식(정수, 700~9999)인가 — 값의 법적 의미는 판정하지 않는다. */
export function isAozoraYear(value) {
  return Number.isInteger(value) && value >= 700 && value <= 9999;
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
    const missing = AOZORA_REQUIRED_JURISDICTIONS.filter((code) => !rights.reviewedJurisdictions.includes(code));
    invariant(missing.length === 0, `Approved rights must review jurisdictions ${AOZORA_REQUIRED_JURISDICTIONS.join('·')} (missing ${missing.join('·')})`);
  }
  return true;
}

/** D5 선정 기준 — 1931년 이전 출판 또는 1945년 이전 작가 사망. 연도를 모르면 false(fail-closed). */
export function aozoraWorkWithinSelection(work = {}) {
  const published = isAozoraYear(work?.publishedYear) ? work.publishedYear : null;
  const died = isAozoraYear(work?.authorDeathYear) ? work.authorDeathYear : null;
  return (published != null && published < AOZORA_PUBLISHED_BEFORE)
    || (died != null && died < AOZORA_AUTHOR_DIED_BEFORE);
}

/**
 * MVP 공개 정책: 명시적으로 승인된 퍼블릭 도메인 일본어 원작만 허용한다.
 * attribution의 translator·illustrator는 키가 있고 값이 null이어야 하며(빠뜨림 = 미검토),
 * work의 출판·사망 연도가 D5 선정 기준 안이어야 한다.
 */
export function aozoraRightsPublishable(rights, attribution = {}, work = {}) {
  try { validateAozoraRights(rights); } catch { return false; }
  const credits = attribution && typeof attribution === 'object' ? attribution : {};
  return rights.status === AOZORA_RIGHTS_STATUS.APPROVED
    && rights.basis === AOZORA_RIGHTS_BASIS.PUBLIC_DOMAIN
    && Object.hasOwn(credits, 'translator')
    && credits.translator === null
    && Object.hasOwn(credits, 'illustrator')
    && credits.illustrator === null
    && aozoraWorkWithinSelection(work);
}
