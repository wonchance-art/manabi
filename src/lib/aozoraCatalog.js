import { aozoraRightsPublishable, validateAozoraRights } from './aozoraRights.js';

export const AOZORA_CATALOG_VERSION = 1;

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function validAozoraUrl(value, field) {
  invariant(typeof value === 'string' && value, `${field} is required`);
  let url;
  try { url = new URL(value); } catch { throw new TypeError(`${field} must be a valid URL`); }
  invariant(url.protocol === 'https:' && url.hostname === 'www.aozora.gr.jp',
    `${field} must be an HTTPS Aozora URL`);
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

export function aozoraWorkKey(entry) {
  invariant(entry && typeof entry === 'object', 'entry must be an object');
  invariant(/^\d{6}$/.test(entry.personId), 'personId must contain six digits');
  invariant(/^\d+$/.test(entry.workId), 'workId must contain digits');
  return `aozora-${entry.personId}-${entry.workId.padStart(6, '0')}`;
}

export function validateAozoraCatalogEntry(entry) {
  invariant(entry && typeof entry === 'object' && !Array.isArray(entry), 'entry must be an object');
  invariant(entry.schemaVersion === AOZORA_CATALOG_VERSION, 'Unsupported Aozora catalog version');
  invariant(typeof entry.title === 'string' && entry.title.trim(), 'title is required');
  invariant(typeof entry.author === 'string' && entry.author.trim(), 'author is required');
  invariant(entry.language === 'ja', 'Aozora MVP only accepts Japanese originals');
  aozoraWorkKey(entry);
  validAozoraUrl(entry.cardUrl, 'cardUrl');
  validAozoraUrl(entry.sourceFileUrl, 'sourceFileUrl');
  invariant(entry.sourceFormat === 'txt' || entry.sourceFormat === 'xhtml', 'sourceFormat must be txt or xhtml');
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
  return true;
}

export function aozoraCatalogEntryPublishable(entry) {
  try { validateAozoraCatalogEntry(entry); } catch { return false; }
  return aozoraRightsPublishable(entry.rights, entry.attribution);
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
  return freezeDeep({ schemaVersion: AOZORA_CATALOG_VERSION, entries: copied });
}

export function publishableAozoraEntries(catalog) {
  invariant(catalog?.schemaVersion === AOZORA_CATALOG_VERSION && Array.isArray(catalog.entries),
    'Invalid Aozora catalog');
  return Object.freeze(catalog.entries.filter(aozoraCatalogEntryPublishable));
}
