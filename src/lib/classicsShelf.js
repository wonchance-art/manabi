// 산책 「고전 명작」 책 구간(DISCOVER-CLASSICS-001, 오너 「권장대로 ㄱㄱ」 2026-10-22 KST) — 서버에서만 쓰는 순수 모듈.
//
// 표시(제목 · 작가 · 레벨 · 장 수 · 표지)는 저장소 정본 대조표(출처 넷의 manifest.display.generated.json)에서, 갈래는 카탈로그
// (src/content/literature/catalog.json의 category)에서 온다 — 둘 다 저장소 파일이라 누구도 꾸밀 수 없다.
// 「어느 자료를 열까」만 DB의 발행 기록(canonical_book_shelf() — CANON-RELEASE-001)에서 받는다. 발행 기록이 없는 책은 보이지 않는다
// (공개 metadata는 누구나 꾸밀 수 있어 key만 보고 정본으로 열지 않는다 — fail closed).
// 대조표 · 카탈로그(수백 KB)를 브라우저 번들에 싣지 않도록 서버 화면(app/(app)/discover/classics/page.jsx)만 import한다.
import catalog from '../content/literature/catalog.json';
import publishOrder from '../content/literature/publish-order.json';
import aozora from '../content/literature/aozora/manifest.display.generated.json';
import standardEbooks from '../content/literature/standardebooks/manifest.display.generated.json';
import wikisource from '../content/literature/wikisource/manifest.display.generated.json';
import pdSite from '../content/literature/pdsite/manifest.display.generated.json';
import { CATALOG_CATEGORIES, CATALOG_GROUPS } from './literatureCategories';
import { SCOPE_LANG_LABELS } from './reviewScopeUrl';

/** 출처 → 대조표 · 자료 언어(대조표에 언어 칸이 없는 출처는 한 언어뿐이다). */
const SOURCES = Object.freeze({
  aozora: { works: aozora.works, language: 'Japanese' },
  standardebooks: { works: standardEbooks.works, language: 'English' },
  wikisource: { works: wikisource.works, language: null },
  pdsite: { works: pdSite.works, language: null },
});
const PROVIDER_OF_PREFIX = Object.freeze({ aozora: 'aozora', se: 'standardebooks', ws: 'wikisource', pd: 'pdsite' });
/** 언어 칩 차례 — 학습 언어 순서(일 · 영 · 프 · 중) 뒤에 한국어. */
export const CLASSICS_LANGUAGES = Object.freeze(['Japanese', 'English', 'French', 'Chinese', 'Korean']);
/** HTML lang — 중국어 정본은 간체가 정본이다(WS_SCRIPT.canonical). */
const HTML_LANG = Object.freeze({ Japanese: 'ja', English: 'en', French: 'fr', Chinese: 'zh-Hans', Korean: 'ko' });

export const classicsLanguageName = (language) => SCOPE_LANG_LABELS[language] || language;
export const classicsHtmlLang = (language) => HTML_LANG[language];

/**
 * 수록 책 전부(카탈로그 차례 = 나라 안 인기 순) → 화면 한 칸 모양. 대조표에 없는 수록 줄은 빼지 않고 오류로 — 계약이 잡는다.
 * @returns {{key, provider, language, title, titleKo, author, authorKo, level, total, category, group, work}[]}
 */
export function classicsWorks(works = catalog.works) {
  return works.filter((entry) => entry.status === '수록').map((entry) => {
    const provider = PROVIDER_OF_PREFIX[entry.key.split('-')[0]];
    const source = SOURCES[provider];
    const work = source && Object.hasOwn(source.works, entry.key) ? source.works[entry.key] : null;
    if (!work) throw new Error(`고전 명작: 대조표에 없는 수록 줄 ${entry.id} (${entry.key})`);
    return {
      key: entry.key, provider, language: source.language || work.language,
      title: work.title, titleKo: work.display?.titleKo || null, author: work.author, authorKo: work.display?.authorKo || work.author,
      level: work.level || null, total: work.total, category: entry.category, group: CATALOG_CATEGORIES[entry.category].group, work,
    };
  });
}

/**
 * 공개 차례(오너 「수록된 것과 인기작부터 권장대로 공개」 2026-10-23 KST) — 언어를 번갈아(일 · 영 · 프 · 중 · 한) 하나씩.
 * 각 언어 안의 차례는 publish-order.json의 앞줄(대표작 · 짧은 장 먼저) 다음 나머지 카탈로그 차례. 카탈로그의 수록 줄은 가져온 차례로 쌓여
 * 인기 순이 아니다(영어 1 · 2번이 도덕감정론 · 국부론이었다). 한 언어만 수십 권 먼저 공개되면 고전 명작의 다른 언어 칩이 오래 빈다.
 * 관리자 게시 화면(/api/admin/literature) 목록 · 「모두 게시 · 분석」 대기열이 이 차례를 쓴다. key → 0부터의 순위.
 */
export function classicsPublishRank(works = classicsWorks(), first = publishOrder.first) {
  const lanes = CLASSICS_LANGUAGES.map((language) => {
    const own = works.filter((item) => item.language === language);
    const head = (first[language] || []).filter((key) => own.some((item) => item.key === key));
    return [...head, ...own.map((item) => item.key).filter((key) => !head.includes(key))];
  });
  const order = [];
  for (let i = 0; lanes.some((lane) => i < lane.length); i++) for (const lane of lanes) if (lane[i]) order.push(lane[i]);
  return new Map(order.map((key, rank) => [key, rank]));
}

/** 책 배열(book.book.key) → 공개 차례로. 차례에 없는 책(정본 대조표에만 있는 책)은 원래 순서대로 뒤에. */
export function sortByPublishRank(books, rank = classicsPublishRank()) {
  const at = (book) => (rank.has(book?.book?.key) ? rank.get(book.book.key) : Number.MAX_SAFE_INTEGER);
  return books.map((book, index) => ({ book, index })).sort((a, b) => at(a.book) - at(b.book) || a.index - b.index).map(({ book }) => book);
}

/** 발행 기록(canonical_book_shelf 행)이 있는 책만 — 첫 장 id · 공개 장 수를 붙인다. 순서는 카탈로그 그대로. */
export function releasedClassics(works, shelfRows) {
  const byKey = new Map((shelfRows || []).filter((row) => row && Number.isSafeInteger(Number(row.first_material_id)))
    .map((row) => [row.book_key, row]));
  return works.filter((item) => byKey.has(item.key)).map((item) => {
    const row = byKey.get(item.key);
    return { ...item, firstMaterialId: Number(row.first_material_id), chapters: Number(row.chapters) || item.total };
  });
}

/** 주소 질의 → 거르기. 모르는 값은 버린다(빈 목록으로 지나가지 않게 — 칩에 없는 값은 「전체」). */
export function classicsFilters(params = {}) {
  const pick = (key) => (typeof params[key] === 'string' ? params[key] : Array.isArray(params[key]) ? params[key][0] : '') || '';
  const lang = pick('lang'), group = pick('group'), cat = pick('cat'), author = pick('author').trim().slice(0, 80);
  const validCat = Object.hasOwn(CATALOG_CATEGORIES, cat) ? cat : '';
  return {
    lang: CLASSICS_LANGUAGES.includes(lang) ? lang : '',
    // 작은 갈래를 고르면 큰 갈래는 그 갈래의 것이다(주소에 엇갈린 둘이 와도 한 길).
    group: validCat ? CATALOG_CATEGORIES[validCat].group : Object.hasOwn(CATALOG_GROUPS, group) ? group : '',
    cat: validCat,
    author,
  };
}

const matches = (item, { lang, group, cat, author }) => (!lang || item.language === lang)
  && (!group || item.group === group) && (!cat || item.category === cat) && (!author || item.authorKo === author);

export const filterClassics = (items, filters) => items.filter((item) => matches(item, filters));

/**
 * 칩 — 책이 있는 것만. 언어 칩은 갈래를 뺀 거르기로, 갈래 칩은 언어(+ 작가)를 둔 거르기로 센다
 * (고른 언어에 없는 갈래는 칩이 없다). 큰 갈래를 고르면 그 아래 작은 갈래 칩(둘 이상일 때만 — 하나면 고를 게 없다).
 */
export function classicsChips(items, filters) {
  const languages = CLASSICS_LANGUAGES.filter((language) => items.some((item) => matches(item, { ...filters, lang: language, group: '', cat: '' })));
  const inLanguage = filterClassics(items, { ...filters, group: '', cat: '' });
  const groups = Object.keys(CATALOG_GROUPS).filter((group) => inLanguage.some((item) => item.group === group));
  const categories = filters.group
    ? Object.keys(CATALOG_CATEGORIES).filter((cat) => CATALOG_CATEGORIES[cat].group === filters.group && inLanguage.some((item) => item.category === cat))
    : [];
  return { languages, groups, categories: categories.length > 1 ? categories : [] };
}

/** 같은 화면 안 이동 주소 — 바꾸는 칸만 덮어쓰고 빈 값은 지운다. 순서 고정(lang · group · cat · author). */
export function classicsHref(filters, patch = {}) {
  const next = { ...filters, ...patch };
  const query = new URLSearchParams();
  for (const key of ['lang', 'group', 'cat', 'author']) if (next[key]) query.set(key, next[key]);
  return `/discover/classics${query.size ? `?${query}` : ''}`;
}

export const classicsGroupLabel = (group) => CATALOG_GROUPS[group];
export const classicsCategoryLabel = (cat) => CATALOG_CATEGORIES[cat]?.label;
