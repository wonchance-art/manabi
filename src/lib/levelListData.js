// 레벨별 단어 · 문형 목록(LEVEL-LIST-AJ-001) — 서버 조립. 콘텐츠 본문 전체를 들이므로 서버(RSC · 라우트)에서만 부른다(클라이언트 import 금지 — levelList 계약).
// 새 목록 · 새 이름 사전을 만들지 않는다(인계 §3): 일본어 단어 = JAPANESE_VOCAB_REF, 중국어 단어 = 우리 사전
// (src/content/chinese vocab), 문형 = getBunkei. 개수는 하드코딩하지 않고 여기서 센다.
//
// 중국어 단어 급수는 HSK 2026(보완 6146777048 · 회신 6147574029): 우리 사전 단어 중 2026 급수가 그 레벨인 것만.
// 급수 조회는 화면 표시 정본 zhHskLevel.js 하나를 쓴다(zhHskLevelSites 계약). 우리 사전 세트 파일 위치(h1~h6)는
// 옛 급수라 레벨이 아니다. 중국어 문형은 2026 문법 자료가 없어 콘텐츠 레벨(H1~H6) 그대로다.
import { JAPANESE_VOCAB_REF } from './japaneseVocabRegistry';
import { getBunkei as getJaBunkei, countBunkei as countJaBunkei } from '../content/japanese';
import { getVocab as getZhVocab, getBunkei as getZhBunkei, countBunkei as countZhBunkei, ZH_LEVEL_META, ZH_HSK79_VOCAB } from '../content/chinese';
import { loadZhHskLevels, zhHskLevelOf } from './zhHskLevel';
import { LEVEL_HUN_PX, LEVEL_LIST_LANGS, compactLevelEntry, hunShapeOf, levelKinds, levelWordKey, shortMeaning } from './levelList';
import { hunRubyCells } from './viewerHunRuby';
import { loadHanziTable } from './zhHanzi';
import { alignFurigana } from './jaFurigana';
import { splitKanjiReadings } from './jaKanjiReading';
import { decodeJaPieces, jaExampleKey, jaExampleWords } from './jaExampleWords';
import jaJeongja from './data/jaJeongja.json';

const bunkeiOf = { japanese: getJaBunkei, chinese: getZhBunkei };
const bunkeiCountOf = { japanese: countJaBunkei, chinese: countZhBunkei };

/** 중국어 단어 묶음 — 사전 세트의 주제는 옛 급수의 보강 묶음이라 2026 레벨에서는 품사로 묶는다. */
export const ZH_POS_GROUPS = [
  { name: '명사', pos: ['명사'] },
  { name: '동사', pos: ['동사', '조동사'] },
  { name: '형용사', pos: ['형용사', '구별사'] },
  { name: '부사', pos: ['부사'] },
  { name: '대명사 · 수 · 양사', pos: ['대명사', '수사', '양사', '수량사'] },
  { name: '기능어', pos: ['전치사', '접속사', '조사', '감탄사', '접미사', '접두사'] },
  { name: '표현', pos: [] }, // 표현 · 성어 · 관용구 · 그 밖
];
const zhGroupOf = (pos) => {
  const at = ZH_POS_GROUPS.findIndex((g) => g.pos.includes(pos));
  return at < 0 ? ZH_POS_GROUPS.length - 1 : at;
};
const pinyinOrder = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toLowerCase();

const jaExample = (ex) => (ex?.ja ? { text: ex.ja, reading: ex.yomi || '', ko: ex.ko || '' } : null);
const zhExample = (ex) => (ex?.zh ? { text: ex.zh, reading: ex.pinyin || '', ko: ex.ko || '' } : null);

function japaneseVocabGroups(levelKey) {
  const vocab = JAPANESE_VOCAB_REF.getVocab(levelKey);
  if (!vocab) return null;
  const seen = new Set();
  return vocab.themes.map((theme) => ({
    name: theme.name,
    entries: theme.words.flatMap((w) => {
      const key = levelWordKey(w.ja);
      if (!key || seen.has(key)) return [];
      seen.add(key);
      // 화면 전달 크기 — 표제어와 같은 key · 짧은 뜻과 같은 전체 뜻은 생략(화면이 levelEntry로 되살린다).
      return [compactLevelEntry({ key, word: w.ja, reading: w.yomi || '', meaning: shortMeaning(w.ko), fullMeaning: w.ko || '', pos: w.pos || '', ex: jaExample(w.ex) })];
    }),
  })).filter((g) => g.entries.length);
}

let zhDictionary = null;
/** 우리 사전 표제어 → 첫 항목(콘텐츠 레벨 낮은 순, 생활 어휘 다음, 7–9 통합 밴드 보강 마지막). */
function chineseDictionary() {
  if (zhDictionary) return zhDictionary;
  const map = new Map();
  const sets = [...ZH_LEVEL_META.map((meta) => getZhVocab(meta.key)), ...ZH_HSK79_VOCAB];
  for (const set of sets) {
    for (const theme of set?.themes || []) {
      for (const w of theme.words || []) {
        const key = levelWordKey(w.zh);
        if (key && !map.has(key)) map.set(key, w);
      }
    }
  }
  zhDictionary = map;
  return map;
}

// 훈음 자리 모양(LEVEL-HUN-HOLD-001) — 화면과 같은 표 · 같은 함수(hunRubyCells, 정체 꼴로 찾기)로 서버에서 줄 수 · 칸 폭만 센다.
let hunTablesPromise = null;
function loadHunTables() {
  if (!hunTablesPromise) hunTablesPromise = Promise.all([import('./data/hanjaKo.json'), import('./data/hanjaHun.json'), import('./data/hanjaTrad.json')])
    .then(([ko, hun, trad]) => ({ koTable: ko.default || ko, hunTable: hun.default || hun, tradTable: trad.default || trad }))
    .catch((error) => { hunTablesPromise = null; throw error; });
  return hunTablesPromise;
}
function hunShapeField(word, tables) {
  const hun = hunShapeOf(hunRubyCells(word, tables, LEVEL_HUN_PX));
  return hun ? { hun } : {};
}

async function chineseVocabGroups(levelKey) {
  const level = Number(String(levelKey).slice(1));
  const [table, hunTables] = await Promise.all([loadZhHskLevels(), loadHunTables()]);
  const groups = ZH_POS_GROUPS.map((g) => ({ name: g.name, entries: [] }));
  for (const [key, w] of chineseDictionary()) {
    if (zhHskLevelOf(key, table) !== level) continue;
    groups[zhGroupOf(w.pos)].entries.push(compactLevelEntry({ key, word: w.zh, reading: w.pinyin || '', meaning: shortMeaning(w.ko), fullMeaning: w.ko || '', pos: w.pos || '', ex: zhExample(w.ex),
      ...hunShapeField(w.zh, hunTables) }));
  }
  for (const g of groups) g.entries.sort((a, b) => pinyinOrder(a.reading).localeCompare(pinyinOrder(b.reading)) || a.word.localeCompare(b.word, 'zh'));
  return groups.filter((g) => g.entries.length);
}

/**
 * 예문 단어 나눔(HSK 단어 페이지 「예문 단어 창」) — 앱 분석기와 같은 분할(tokenizeZhLine = jieba-wasm + fixZhTagged)의 조각 길이(글자 수) 배열.
 * 카드 단어는 분할이 갈라도 한 조각으로 묶는다(장미색 한 칸). 조각을 이어 붙여 원문이 안 되면(분할기가 글자를 건너뜀) null — 화면은 나누지 않고 그린다.
 * 정적 조립(generateStaticParams)이라 빌드 때 한 번 돈다. 화면은 분석기를 받지 않는다.
 */
export function exampleSegments(text, word, pieces) {
  const chars = [...String(text || '')];
  if (!chars.length || !pieces?.length || pieces.join('') !== chars.join('')) return null;
  const cuts = new Set([0, chars.length]);
  let at = 0;
  for (const p of pieces) { at += [...p].length; cuts.add(at); }
  const w = [...String(word || '')];
  if (w.length > 1) {
    for (let i = 0; i + w.length <= chars.length; i++) {
      if (w.every((c, j) => chars[i + j] === c)) {
        for (let k = i + 1; k < i + w.length; k++) cuts.delete(k);
        cuts.add(i); cuts.add(i + w.length);
        i += w.length - 1;
      }
    }
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  const seg = sorted.slice(1).map((c, i) => c - sorted[i]);
  return seg.length > 1 ? seg : null;
}

async function withExampleSegments(groups) {
  const { tokenizeZhLine } = await import('./server/tokenizeZh');
  return groups.map((g) => ({ ...g, entries: g.entries.map((e) => {
    if (!e.ex?.text) return e;
    const seg = exampleSegments(e.ex.text, e.word, tokenizeZhLine(e.ex.text).map((t) => t.text));
    return seg ? { ...e, ex: { ...e.ex, seg } } : e;
  }) }));
}

// ── JLPT 단어 페이지(오너 확정 2026-10-19 KST · 문서 「일본어 판에서 달라지는 점」) — 빌드 때 계산해 싣는다 ──

const JA_HAN = /[\p{Script=Han}々]/u;

/** 글자별 읽기 문자열 — 표제어 글자마다 쉼표로(가나 자리는 빈 칸). 経験 → 「けい,けん」, 話し合い → 「はな,,あ,」. 없으면 undefined. */
export function jaKanjiReadingField(word, reading, table) {
  const parts = splitKanjiReadings(word, reading, table);
  return parts ? parts.join(',') : undefined;
}

/** 예문 후리가나 — alignFurigana 결과를 [시작, 글자 수, 읽기](글자 = 코드 포인트) 목록으로. 맞추지 못하면 null. */
export function jaExampleFurigana(text, reading) {
  const parts = alignFurigana(text, reading);
  if (!parts) return null;
  const out = [];
  let at = 0;
  for (const p of parts) {
    const n = [...p.text].length;
    if (p.rt) out.push([at, n, p.rt]);
    at += n;
  }
  return at === [...String(text)].length && out.length ? out : null;
}

let jaReadingTable = null;
async function loadJaReadingTable() {
  jaReadingTable ||= import('./data/jaKanjiReadings.json').then((m) => (m.default || m).r)
    .catch((error) => { jaReadingTable = null; throw error; });
  return jaReadingTable;
}

/**
 * JLPT 짧은 뜻 — 표제어를 그대로 되풀이한 한자 괄호를 뗀다(경의(敬意) → 경의 · 경영(經營) → 경영, 정자 꼴도 같다고 본다) · 끝 마침표도(시안 ⑳).
 * 괄호 안이 표제어(또는 그 정자 꼴)와 같을 때만 떼고, 다른 한자를 밝히는 괄호는 남긴다. 뜻 원문(fullMeaning)은 그대로.
 */
export function jaPlainMeaning(meaning, word) {
  const same = new Set([String(word || ''), [...String(word || '')].map((c) => jaJeongja.j[c] || c).join('')]);
  return String(meaning || '')
    .replace(/[(（]([\p{Script=Han}々]+)[)）]/gu, (m, inner) => (same.has(inner) ? '' : m))
    .replace(/[.。]\s*$/u, '').trim();
}

const jaExtrasMemo = new Map();
/**
 * JLPT 단어 화면 묶음 — 글자별 읽기(kr) · 예문 후리가나(furi) · 예문 단어 나눔(seg · lem). 레벨마다 한 번(책장 타일 수와 화면이 같이 부른다).
 * 예문 형태소 분석은 미리 만든 표(jaExampleWords.json — 시험이 만들고 신선도를 지킨다)를 쓴다. 표에 없는 예문은 나누지 않는다.
 */
function withJapaneseWordExtras(levelKey, groups) {
  if (!jaExtrasMemo.has(levelKey)) {
    jaExtrasMemo.set(levelKey, Promise.all([loadJaReadingTable(), import('./data/jaExampleWords.json')]).then(([table, words]) => {
      const pieceTable = (words.default || words).v;
      return groups.map((g) => ({ ...g, entries: g.entries.map((e) => {
        const kr = jaKanjiReadingField(e.word, e.reading, table);
        let ex = e.ex;
        if (ex?.text) {
          const furi = jaExampleFurigana(ex.text, ex.reading);
          const split = jaExampleWords(ex.text, e.word, decodeJaPieces(pieceTable[jaExampleKey(ex.text)], ex.text), furi);
          ex = { ...ex, ...(furi ? { furi } : {}), ...(split || {}) };
        }
        // 짧은 뜻만 다듬고 원문은 fullMeaning에 남긴다(줄인 꼴 계약 — 다르면 싣는다).
        const meaning = jaPlainMeaning(e.meaning, e.word);
        const plain = meaning === e.meaning ? {} : { meaning, fullMeaning: e.fullMeaning ?? e.meaning };
        return { ...e, ...plain, ...(kr ? { kr } : {}), ...(ex ? { ex } : {}) };
      }) }));
    }).catch((error) => { jaExtrasMemo.delete(levelKey); throw error; }));
  }
  return jaExtrasMemo.get(levelKey);
}

/**
 * 찾기 색인(JLPT) — N5–N1 단어 전부를 [표제어, 읽기, 짧은 뜻, 급수(5–1), 글자별 읽기?] 한 줄씩. 같은 표제어는 낮은 레벨(N5 쪽) 하나만.
 * 레벨 목록과 같은 단어 · 같은 짧은 뜻이라 찾기 결과와 목록 칸이 갈리지 않는다.
 */
export async function japaneseLevelIndex() {
  const table = await loadJaReadingTable();
  const rows = [];
  const seen = new Set();
  for (const levelKey of LEVEL_LIST_LANGS.japanese.levels) {
    for (const g of japaneseVocabGroups(levelKey) || []) {
      for (const e of g.entries) {
        const word = e.word;
        if (seen.has(word) || (e.key && e.key !== word)) continue;
        seen.add(word);
        const kr = JA_HAN.test(word) ? jaKanjiReadingField(word, e.reading, table) : undefined;
        const meaning = jaPlainMeaning(e.meaning, word);
        rows.push(kr ? [word, e.reading, meaning, Number(levelKey.slice(1)), kr] : [word, e.reading, meaning, Number(levelKey.slice(1))]);
      }
    }
  }
  return rows;
}

/**
 * 찾기 색인(HSK 단어 페이지 개편) — 우리 사전 중 HSK 2026 급수가 있는 단어 전부를 [표제어, 병음, 짧은 뜻, 급수] 한 줄씩.
 * 레벨 목록과 같은 사전 · 같은 급수 표 · 같은 짧은 뜻이라 찾기 결과와 목록 칸이 갈리지 않는다. 급수 → 병음 순.
 * 대조 키가 표제어와 다른 줄(괄호 · 쌍반점 표기)은 키로 싣는다 — 화면은 표제어를 대조 키로 쓴다.
 */
export async function chineseLevelIndex() {
  const table = await loadZhHskLevels();
  const rows = [];
  for (const [key, w] of chineseDictionary()) {
    const level = zhHskLevelOf(key, table);
    if (!level) continue;
    rows.push([key, w.pinyin || '', shortMeaning(w.ko), level]);
  }
  return rows.sort((a, b) => a[3] - b[3] || pinyinOrder(a[1]).localeCompare(pinyinOrder(b[1])) || a[0].localeCompare(b[0], 'zh'));
}

function bunkeiGroups(lang, levelKey) {
  const bunkei = bunkeiOf[lang](levelKey);
  if (!bunkei) return null;
  const example = lang === 'japanese' ? jaExample : zhExample;
  let n = 0;
  return bunkei.themes.map((theme) => ({
    name: theme.name,
    entries: theme.items.map((item) => ({
      key: `p${n++}`, pattern: item.pattern, ko: shortMeaning(item.ko), conn: item.conn || '', note: item.note || '',
      exs: [example(item.ex), example(item.ex2)].filter(Boolean),
    })),
  })).filter((g) => g.entries.length);
}

/**
 * 「한자」 탭 묶음(HANZI-TAB-AL-001) — 글자만 넘긴다(병음 · 뜻은 화면이 답 카드를 열 때 표를 따로 받는다 — 목록 DOM에 0).
 * 문법 글자 묶음(set 0)이 있으면 맨 앞.
 */
async function hanziGroups(levelKey) {
  const table = await loadHanziTable(levelKey);
  if (!table) return null;
  const bySet = new Map();
  for (const [ch, c] of Object.entries(table.chars)) {
    if (!bySet.has(c.set)) bySet.set(c.set, []);
    bySet.get(c.set).push({ key: ch });
  }
  return [...bySet].sort((a, b) => a[0] - b[0])
    .map(([set, entries]) => ({ name: set === 0 ? '문법 글자' : `묶음 ${set}`, set, entries }));
}

/** 한 화면의 목록 — { lang, kind, levelKey, groups:[{name, entries}] }. 없는 레벨이면 null. 단어 항목은 줄인 꼴(compactLevelEntry). */
export async function levelListData(lang, kind, levelParam) {
  const conf = LEVEL_LIST_LANGS[lang];
  const levelKey = String(levelParam || '').toUpperCase();
  if (!conf || !conf.levels.includes(levelKey) || !levelKinds(lang, levelKey).includes(kind)) return null;
  const groups = kind === 'hanzi' ? await hanziGroups(levelKey)
    : kind === 'bunkei' ? bunkeiGroups(lang, levelKey)
    : lang === 'japanese' ? japaneseVocabGroups(levelKey) : await chineseVocabGroups(levelKey);
  if (!groups) return null;
  // 예문 단어 나눔은 단어 화면만 쓴다(문형 · 한자는 분석기를 부르지 않는다). 일본어는 글자별 읽기 · 예문 후리가나도 같이.
  if (lang === 'chinese' && kind === 'vocab') return { lang, kind, levelKey, groups: await withExampleSegments(groups) };
  if (lang === 'japanese' && kind === 'vocab') return { lang, kind, levelKey, groups: await withJapaneseWordExtras(levelKey, groups) };
  return { lang, kind, levelKey, groups };
}

/** 책장 타일 숫자 — 언어별 [{ levelKey, vocab, bunkei }]. 목록과 같은 조립을 세므로 타일 = 목록 개수. */
const tileMemo = new Map();
export function levelTileCounts(lang) {
  const conf = LEVEL_LIST_LANGS[lang];
  if (!conf) return Promise.resolve([]);
  if (!tileMemo.has(lang)) tileMemo.set(lang, countTiles(lang, conf).catch((error) => { tileMemo.delete(lang); throw error; }));
  return tileMemo.get(lang);
}
function countTiles(lang, conf) {
  return Promise.all(conf.levels.map(async (levelKey) => {
    const vocab = await levelListData(lang, 'vocab', levelKey);
    return {
      levelKey,
      vocab: vocab ? vocab.groups.reduce((n, g) => n + g.entries.length, 0) : 0,
      ...(levelKinds(lang, levelKey).includes('bunkei') ? { bunkei: bunkeiCountOf[lang](levelKey) } : {}),
      ...(levelKinds(lang, levelKey).includes('hanzi')
        ? { hanzi: (await levelListData(lang, 'hanzi', levelKey))?.groups.reduce((n, g) => n + g.entries.length, 0) || 0 } : {}),
    };
  }));
}
