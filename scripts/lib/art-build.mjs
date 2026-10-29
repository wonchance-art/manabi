// 「그림 한 장 읽기」 카탈로그 빌드(ART-AUTO-1, 설계 docs/design/art-pipeline.md ③-4) — entries/ + sources/ → works.json.
// 결정적이다: 같은 입력이면 같은 바이트(시각·환경 값 없음). --check는 쓰지 않고 차이만 실패로 낸다(정본 문학책 build-literature 선례).
//
//   entries/<작품 id>.json   사람이 쓰는 필드(제목·읽기·날짜·기법·장소·용어·찾아볼 것·대체 텍스트) + 고른 출처 id
//   entries/order.json       works.json의 작품 순서(작품 id 배열) — 새 작품은 여기에 더한다
//   sources/<출처>/<id>.json  해설 원 응답 스냅샷(colbase·aic, 원문 HTML은 받은 그대로) — scripts/art/snapshot-sources.mjs가 쓴다
//   sources/images/<작품 id>.json  그림 출처 기록 + public/art 파일의 sha256·바이트·픽셀
//
// 기계 필드(해설 text·textSha256·sourceUrl·credit·license, 그림 url·sourceUrl·license·credit·width·height)는 스냅샷에서 만든다.
// 크레딧·라이선스 문구는 src/lib/artSource.js 출처표 한 곳뿐이다. 장소·작가·시대·큐레이션 파일은 아직 손으로 쓴다.
// 제품 모듈은 동적 import한다 — CLI(scripts/build-art.mjs)는 번들러식 import 훅을 먼저 등록하고, vitest는 그대로 푼다.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const ART_ROOT = 'src/content/art';
export const ART_PUBLIC_DIR = 'public';
export const ART_FILES = Object.freeze({ entries: 'entries', order: 'order.json', sources: 'sources', images: 'images', works: 'works.json' });
/** 손으로 쓰는 카탈로그 파일 — 빌드가 works.json과 함께 계약(validateArtCatalog)을 돌린다. */
const HAND_FILES = Object.freeze(['artists', 'places', 'periods', 'curations']);

/** entries 작품 키 — works.json 키 순서 그대로. 그 밖의 키는 실패(쓴 값이 소리 없이 빠지지 않게). */
export const ART_ENTRY_KEYS = Object.freeze(['id', 'wikidata', 'genre', 'artist', 'title', 'hook', 'series', 'date', 'periods', 'medium', 'places',
  'descriptions', 'terms', 'lookFor', 'image']);
const DESCRIPTION_REF_KEYS = Object.freeze(['language', 'source', 'sourceId']);
const IMAGE_REF_KEYS = Object.freeze(['source', 'sourceId', 'alt']);
const FETCHED_AT = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const IMAGE_FILE = /^[a-z0-9-]+\.(?:jpg|webp)$/;

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}

/** 스냅샷 직렬화 정본 — 키 정렬 + 2칸 들여쓰기 + 끝 개행(받은 순서가 바뀌어도 같은 바이트). */
export function serializeSnapshot(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

/** works.json 직렬화 정본 — 키 순서는 빌드가 정한 순서(ART_ENTRY_KEYS·필드 순서) + 2칸 들여쓰기 + 끝 개행. */
export function serializeWorks(works) {
  return `${JSON.stringify(works, null, 2)}\n`;
}

/** 받은 날짜(KST) — 스냅샷 fetchedAt. */
export function kstDate(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** JPEG SOF 마커에서 픽셀 크기(스냅샷 width·height). JPEG가 아니면 null. */
export function jpegSize(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}

export const descriptionSnapshotPath = (root, source, id) => path.join(root, ART_FILES.sources, source, `${id}.json`);
export const imageSnapshotPath = (root, workId) => path.join(root, ART_FILES.sources, ART_FILES.images, `${workId}.json`);
const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * entries/ 읽기 — order.json 순서대로. 순서 목록과 파일이 어긋나면(빠짐·남음·중복·id ≠ 파일 이름) 실패.
 * @returns {{entries: object[], errors: string[]}}
 */
export function loadArtEntries(root = ART_ROOT) {
  const dir = path.join(root, ART_FILES.entries);
  const errors = [];
  if (!existsSync(dir)) return { entries: [], errors: [`${ART_FILES.entries}/: 폴더가 없다`] };
  const orderFile = path.join(dir, ART_FILES.order);
  let order = [];
  try {
    order = readJson(orderFile);
    if (!Array.isArray(order) || !order.every(isText)) throw new Error('작품 id 배열이어야 한다');
  } catch (error) {
    return { entries: [], errors: [`${ART_FILES.entries}/${ART_FILES.order}: ${error.message}`] };
  }
  const files = readdirSync(dir).filter((name) => name.endsWith('.json') && name !== ART_FILES.order).sort();
  const ids = new Set(files.map((name) => name.slice(0, -'.json'.length)));
  const seen = new Set();
  for (const id of order) {
    if (seen.has(id)) errors.push(`${ART_FILES.entries}/${ART_FILES.order}: 중복 ${id}`);
    seen.add(id);
    if (!ids.has(id)) errors.push(`${ART_FILES.entries}/${ART_FILES.order}: ${id}.json이 없다`);
  }
  for (const id of ids) if (!seen.has(id)) errors.push(`${ART_FILES.entries}/${id}.json: ${ART_FILES.order}에 없다(순서를 정한다)`);
  const entries = [];
  for (const id of [...new Set(order)].filter((item) => ids.has(item))) {
    try {
      const entry = readJson(path.join(dir, `${id}.json`));
      if (!isObject(entry) || entry.id !== id) throw new Error(`id가 파일 이름(${id})과 같아야 한다`);
      entries.push(entry);
    } catch (error) {
      errors.push(`${ART_FILES.entries}/${id}.json: ${error.message}`);
    }
  }
  return { entries, errors };
}

function unknownKeys(value, allowed, at, errors) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${at}.${key}: 모르는 키(기계 필드는 스냅샷에서 만든다)`);
}

/** 스냅샷 읽기(같은 파일은 한 번만) — 없으면 null. id(그림은 workId)가 파일 이름과 다르거나 fetchedAt 형식이 틀리면 throw. */
function snapshotReader(root) {
  const cache = new Map();
  return (file, id, idKey = 'id') => {
    if (cache.has(file)) return cache.get(file);
    let snapshot = null;
    if (existsSync(file)) {
      snapshot = readJson(file);
      if (String(snapshot?.[idKey]) !== id) throw new Error(`${relative(root, file)}: id가 파일 이름(${id})과 다르다`);
      if (snapshot.fetchedAt !== undefined && !FETCHED_AT.test(snapshot.fetchedAt)) throw new Error(`${relative(root, file)}: fetchedAt은 YYYY-MM-DD(KST)`);
    }
    cache.set(file, snapshot);
    return snapshot;
  };
}

function buildDescription(ref, at, ctx, errors) {
  const { ART_SOURCES, artSourceText } = ctx.artSource;
  if (!isObject(ref)) { errors.push(`${at}: {language, source, sourceId}여야 한다`); return null; }
  unknownKeys(ref, DESCRIPTION_REF_KEYS, at, errors);
  const source = Object.hasOwn(ART_SOURCES, ref.source ?? '') ? ART_SOURCES[ref.source] : null;
  if (!source) { errors.push(`${at}.source: ${Object.keys(ART_SOURCES).join('|')}`); return null; }
  if (!source.languages.includes(ref.language)) { errors.push(`${at}.language: ${ref.source}는 ${source.languages.join('|')} 해설만 있다`); return null; }
  if (!isText(ref.sourceId)) { errors.push(`${at}.sourceId: 출처 id 문자열이 필요하다`); return null; }
  const file = descriptionSnapshotPath(ctx.root, ref.source, ref.sourceId);
  const snapshot = ctx.read(file, ref.sourceId);
  if (!snapshot) {
    errors.push(`${at}: 스냅샷 ${relative(ctx.root, file)}이 없다 — node scripts/art/snapshot-sources.mjs로 받는다`);
    return null;
  }
  const text = artSourceText(source.snapshotRaw(snapshot, ref.language));
  if (!text) { errors.push(`${at}: ${relative(ctx.root, file)}에 ${ref.language} 해설이 없다`); return null; }
  const credit = source.credit(snapshot);
  if (!isText(credit)) { errors.push(`${at}: ${relative(ctx.root, file)}로 크레딧 줄을 만들 수 없다(소장관을 출처표에 더한다)`); return null; }
  return {
    language: ref.language,
    source: ref.source,
    sourceId: ref.sourceId,
    sourceUrl: source.snapshotUrl(snapshot),
    credit,
    license: source.license,
    text,
    textSha256: sha256(Buffer.from(text, 'utf8')),
  };
}

function buildImage(entry, at, ctx, errors) {
  const { ART_IMAGE_SOURCES, ART_IMAGE_LICENSE_LABEL } = ctx.artSource;
  const ref = entry.image;
  if (!isObject(ref)) { errors.push(`${at}: {source, sourceId, alt}여야 한다`); return null; }
  unknownKeys(ref, IMAGE_REF_KEYS, at, errors);
  const file = imageSnapshotPath(ctx.root, entry.id);
  const snapshot = ctx.read(file, entry.id, 'workId');
  if (!snapshot) { errors.push(`${at}: 그림 스냅샷 ${relative(ctx.root, file)}이 없다 — node scripts/art/snapshot-sources.mjs로 만든다`); return null; }
  const where = relative(ctx.root, file);
  if (snapshot.source !== ref.source || String(snapshot.sourceId) !== String(ref.sourceId)) {
    errors.push(`${at}: 고른 출처 ${ref.source}:${ref.sourceId}와 ${where}(${snapshot.source}:${snapshot.sourceId})가 다르다`);
    return null;
  }
  const source = Object.hasOwn(ART_IMAGE_SOURCES, snapshot.source ?? '') ? ART_IMAGE_SOURCES[snapshot.source] : null;
  if (!source) { errors.push(`${where}.source: ${Object.keys(ART_IMAGE_SOURCES).join('|')}`); return null; }
  if (!IMAGE_FILE.test(snapshot.file ?? '')) { errors.push(`${where}.file: public/art 아래 <이름>.jpg|webp`); return null; }
  if (!SHA256.test(snapshot.sha256 ?? '') || !Number.isInteger(snapshot.bytes)) { errors.push(`${where}: sha256·bytes가 필요하다`); return null; }
  const imageFile = path.join(ctx.publicDir, 'art', snapshot.file);
  if (!existsSync(imageFile)) { errors.push(`${at}: 그림 파일 ${imageFile}이 없다`); return null; }
  const bytes = readFileSync(imageFile);
  if (bytes.length !== snapshot.bytes || sha256(bytes) !== snapshot.sha256) {
    errors.push(`${at}: 그림 파일 ${imageFile}의 SHA-256·크기가 스냅샷 ${where}의 값과 다르다(파일이 바뀌었다 — 다시 받았으면 스냅샷을 다시 만든다)`);
    return null;
  }
  const record = isObject(snapshot.record) ? snapshot.record : {};
  const missing = source.creditFields.filter((key) => !isText(record[key]));
  if (missing.length) { errors.push(`${where}.record: 캡션 재료 ${missing.join('·')}가 필요하다`); return null; }
  const license = source.license(record);
  const label = ART_IMAGE_LICENSE_LABEL[license];
  if (!label) { errors.push(`${where}: 캡션을 만들 수 있는 그림 라이선스가 아니다(${license})`); return null; }
  return {
    url: `/art/${snapshot.file}`,
    sourceUrl: snapshot.sourceUrl,
    license,
    credit: source.credit(record, label),
    width: snapshot.width,
    height: snapshot.height,
    alt: ref.alt,
  };
}

/**
 * entry 하나 → works.json 작품 하나. 키 순서는 ART_ENTRY_KEYS(없는 선택 키는 빠진다).
 * @returns {{work: object|null, errors: string[]}}
 */
export function buildArtWork(entry, ctx) {
  const at = `${ART_FILES.entries}/${entry.id}.json`;
  const errors = [];
  unknownKeys(entry, ART_ENTRY_KEYS, at, errors);
  const refs = Array.isArray(entry.descriptions) ? entry.descriptions : [];
  if (refs.length === 0) errors.push(`${at}.descriptions: 해설 출처가 하나 이상 필요하다`);
  const descriptions = refs.map((ref, index) => buildDescription(ref, `${at}.descriptions[${index}]`, ctx, errors));
  const image = entry.image === undefined ? undefined : buildImage(entry, `${at}.image`, ctx, errors);
  if (errors.length) return { work: null, errors };
  const work = {};
  for (const key of ART_ENTRY_KEYS) {
    const value = key === 'descriptions' ? descriptions : key === 'image' ? image : entry[key];
    if (value !== undefined) work[key] = value;
  }
  return { work, errors };
}

/**
 * @param {{root?: string, publicDir?: string, check?: boolean}} options root는 카탈로그 폴더(기본 src/content/art), publicDir은 그림이 있는 public.
 * @returns {Promise<{works: number, descriptions: number, images: number, status: 'written'|'unchanged'|'checked'|null, errors: string[]}>}
 *   한 점이라도 실패하면 works.json을 쓰지 않는다.
 */
export async function buildArt({ root = ART_ROOT, publicDir = ART_PUBLIC_DIR, check = false } = {}) {
  const [artSource, { validateArtCatalog }] = await Promise.all([
    import('../../src/lib/artSource.js'),
    import('../../src/lib/artCatalog.js'),
  ]);
  const result = { works: 0, descriptions: 0, images: 0, status: null, errors: [] };
  const { entries, errors } = loadArtEntries(root);
  result.errors.push(...errors);
  const read = snapshotReader(root);
  const ctx = { root, publicDir, artSource, read };
  const works = [];
  for (const entry of entries) {
    try {
      const built = buildArtWork(entry, ctx);
      result.errors.push(...built.errors);
      if (built.work) works.push(built.work);
    } catch (error) {
      result.errors.push(`${ART_FILES.entries}/${entry.id}.json: ${error.message}`);
    }
  }
  if (result.errors.length) return result;

  // 생성물 계약 — 해설 길이·내부 메모·읽기 표시·라이선스·용어가 해설에 있는지(artCatalog). 손으로 쓰는 파일과 함께 본다.
  const catalog = { works };
  for (const name of HAND_FILES) catalog[name] = readJson(path.join(root, `${name}.json`));
  result.errors.push(...validateArtCatalog(catalog).map((error) => `catalog: ${error}`));
  if (result.errors.length) return result;

  result.works = works.length;
  result.descriptions = works.reduce((sum, work) => sum + work.descriptions.length, 0);
  result.images = works.filter((work) => work.image).length;
  const output = serializeWorks(works);
  const target = path.join(root, ART_FILES.works);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (check) {
    if (current !== output) result.errors.push(`${ART_FILES.works}이 entries·sources와 다르다 — node scripts/build-art.mjs로 다시 만든다(손으로 고치지 않는다)`);
    else result.status = 'checked';
  } else {
    if (current !== output) writeFileSync(target, output);
    result.status = current === output ? 'unchanged' : 'written';
  }
  return result;
}
