// 정본 책 카탈로그(LIT-IMPORT-1) — 나라별 「불러올 수 있는 인기작」 목록 한 파일(src/content/literature/catalog.json)과 그 규칙.
//
// 오너 「불러올 수 있는 나라별 인기 있는 작가나 작품 중심으로 리스트 정리 … 언제든 불러오고 사용자들이 실사용 할 수 있을 정도로 다듬는
// 과정까지 모두 프로세스 최적화」(2026-10-17 KST). 카탈로그 한 줄이 가져오기(scripts/literature/import.mjs)의 입력 전부다 — 출처 위치 ·
// 권리 사실(출판 · 몰년 · 원산국 · 번역자) · 한국어 표기 · 레벨 · 표지(실물 조사가 있으면 그 값, 없으면 시대 · 언어 틀). 사람이 entry.json을
// 손으로 쓰지 않는다. 수록되면 status가 「수록」이 되고 key가 그 작품 폴더를 가리킨다(계약 테스트가 둘을 맞춰 본다).
import { koreaPublicDomainVerdict, translatorRecords } from '../../src/lib/rightsKorea.js';
import { aozoraJurisdictionVerdict } from '../../src/lib/aozoraRights.js';
import { EN_LEVELS, FR_LEVELS, JP_LEVELS, ZH_LEVELS } from '../../src/lib/constants.js';
import { FIRST_EDITION_BINDINGS, TEMPLATE_BINDINGS, TEMPLATE_PALETTES, validateFirstEditionDisplay } from '../../src/lib/firstEditionCover.js';

export const CATALOG_PROVIDERS = Object.freeze(['aozora', 'standardebooks', 'wikisource', 'pdsite']);
export const CATALOG_STATUSES = Object.freeze(['수록', 'loadable', 'blocked']);
export const CATALOG_LANGUAGES = Object.freeze(['Japanese', 'English', 'Chinese', 'French', 'Korean']);
const KEY_PREFIX = Object.freeze({ aozora: 'aozora-', standardebooks: 'se-', wikisource: 'ws-', pdsite: 'pd-' });
/**
 * 카테고리(오너 「문학 책 리스트 카테고리화해서 정리」 → 「큰 카테고리에서 작은 카테고리로 들어가게」 2026-10-21 KST) — 작품의 형식으로 고른다
 * (주제 · 시대가 아니라). 큰 갈래(CATALOG_GROUPS) 셋 아래 작은 갈래(CATALOG_CATEGORIES) 아홉, 줄에는 작은 갈래 key 하나(큰 갈래는 거기서 나온다).
 * 모든 줄에 하나(수록 줄도 — 분류는 카탈로그가 매기는 것이라 entry.json의 사실과 겹치지 않는다). 순서가 목록의 차례다.
 * 경계: 장편 · 중편 · 단편 · 단편집은 모두 fiction(길이로 가르지 않는다 — 오너 「장편, 중단편은 그냥 소설로 통합」 2026-10-22 KST) · 서사시 · 산문시는 poetry ·
 * 옛이야기 · 동화 · 우화(짧은 이야기 모음 포함)는 tale · 어린 독자를 위한 긴 소설은 youth ·
 * 수필 · 기행 · 회고 수필은 essay · 자서전 · 일기 · 르포는 life · 철학 · 윤리 · 고전 사상은 thought · 정치 · 경제 · 사회 평론 · 선언서는 society.
 */
export const CATALOG_GROUPS = Object.freeze({ literature: '문학', young: '아동 · 청소년', nonfiction: '비문학' });
export const CATALOG_CATEGORIES = Object.freeze({
  fiction: Object.freeze({ group: 'literature', label: '소설' }),
  poetry: Object.freeze({ group: 'literature', label: '시' }),
  drama: Object.freeze({ group: 'literature', label: '희곡' }),
  tale: Object.freeze({ group: 'young', label: '동화 · 우화' }),
  youth: Object.freeze({ group: 'young', label: '아동 · 청소년 소설' }),
  essay: Object.freeze({ group: 'nonfiction', label: '수필 · 기행' }),
  life: Object.freeze({ group: 'nonfiction', label: '자서전 · 일기 · 르포' }),
  thought: Object.freeze({ group: 'nonfiction', label: '철학 · 사상' }),
  society: Object.freeze({ group: 'nonfiction', label: '사회 · 정치 · 경제' }),
});
/** 「문학 › 소설」 — 목록 머리 · 보기 줄에 쓴다. */
export const categoryPath = (key) => (Object.hasOwn(CATALOG_CATEGORIES, key ?? '') ? `${CATALOG_GROUPS[CATALOG_CATEGORIES[key].group]} › ${CATALOG_CATEGORIES[key].label}` : null);

/** 수록 줄의 key 머리 → 출처(작품 폴더가 사실의 정본 — 수록 줄은 가리키기만 한다). */
export const providerOfKey = (key) => Object.keys(KEY_PREFIX).find((provider) => String(key ?? '').startsWith(KEY_PREFIX[provider])) ?? null;

/**
 * 카탈로그 한 줄 검사 — 문제 목록(빈 배열이면 통과).
 * 수록 줄 = {id, key, status, country, category}만(제목 · 연도 · 권리는 작품 폴더 entry.json이 정본 — 두 곳에 적으면 어긋난다).
 * 불러올(loadable) 줄은 출처 위치 · 권리 사실 · 한국어 표기 · 레벨, 막힌(blocked) 줄은 막힌 이유가 있어야 한다.
 */
export function catalogEntryProblems(entry) {
  const problems = [];
  const need = (field, ok) => { if (!ok) problems.push(field); };
  need('id', typeof entry?.id === 'string' && /^[a-z]{2}-[a-z0-9-]+$/u.test(entry.id));
  need('country', typeof entry?.country === 'string' && /^[A-Z]{2}$/u.test(entry.country));
  need(`category(${Object.keys(CATALOG_CATEGORIES).join('·')})`, Object.hasOwn(CATALOG_CATEGORIES, entry?.category ?? ''));
  if (entry?.status === '수록') {
    need('key(정본 책 key)', providerOfKey(entry.key) !== null);
    const extra = Object.keys(entry).filter((field) => !['id', 'key', 'status', 'country', 'category', 'note'].includes(field));
    if (extra.length) problems.push(`수록 줄에 사실 칸(${extra.join('·')}) — 작품 폴더 entry.json이 정본`);
    return problems;
  }
  need(`language(${CATALOG_LANGUAGES.join('·')})`, CATALOG_LANGUAGES.includes(entry?.language));
  for (const field of ['title', 'author', 'titleKo', 'authorKo']) need(field, typeof entry?.[field] === 'string' && entry[field].trim().length > 0);
  need(`status(${CATALOG_STATUSES.join('·')})`, CATALOG_STATUSES.includes(entry?.status));
  need(`source.provider(${CATALOG_PROVIDERS.join('·')})`, CATALOG_PROVIDERS.includes(entry?.source?.provider));
  if (entry?.status === 'blocked') need('blocker(막힌 이유)', typeof entry.blocker === 'string' && entry.blocker.trim().length > 0);
  if (entry?.status !== 'blocked') {
    need('key', typeof entry?.key === 'string' && entry.key.startsWith(KEY_PREFIX[entry?.source?.provider] ?? '\u0000'));
    need(`level(${(CATALOG_LEVELS[entry?.language] ?? []).join('·')})`, (CATALOG_LEVELS[entry?.language] ?? []).includes(entry?.level));
    need('publishedYear', Number.isInteger(entry?.publishedYear));
    need('authorDeathYear', Number.isInteger(entry?.authorDeathYear));
    need('countryOfOrigin', typeof entry?.countryOfOrigin === 'string' && /^[A-Z]{2}$/u.test(entry.countryOfOrigin));
    problems.push(...sourceProblems(entry?.source ?? {}));
  }
  return problems;
}

function sourceProblems(source) {
  switch (source.provider) {
    case 'aozora': return Number.isInteger(source.workId) ? [] : ['source.workId(青空文庫 작품 ID)'];
    case 'standardebooks': return /^[a-z0-9-]+(?:_[a-z0-9-]+){1,4}$/u.test(source.repo ?? '') ? [] : ['source.repo(<작가>_<작품>[_<번역자>])'];
    case 'wikisource': return ['zh', 'fr', 'ko', 'en'].includes(source.wiki) && typeof source.main === 'string' && source.main ? [] : ['source.wiki · source.main'];
    case 'pdsite':
      if (source.site === 'fp' && /^[0-9A-Z]{8}$/u.test(source.id ?? '')) return [];
      if (source.site === 'gau' && /^ebooks\d*\/[0-9a-z]+h\.html$/u.test(source.path ?? '')) return [];
      return ['source.site · source.id(Faded Page) 또는 source.path(PGA)'];
    default: return [];
  }
}

/**
 * 언어별 레벨 표기 — 서재 · 레벨 거르기와 같은 목록(constants.js). 한국어는 4종 상수 밖(오너 결정)이라 정본 책이 쓰는 세 단계.
 */
export const CATALOG_LEVELS = Object.freeze({
  Japanese: JP_LEVELS, English: EN_LEVELS, French: FR_LEVELS, Chinese: ZH_LEVELS, Korean: Object.freeze(['초급', '중급', '고급']),
});

/**
 * 카탈로그 줄 → 공개 가능 판정(가져오기 전에 막는다). 아오조라는 D5 선정 기준(일본 보호기간 만료 = 한국도 만료, 저작권법 3조 4항 —
 * aozoraRights · 人間椅子 · 刺青 선례), 그 밖은 rightsKorea(한국 보호기간 또는 원산국 만료 · 번역본은 번역자까지).
 */
export function catalogRightsVerdict(entry, reviewedAt) {
  if (entry.source?.provider === 'aozora') {
    const verdict = aozoraJurisdictionVerdict(entry);
    return { ok: verdict.ok, basis: 'aozora-d5(JP 만료)', reasons: verdict.ok ? [] : [`작가 ${entry.authorDeathYear ?? '?'} 사망 — 일본 보호기간이 끝나지 않았다(1968년 전 사망만)`] };
  }
  return koreaPublicDomainVerdict({
    publishedYear: entry.publishedYear,
    authorDeathYear: entry.authorDeathYear,
    countryOfOrigin: entry.countryOfOrigin,
    mortPourLaFrance: entry.mortPourLaFrance ?? (entry.countryOfOrigin === 'FR' ? false : null),
    translator: entry.translator ?? null,
    rights: { reviewedAt },
  });
}

/** 결정적 고르기 — 같은 key는 늘 같은 색(책마다 다르게 보이도록 key 해시로). */
function pick(list, key) {
  const hash = [...key].reduce((value, char) => (Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0), 2166136261);
  return list[hash % list.length];
}

/** 표지에 쓰는 이름 — 위키문헌 문서 이름의 구별 괄호(「홍길동전 (김유정)」 · 「고향 (현진건)」)는 앞표지 글자가 아니다. */
const coverName = (text) => String(text).replace(/\s*\([^)]*\)$/u, '').trim();

/** 세로 제목 — 8자 이하 한 열, 넘으면 띄어쓰기에서 두 열(한국어), 띄어쓰기가 없으면 가운데서(중국어). 두 열로도 안 되면 그대로(검사가 막는다). */
function verticalTitle(title) {
  const chars = [...title];
  if (chars.length <= 8) return title;
  if (/\s/u.test(title)) return breakTitle(title, 8, 2) ?? title;
  const half = Math.ceil(chars.length / 2);
  return half <= 8 ? `${chars.slice(0, half).join('')}\n${chars.slice(half).join('')}` : title;
}

/** 표지 제목 줄 나누기 — 단어 경계에서 max자 이하 줄로(최대 lines줄). 못 나누면 null. */
export function breakTitle(title, max, lines) {
  // 붙임표 낱말(gentleman-cambrioleur)은 붙임표 뒤에서도 줄을 넘길 수 있다 — 붙임표는 앞줄 끝에 남는다
  const words = String(title).trim().split(/\s+/u).flatMap((word) => (word.length > max && word.includes('-') ? word.split(/(?<=-)/u) : [word]));
  const out = [];
  for (const word of words) {
    if (word.length > max) return null;
    const joined = out.at(-1)?.endsWith('-') ? `${out.at(-1)}${word}` : `${out.at(-1)} ${word}`;
    if (out.length && joined.length <= max) out[out.length - 1] = joined;
    else out.push(word);
  }
  return out.length <= lines ? out.join('\n') : null;
}

const CLOTH = Object.keys(TEMPLATE_PALETTES).filter((key) => TEMPLATE_PALETTES[key].material === 'cloth');
const PAPER = ['cream', 'buff', 'grey', 'yellow'];

/**
 * 표지 표기 — 카탈로그에 실물 조사(cover)가 있으면 그것, 없으면 시대 · 언어 틀(초판 관례):
 *   중국어 · 한국어 → 세로 표지 · 프랑스어 → 인쇄 표지 · 영어 1830년 전 → 속표지 · 1830–1919 → 천 장정(금박 제목) · 1920년 뒤 → 활판 재킷.
 * 출판사 · 출판지처럼 조사하지 않은 사실은 지어내지 않는다(그 칸은 비워 둔다 — 틀이 선택 칸으로 받는다).
 * 표지 연도는 그 판의 출판 연도 — 번역본은 번역 판의 해(고대 원작은 로마 숫자로 못 쓴다).
 */
export function catalogCoverDisplay(entry) {
  const base = { titleKo: entry.titleKo, authorKo: entry.authorKo };
  if (entry.cover) return { ...base, ...entry.cover };
  // 번역본은 번역 판의 해 — 번역자가 여럿이면(모음집) 가장 늦은 판
  const years = translatorRecords(entry.translator).map((item) => item.publishedYear).filter(Number.isInteger);
  const year = years.length ? Math.max(...years) : entry.publishedYear;
  const key = entry.key;
  if (entry.language === 'Chinese' || entry.language === 'Korean') {
    return { ...base, binding: 'tpl-cjk-vertical', coverTitle: verticalTitle(coverName(entry.title)), coverAuthor: coverName(entry.author), coverPalette: pick(PAPER, key) };
  }
  if (entry.language === 'French') {
    return { ...base, binding: 'tpl-wrapper', coverTitle: breakTitle(coverName(entry.title), 18, 3), coverAuthor: entry.author, coverPalette: pick(PAPER, key), coverOrnament: 'double-rule', coverYear: year };
  }
  if (year < 1830) {
    return { ...base, binding: 'tpl-title-page', coverTitle: breakTitle(coverName(entry.title), 24, 6), coverAuthor: `By ${entry.author}`, coverPalette: 'cream', coverYear: year };
  }
  if (year < 1920) {
    return { ...base, binding: 'tpl-cloth', coverTitle: breakTitle(coverName(entry.title), 22, 3), coverPalette: pick(CLOTH, key), coverOrnament: 'gilt-title' };
  }
  return { ...base, binding: 'tpl-jacket', coverTitle: breakTitle(coverName(entry.title), 16, 3), coverAuthor: entry.author, coverPalette: pick(PAPER, key) };
}

/** 표지 표기가 장정 규칙을 통과하는가 — 통과하면 정리된 표기, 아니면 throw(가져오기가 사람에게 넘긴다). 아오조라는 시리즈 A라 따로. */
export function checkedCover(entry) {
  const display = catalogCoverDisplay(entry);
  if (!Object.hasOwn(FIRST_EDITION_BINDINGS, display.binding)) throw new Error(`장정 ${display.binding}을 모른다`);
  return validateFirstEditionDisplay(display);
}

export { TEMPLATE_BINDINGS };
