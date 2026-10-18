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
