// 영어 · 프랑스어 단어 → CEFR 단계 색인(PRINT-GLOSS-002, 2026-11-18 KST) — 인쇄 해석용 뜻풀이가 「자료보다 쉬운 말」을 거르는 데 쓴다.
// 원천은 레퍼런스 어휘 정본 레지스트리(content/{english,french} getVocab — 단어 페이지와 같은 원천). 표제어 키는 정본 normalizeRefWordKey.
// 같은 단어가 여러 단계에 있으면 가장 쉬운 단계(먼저 배우는 곳)를 쓴다. 서버 정적 경로(/api/level-index/latin)만 이 모듈을 들인다.
import { normalizeRefWordKey } from './refWordNormalize';

export const CEFR_LEVELS = Object.freeze(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
/** CEFR → 순위(A0·A1 = 1 … C2 = 6). 모르면 null. */
export function cefrRank(level) {
  const i = { A0: 1, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }[String(level || '').toUpperCase()];
  return i ?? null;
}

/** getVocab(level) → [[키, 순위], …] — lang = 'en' | 'fr'. */
export function latinLevelRows(getVocab, lang) {
  const best = new Map();
  for (const level of CEFR_LEVELS) {
    const vocab = getVocab(level);
    const rank = cefrRank(level);
    for (const theme of vocab?.themes || []) {
      for (const w of theme?.words || []) {
        const key = normalizeRefWordKey(lang, String(w?.[lang] || '').replace(/\s*\([^)]*\)\s*/gu, ' '));
        if (!key) continue;
        if (!best.has(key) || best.get(key) > rank) best.set(key, rank);
      }
    }
  }
  return [...best.entries()];
}
