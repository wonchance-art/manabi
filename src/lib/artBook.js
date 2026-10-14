// 「그림 한 장 읽기」 큐레이션 책 — 카탈로그(src/content/art) → 정본 책 장(ART-P0-3, 2026-10-14 KST 오너 「ㄱㄱ」).
//
// 작품 한 점 = 일본어 해설 한 장. 장 원문(rawText)은 카탈로그에 실린 해설 text 그대로이고, 그 SHA-256은 카탈로그의
// description.textSha256과 같다 — 따로 대조표를 만들지 않고 카탈로그가 곧 정본 대조표다(아오조라 manifest.generated.json 역할).
// 책·장 모양은 정본 문학책(literaturePublish.js)과 같아서 게시(준비 → 분석 → 검수 → 공개)·서재 묶음·뷰어 장 이동을 그대로 쓴다.
// 출처는 metadata.literature에 provider 'art'로 싣는다 — rubyLocks·reviewHints 키는 두지 않는다(저자 루비가 없는 현대 해설문).
import { ART_CATALOG } from '../content/art/index.js';
import { ART_TEXT_LICENSE_LABEL, artInfoCard, validateArtCatalog } from './artCatalog.js';
import { sha256Hex } from './literatureCanonical.js';

export const ART_BOOK_PROVIDER = 'art';
export const ART_BOOK_VERSION = 1;
const BOOK_LANGUAGE = 'ja';
const MATERIAL_LANGUAGE = 'Japanese';

/** 책으로 게시하는 큐레이션 — 작가별 큐레이션은 이 책의 부분집합이라 따로 게시하지 않는다(같은 해설이 두 행이 되지 않게). */
export const ART_PUBLISHED_CURATIONS = Object.freeze(['ukiyoe-landscape-hokusai-hiroshige']);

export const artBookKey = (curationId) => `art-${curationId}`;

const unique = (values) => [...new Set(values)];

/**
 * 큐레이션 → 정본 책(literaturePublish.js가 받는 모양). 없는 큐레이션·일본어 해설 없는 작품이면 throw(fail-closed).
 * @returns {{schemaVersion, book: {key, title, author, level, total}, chapters: Array<{order, title, materialTitle, rawText, metadata}>}}
 */
export function createArtBook(curationId, catalog = ART_CATALOG) {
  const curation = catalog.curations.find((item) => item.id === curationId);
  if (!curation) throw new TypeError(`없는 큐레이션 ${curationId}`);
  if (typeof curation.level !== 'string' || !curation.level) throw new TypeError(`${curationId}.level: 책 레벨(편집 라벨)이 필요하다`);
  const title = curation.title?.native;
  if (typeof title !== 'string' || !title || title.includes(' — ')) throw new TypeError(`${curationId}.title.native: 「 — 」 없는 책 제목이 필요하다(장 제목 구분자)`);
  const workById = new Map(catalog.works.map((work) => [work.id, work]));
  const artistById = new Map(catalog.artists.map((artist) => [artist.id, artist]));
  const works = curation.works.map((id) => {
    const work = workById.get(id);
    if (!work) throw new TypeError(`${curationId}: 없는 작품 ${id}`);
    return work;
  });
  const author = unique(works.map((work) => artistById.get(work.artist)?.name?.native).filter(Boolean)).join('・');
  const key = artBookKey(curationId);
  const total = works.length;
  const book = { key, title, author, level: curation.level, total };
  const chapters = works.map((work, index) => {
    const description = work.descriptions.find((item) => item.language === BOOK_LANGUAGE);
    if (!description) throw new TypeError(`${work.id}: 일본어 해설이 없다 — 책 장이 될 수 없다`);
    const order = index + 1;
    return {
      order,
      title: work.title.native,
      materialTitle: `${title} — ${work.title.native}`,
      rawText: description.text,
      metadata: {
        language: MATERIAL_LANGUAGE,
        level: curation.level,
        book: { key, title, author, order, total },
        literature: {
          schemaVersion: ART_BOOK_VERSION,
          provider: ART_BOOK_PROVIDER,
          curation: curation.id,
          work: work.id,
          wikidata: work.wikidata,
          source: description.source,
          sourceId: description.sourceId,
          sourceUrl: description.sourceUrl,
          license: description.license,
          credit: description.credit,
          textSha256: description.textSha256,
        },
      },
    };
  });
  return { schemaVersion: ART_BOOK_VERSION, book, chapters };
}

/** 게시 대상 책 목록 — 관리자 게시 API가 쓴다. */
export function artBooks(catalog = ART_CATALOG) {
  return ART_PUBLISHED_CURATIONS.map((id) => createArtBook(id, catalog));
}

/**
 * 게시 직전 fail-closed 판정 — 카탈로그 계약 통과 + 장마다 원문 해시·라이선스가 카탈로그와 같다.
 * (해시 대조는 비동기라 동기 판정은 형식·라이선스까지만. 원문 해시는 verifyArtBookTexts로.)
 */
export function artBookPublishable(book, catalog = ART_CATALOG) {
  if (!Array.isArray(book?.chapters) || book.chapters.length === 0) return false;
  if (validateArtCatalog(catalog).length > 0) return false;
  const works = new Map(catalog.works.map((work) => [work.id, work]));
  return book.chapters.every((chapter) => {
    const literature = chapter?.metadata?.literature;
    if (literature?.provider !== ART_BOOK_PROVIDER) return false;
    const description = works.get(literature.work)?.descriptions.find((item) => item.sourceId === literature.sourceId && item.language === BOOK_LANGUAGE);
    return Boolean(description)
      && description.text === chapter.rawText
      && description.textSha256 === literature.textSha256
      && Object.hasOwn(ART_TEXT_LICENSE_LABEL, literature.license);
  });
}

/** 장 원문 해시가 카탈로그 해시와 같은가 — 빌드·테스트용. 어긋난 장 order 배열. */
export async function verifyArtBookTexts(book) {
  const mismatched = [];
  for (const chapter of book.chapters) {
    if ((await sha256Hex(chapter.rawText)) !== chapter.metadata.literature.textSha256) mismatched.push(chapter.order);
  }
  return mismatched;
}

/** 큐레이션 책 자료인가(동기 — metadata만 본다). 원문 수정 차단 판정에 쓴다. */
export function isArtBookMaterial(material) {
  return material?.processed_json?.metadata?.literature?.provider === ART_BOOK_PROVIDER;
}

/**
 * 뷰어 정보 카드 — 자료 raw_text의 SHA-256이 카탈로그 해설 해시와 같고, 그 작품이 책의 같은 순서에 있을 때만 카드 값을 준다.
 * 남이 자기 공개 자료에 provider 'art' metadata를 꾸며 넣어도 원문이 정본과 다르면 카드(크레딧 포함)가 보이지 않는다.
 * @returns {Promise<null | {card, credit: {credit, license, sourceUrl}, book: {key, title, order, total}}>}
 */
export async function verifiedArtChapter(material, catalog = ART_CATALOG) {
  const metadata = material?.processed_json?.metadata;
  const literature = metadata?.literature;
  if (literature?.provider !== ART_BOOK_PROVIDER || typeof material?.raw_text !== 'string') return null;
  const curationId = typeof literature.curation === 'string' ? literature.curation : '';
  if (!ART_PUBLISHED_CURATIONS.includes(curationId)) return null;
  let book;
  try { book = createArtBook(curationId, catalog); } catch { return null; }
  const order = Number(metadata?.book?.order);
  const chapter = book.chapters.find((item) => item.order === order);
  if (!chapter || chapter.metadata.literature.work !== literature.work || metadata?.book?.key !== book.book.key) return null;
  let hash;
  try { hash = await sha256Hex(material.raw_text); } catch { return null; }
  if (hash !== chapter.metadata.literature.textSha256) return null;
  const card = artInfoCard(catalog, chapter.metadata.literature.work);
  if (!card) return null;
  const { credit, license, sourceUrl } = chapter.metadata.literature;
  return {
    card,
    credit: { credit, license: ART_TEXT_LICENSE_LABEL[license] ?? null, sourceUrl },
    book: { key: book.book.key, title: book.book.title, order, total: book.book.total },
  };
}
