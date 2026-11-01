// 복습실 듣기 카드의 레벨 예문 찾기(CARD-TYPES-001 — 오너 승인 2026-11-01 KST 「듣기 = 예문」). 단어 페이지에서 붙인 듣기 카드는
// 저장한 원문 문장(source_sentence)이 없어 복습실이 단어만 읽었다. 그 단어의 레벨 예문(e.ex)은 정적 묶음에만 있다 — 새 묶음 · 새 주소를
// 만들지 않고 단어 페이지가 받는 것을 그대로 받는다:
//   ① 단어 → 레벨: 일본어 = 찾기 색인(/api/level-index/japanese — JLPT 판 indexUrl), 중국어 = 급수 표 정본(zhHskLevel — 복습실이 이미 받는 표),
//      영어 · 프랑스어 = 레벨이 하나(A1)라 그 레벨.
//   ② 레벨 → 예문: 단어 페이지 묶음(levelWordsUrl — 같은 주소라 그 레벨 페이지에서 받은 브라우저 사본이 그대로 쓰인다)에서 열쇠가 같은 항목의 ex.
// 이 모듈은 복습실이 듣기 카드(원문 문장 없음)를 만났을 때만 동적 import로 받는다(첫 화면 JS 밖 — listenExample.js).
import { levelWordsUrl, requestLevelWords } from './levelWordsPayload';
import { loadZhHskLevels, zhHskLevelOf } from './zhHskLevel';
import { LATIN_WORD_LEVELS } from './latinLevelWords';

/** JLPT 찾기 색인 주소 — 단어 페이지 JLPT 판(jlptWordLang().indexUrl)과 같다(계약). */
export const JA_LEVEL_INDEX_URL = '/api/level-index/japanese';

let jaIndex = null; // Promise<Map<표제어, 레벨 숫자>>
function japaneseLevels(fetchImpl) {
  jaIndex ||= fetchImpl(JA_LEVEL_INDEX_URL)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`level-index ${res.status}`))))
    .then((body) => new Map((body?.rows || []).map((row) => [row[0], row[3]])))
    .catch((error) => { jaIndex = null; throw error; });
  return jaIndex;
}

/** 언어(단어장 language) → 묶음 언어 · 그 단어가 있을 레벨 열쇠들. 모르는 언어 · 레벨 없는 단어는 []. */
const LEVELS_OF = {
  Japanese: { lang: 'japanese', levels: async (word, fetchImpl) => {
    const level = (await japaneseLevels(fetchImpl)).get(word);
    return Number.isInteger(level) ? [`N${level}`] : [];
  } },
  Chinese: { lang: 'chinese', levels: async (word) => {
    const level = zhHskLevelOf(word, await loadZhHskLevels());
    return level ? [`H${level}`] : [];
  } },
  English: { lang: 'english', levels: async () => [...LATIN_WORD_LEVELS.english] },
  French: { lang: 'french', levels: async () => [...LATIN_WORD_LEVELS.french] },
};

// 묶음마다 열쇠 → 예문 표 하나(항목 전체를 들고 있지 않는다). 최근 셋만 둔다 — 큰 레벨(H7 5,562개)이 쌓이지 않게.
const MAX_LEVELS = 3;
const examples = new Map(); // url → Promise<Map<열쇠, ex>>
function examplesOf(url, fetchImpl) {
  if (examples.has(url)) {
    const hit = examples.get(url);
    examples.delete(url);
    examples.set(url, hit);
    return hit;
  }
  const pending = requestLevelWords(url, { fetchImpl }).then((groups) => {
    const map = new Map();
    for (const g of groups) for (const e of g.entries || []) {
      const key = e.key ?? e.word; // compactLevelEntry가 표제어와 같은 열쇠를 뺀다(levelEntry와 같은 되살리기)
      if (e.ex?.text && !map.has(key)) map.set(key, e.ex);
    }
    return map;
  });
  pending.catch(() => { if (examples.get(url) === pending) examples.delete(url); });
  examples.set(url, pending);
  while (examples.size > MAX_LEVELS) examples.delete(examples.keys().next().value);
  return pending;
}

/**
 * 단어(단어장 행)의 레벨 예문 { text, ko, reading?, furi?, seg?, lem? } — 단어 페이지 Example이 그대로 그리는 모양. 없으면 null.
 * 찾는 열쇠 = 단어 페이지가 담을 때 쓴 표제어(word_text = 항목 key), 없으면 원형(base_form). 받기가 실패하면 던진다(부르는 쪽이 단어로 읽는다).
 */
export async function levelExampleOf(word, { fetchImpl = globalThis.fetch } = {}) {
  const conf = LEVELS_OF[word?.language];
  if (!conf) return null;
  const keys = [...new Set([word.word_text, word.base_form].filter(Boolean))];
  for (const key of keys) {
    for (const levelKey of await conf.levels(key, fetchImpl)) {
      const ex = (await examplesOf(levelWordsUrl(conf.lang, levelKey), fetchImpl)).get(key);
      if (ex) return ex;
    }
  }
  return null;
}

/** 시험용 — 모듈에 둔 색인 · 묶음 표를 비운다. */
export function resetLevelExampleLookup() {
  jaIndex = null;
  examples.clear();
}
