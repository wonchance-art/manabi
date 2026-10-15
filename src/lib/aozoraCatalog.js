// 青空文庫 정본 카탈로그 항목(entry.json) 계약 — 순수 함수. 네트워크·저장소와 무관하다.
// 항목 하나 = 리포에 둔 작품 하나(src/content/literature/aozora/<workKey>/entry.json).
import { JP_LEVELS } from './constants.js';
import { aozoraRightsPublishable, isAozoraYear, validateAozoraRights } from './aozoraRights.js';

export const AOZORA_CATALOG_VERSION = 1;
/** 青空文庫 文字遣い種別 4종. P0 공개는 新字新仮名만(설계 §1.2). */
export const AOZORA_CHARSETS = Object.freeze(['新字新仮名', '新字旧仮名', '旧字新仮名', '旧字旧仮名']);
export const AOZORA_PUBLISHABLE_CHARSET = '新字新仮名';
const AOZORA_HOST = 'www.aozora.gr.jp';
const SHA256 = /^[0-9a-f]{64}$/;

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function aozoraUrl(value, field) {
  invariant(typeof value === 'string' && value, `${field} is required`);
  let url;
  try { url = new URL(value); } catch { throw new TypeError(`${field} must be a valid URL`); }
  invariant(url.protocol === 'https:' && url.hostname === AOZORA_HOST && !url.port && !url.username && !url.password,
    `${field} must be an HTTPS Aozora URL`);
  return url;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/** 책 묶음 키 — metadata.book.key. 인물 ID 6자리 + 작품 ID 6자리(0 채움). */
export function aozoraWorkKey(entry) {
  invariant(entry && typeof entry === 'object', 'entry must be an object');
  invariant(typeof entry.personId === 'string' && /^\d{6}$/.test(entry.personId), 'personId must contain six digits');
  invariant(typeof entry.workId === 'string' && /^\d{1,6}$/.test(entry.workId), 'workId must contain digits');
  return `aozora-${entry.personId}-${entry.workId.padStart(6, '0')}`;
}

/** 도서 카드 주소 정본 — https://www.aozora.gr.jp/cards/<인물ID>/card<작품ID>.html */
export function aozoraCardUrl(entry) {
  aozoraWorkKey(entry);
  return `https://${AOZORA_HOST}/cards/${entry.personId}/card${Number(entry.workId)}.html`;
}

export function validateAozoraCatalogEntry(entry) {
  invariant(entry && typeof entry === 'object' && !Array.isArray(entry), 'entry must be an object');
  invariant(entry.schemaVersion === AOZORA_CATALOG_VERSION, 'Unsupported Aozora catalog version');
  invariant(typeof entry.title === 'string' && entry.title.trim(), 'title is required');
  invariant(typeof entry.author === 'string' && entry.author.trim(), 'author is required');
  invariant(entry.language === 'ja', 'Aozora MVP only accepts Japanese originals');
  aozoraWorkKey(entry);
  invariant(AOZORA_CHARSETS.includes(entry.charset), `charset must be one of ${AOZORA_CHARSETS.join('·')}`);
  invariant(isAozoraYear(entry.publishedYear), 'publishedYear must be a year');
  invariant(entry.authorDeathYear === null || isAozoraYear(entry.authorDeathYear),
    'authorDeathYear must be a year or null');
  invariant(JP_LEVELS.includes(entry.level), `level must be one of ${JP_LEVELS.join('·')}`);
  aozoraUrl(entry.cardUrl, 'cardUrl');
  invariant(entry.cardUrl === aozoraCardUrl(entry), 'cardUrl must match personId and workId');
  const file = aozoraUrl(entry.sourceFileUrl, 'sourceFileUrl');
  invariant(file.pathname.startsWith(`/cards/${entry.personId}/files/`), 'sourceFileUrl must be a file of the same person card');
  invariant(entry.sourceFormat === 'txt', 'sourceFormat must be txt');
  invariant(typeof entry.sourceSha256 === 'string' && SHA256.test(entry.sourceSha256),
    'sourceSha256 must be a lowercase SHA-256 of the downloaded zip');
  invariant(typeof entry.textSha256 === 'string' && SHA256.test(entry.textSha256),
    'textSha256 must be a lowercase SHA-256 of source.txt');
  invariant(entry.attribution && typeof entry.attribution === 'object', 'attribution is required');
  invariant(typeof entry.attribution.author === 'string' && entry.attribution.author === entry.author,
    'attribution.author must match author');
  invariant(Object.hasOwn(entry.attribution, 'translator'), 'attribution.translator must be explicit');
  invariant(entry.attribution.translator == null || typeof entry.attribution.translator === 'string',
    'attribution.translator must be a string or null');
  invariant(Object.hasOwn(entry.attribution, 'illustrator'), 'attribution.illustrator must be explicit');
  invariant(entry.attribution.illustrator == null || typeof entry.attribution.illustrator === 'string',
    'attribution.illustrator must be a string or null');
  validateAozoraRights(entry.rights);
  // 교정자 없는 입력본의 수록 승인 — 누가·언제·왜(오너 결정 원문)를 남긴 경우만 유효하다.
  if (entry.unproofreadApproval !== undefined) {
    const approval = entry.unproofreadApproval;
    invariant(approval && typeof approval === 'object' && !Array.isArray(approval), 'unproofreadApproval must be an object');
    invariant(approval.approvedBy === 'owner', 'unproofreadApproval.approvedBy must be owner');
    invariant(/^\d{4}-\d{2}-\d{2}$/u.test(String(approval.approvedAt)), 'unproofreadApproval.approvedAt must be YYYY-MM-DD');
    invariant(typeof approval.reason === 'string' && approval.reason.trim(), 'unproofreadApproval.reason is required');
  }
  return true;
}

/** 공개 가능: 형식 통과 + 권리 승인(D5 포함) + 新字新仮名. */
export function aozoraCatalogEntryPublishable(entry) {
  try { validateAozoraCatalogEntry(entry); } catch { return false; }
  return entry.charset === AOZORA_PUBLISHABLE_CHARSET
    && aozoraRightsPublishable(entry.rights, entry.attribution, entry);
}

/** 후보를 검증·복제·정렬해 외부 변경에 흔들리지 않는 카탈로그 스냅샷으로 만든다. */
export function createAozoraCatalog(entries) {
  invariant(Array.isArray(entries), 'entries must be an array');
  entries.forEach(validateAozoraCatalogEntry);
  const copied = entries.map(clone).sort((left, right) => aozoraWorkKey(left).localeCompare(aozoraWorkKey(right)));
  const keys = copied.map(aozoraWorkKey);
  invariant(new Set(keys).size === keys.length, 'Aozora catalog contains duplicate work keys');
  const cardUrls = copied.map((entry) => entry.cardUrl);
  invariant(new Set(cardUrls).size === cardUrls.length, 'Aozora catalog contains duplicate card URLs');
  const hashes = copied.map((entry) => entry.sourceSha256);
  invariant(new Set(hashes).size === hashes.length, 'Aozora catalog contains duplicate source files');
  return freezeDeep({ schemaVersion: AOZORA_CATALOG_VERSION, entries: copied });
}

export function publishableAozoraEntries(catalog) {
  invariant(catalog?.schemaVersion === AOZORA_CATALOG_VERSION && Array.isArray(catalog.entries),
    'Invalid Aozora catalog');
  return Object.freeze(catalog.entries.filter(aozoraCatalogEntryPublishable));
}
