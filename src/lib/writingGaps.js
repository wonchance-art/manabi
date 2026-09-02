// U R2 — 첨삭에서 「내가 못 쓴 말」을 수확한다 (#1077 5503520174, 오너 「일단 다 발주 ㄱㄱ」 2026-09-02).
// 단어장은 「읽다 만난 말」만 담는다. 쓰려다 안 나온 말(능동 어휘 결손)은 어디에도 안 쌓였는데,
// 재료는 이미 DB에 있다 — writing_practice.errors[].fix(「이렇게 써야 했다」)와 sentence↔corrected.
// 이 모듈은 저작이 아니라 파생이다(drillSrs.recordDrillEncounters 선례): 표제어를 새로 만들지 않고
// 첨삭 결과에서 표현을 뽑아 개수와 함께 돌려준다. 담기는 사용자가 명시적으로 할 때만(v2 헌법 M7 —
// 산출이 FSRS로 새는 게 아니라 사용자가 평소 경로로 담는다). 순수 모듈 — 조회 없음.

import { diffChars } from './diffChars';

/** 수확 표현 길이 상한 — 문장 통째가 「표현」으로 들어오는 것을 막는다 */
export const GAP_MAX_LEN = 24;
/** 한 행에서 뽑는 diff 조각 상한 — 한 문장의 재작문이 목록을 덮지 않게 */
export const GAP_MAX_PER_ROW = 6;

const PUNCT_ONLY = /^[\s\p{P}\p{S}]*$/u;
const HAS_LETTER = /[\p{L}\p{N}]/u;

function clean(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function acceptable(text) {
  if (!text || text.length > GAP_MAX_LEN) return false;
  if (PUNCT_ONLY.test(text) || !HAS_LETTER.test(text)) return false;
  return true;
}

/** (언어, 표현) 키 — 언어가 다른 행은 섞이지 않는다 */
export function gapKey(lang, text) {
  return `${lang}|${text}`;
}

/** ⑴ errors[].fix — 첨삭기가 준 「이렇게 써야 했다」 */
export function fixesOf(row) {
  const errors = Array.isArray(row?.errors) ? row.errors : [];
  return errors.map((e) => clean(e?.fix)).filter(acceptable);
}

/** ⑵ sentence↔corrected 대조 — 교정문에만 있는 조각(ins) = 내가 못 쓴 말. diffChars 그대로 재사용. */
export function diffGapsOf(row) {
  const sentence = clean(row?.sentence);
  const corrected = clean(row?.corrected);
  if (!sentence || !corrected || sentence === corrected) return [];
  return diffChars(sentence, corrected)
    .filter((s) => s.type === 'ins')
    .map((s) => clean(s.text))
    .filter(acceptable)
    .slice(0, GAP_MAX_PER_ROW);
}

/**
 * @param {Array<{id, created_at, language, sentence, corrected, errors}>} rows - writing_practice 행
 * @returns {Array<{text, lang, count, lastAt, sources: string[], samples: Array<{id, sentence}>}>}
 *   같은 (언어, 표현)은 count로 합산(약점 강도). 언어가 다른 행은 섞이지 않는다.
 *   정렬: count 내림차순 → lastAt 내림차순 → text.
 */
export function harvestWritingGaps(rows) {
  const byKey = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const lang = row?.language || null;
    if (!lang) continue;
    // 오류 없는 문장(corrected === sentence)에서는 아무것도 수확하지 않는다 — 두 재료 모두
    if (clean(row?.corrected) && clean(row.corrected) === clean(row?.sentence)) continue;
    const found = new Map(); // 한 행 안 중복은 한 번만
    for (const t of fixesOf(row)) found.set(t, (found.get(t) || new Set()).add('fix'));
    for (const t of diffGapsOf(row)) found.set(t, (found.get(t) || new Set()).add('diff'));
    for (const [text, srcs] of found) {
      const key = gapKey(lang, text);
      const cur = byKey.get(key) || { text, lang, count: 0, lastAt: '', sources: new Set(), samples: [] };
      cur.count += 1;
      const at = String(row?.created_at || '');
      if (at > cur.lastAt) cur.lastAt = at;
      for (const s of srcs) cur.sources.add(s);
      if (cur.samples.length < 3) cur.samples.push({ id: row?.id ?? null, sentence: clean(row?.sentence) });
      byKey.set(key, cur);
    }
  }
  return [...byKey.values()]
    .map((g) => ({ ...g, sources: [...g.sources].sort() }))
    .sort((a, b) => (b.count - a.count) || (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0) || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
}
