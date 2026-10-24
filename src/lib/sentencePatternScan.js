// [문장] 탭 패턴 후보 — 문형 사전 전체 커널 스캔(클라이언트). 순수 칸 · 고르기 규칙은 sentencePattern.js.
import { loadPatternIndex, scanTokens, supportsPatterns } from './patternIndex.js';
import { PATTERN_CANDIDATE_LIMIT, locateFixedCells, patternCells, tokenBounds } from './sentencePattern.js';

const seqOf = (entry) => Number(String(entry?.id || '').split('-').pop()) || 0;

/**
 * 사전 후보 — 이 문장 토큰에 걸린 문형 중 고정 글자가 문장에 모두 있는 것. 자리 없는 표기(今天・明天・昨天 같은 어휘 항목)는 뺀다.
 * @param {Map<string, Array<object>>} index 전체 커널 인덱스(buildKernelIndex allKernels)
 * @param {Array<{id:string, text:string}>} tokens 이 문장 토큰(본문 순서)
 * @returns {Array<object>} 사전 항목(entry) — 점수 높은 순, 같으면 사전 순서
 */
export function sentencePatternCandidates(index, tokens, { limit = PATTERN_CANDIDATE_LIMIT } = {}) {
  if (!index || !tokens?.length) return [];
  const text = tokens.map((t) => t?.text || '').join('');
  const bounds = tokenBounds(tokens);
  const seen = new Set();
  const scored = [];
  for (const hit of scanTokens(tokens, index).hits) {
    for (const entry of hit.patterns || []) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      const cells = patternCells(entry.pattern);
      if (!cells.some((c) => c.kind === 'slot')) continue;
      const fixed = locateFixedCells(cells, text, /^H/u.test(entry.level) ? bounds : null);
      if (!fixed?.length) continue;
      scored.push({ entry, score: fixed.reduce((n, f) => n + [...f.text].length, 0) });
    }
  }
  scored.sort((a, b) => b.score - a.score || seqOf(a.entry) - seqOf(b.entry));
  return scored.slice(0, limit).map((s) => s.entry);
}

// 전체 커널 인덱스는 언어마다 한 번 만든다(콘텐츠 import는 patternIndex가 이미 캐시한다).
const indexByLang = new Map();
export function loadSentencePatternIndex(language) {
  if (!supportsPatterns(language)) return Promise.resolve(null);
  if (!indexByLang.has(language)) {
    indexByLang.set(language, loadPatternIndex(language, { allKernels: true }).catch((error) => {
      indexByLang.delete(language);
      throw error;
    }));
  }
  return indexByLang.get(language);
}
