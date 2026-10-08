// [문장] 탭의 칸 재료 — 뷰어 v2 AE-R2 PR ③(설계서 docs/manabi-viewer-v2-ae-r2.md §3, 정본 VIEWER-V2-ROUNDS-001 §4).
// 순서: 원문 줄(누른 단어 칠) → 번역 → [더 쉽게][자세히] → 문형 → 단어별 뜻. 이 파일은 순수 함수만 둔다(의존: 문장 줄·사전 키).
//
// 단어별 뜻은 드래그 재분석(/api/analyze → dragTokens)이 아니라 **자료 토큰**(processed_json)에서 만든다(설계서 §3.3):
// 재분석은 요청을 만들고(선처리 요청 수 계약), dragTokens가 생기면 만남이 기록된다(학습 이벤트 0 위반). 자료 토큰의
// 뜻은 이미 화면의 뜻(교정 반영)과 같다.
import { tokenDictKeyOf } from './tokenDictPrefetch.js';
import { composeRangeText } from './useTokenRangeSelect.js';
import { cleanLineText } from './sentenceNav.js';
import { locateLineTokens, clipSentenceToBudget } from './viewerSentenceLine.js';

// 드래그 단어 목록과 같은 기호 판정(ViewerPage runSelectedSentence) — 글자 없는 토큰은 뜻 목록에 넣지 않는다.
const PUNCT_ONLY = /^[\s。、！？!?,.:;""''（）()「」『』【】…·\-/]+$/u;

/**
 * 단어별 뜻 — 토큰 순서대로, 같은 어휘 키는 한 번만.
 * 키는 카드·사전·저장과 같은 규칙(sep_link ‖ base_form ‖ text, tokenDictKeyOf) — 이합사 O 조각(歉, sep_link 道歉)은
 * VO(道歉)에 합쳐진다. 중국어는 표제어(키)를 보이고(道 → 道歉), 다른 언어는 본문 표면을 보인다(활용형 그대로).
 * 읽기: 중국어 = 토큰 병음의 음절 공백을 뺀 표기(합친 이합사는 조각 병음이라 비운다), 일본어 = 표면과 다른 요미.
 * @param {Record<string, object>} dictionary processed_json.dictionary
 * @param {string[]} tokenIds 이 문장의 토큰 id(본문 순서)
 * @returns {Array<{key:string, text:string, reading:string, meaning:string}>}
 */
export function sentenceWordGlosses(dictionary, tokenIds, { language } = {}) {
  const out = [];
  const seen = new Set();
  for (const id of tokenIds || []) {
    const token = dictionary?.[id];
    if (!token || token.pos === '개행' || token.pos === '기호') continue;
    const surface = String(token.text || '').trim();
    if (!surface || PUNCT_ONLY.test(surface)) continue;
    const meaning = String(token.meaning || '').trim();
    if (!meaning) continue;
    const key = String(tokenDictKeyOf(token)).trim() || surface;
    if (seen.has(key)) continue;
    seen.add(key);
    const merged = key !== surface && (!!token.sep_link || language === 'Chinese');
    const text = language === 'Chinese' ? key : surface;
    let reading = '';
    if (language === 'Chinese' && !merged) reading = String(token.furigana || '').replace(/\s+/gu, '');
    else if (language === 'Japanese' && token.furigana && token.furigana !== surface) reading = String(token.furigana);
    out.push({ key, text, reading, meaning });
  }
  return out;
}

/**
 * [문장] 탭 문장의 토큰 — 단어별 뜻·문형의 범위.
 * ① 드래그 범위가 있고 그 합성 텍스트가 탭 문장과 같으면 그 범위 ② 아니면 탭 문장의 각 줄과 (막대·카드와 같은 정리로)
 * 같은 원문 줄의 토큰. 못 찾은 줄(부분 문자열 등)은 건너뛴다 — 칸이 비면 그리지 않는다.
 * @param {{text:string, rawLines?:string[], lineTokens?:Map<number, Array<{id:string}>>, sequence?:string[],
 *   dictionary?:object, range?:{start:number,end:number}|null}} input
 * @returns {string[]}
 */
export function sentencePanelTokenIds({ text, rawLines = [], lineTokens, sequence, dictionary, range = null } = {}) {
  if (!text) return [];
  if (range && Array.isArray(sequence) && composeRangeText(sequence, dictionary, range.start, range.end).trim() === text) {
    return sequence.slice(range.start, range.end + 1);
  }
  const ids = [];
  const used = new Set();
  for (const segment of String(text).split('\n').map((s) => s.trim()).filter(Boolean)) {
    const line = rawLines.findIndex((raw, i) => !used.has(i) && cleanLineText(raw) === segment);
    if (line < 0) continue;
    used.add(line);
    for (const token of lineTokens?.get(line) || []) ids.push(token.id);
  }
  return ids;
}

/**
 * 원문 줄 + 누른 자리 — 줄 전체(자르지 않음)에서 누른 토큰 위치를 토큰 순서로 찾아 칠한다(같은 단어가 여러 번 나와도
 * 누른 곳 하나). 3줄 예산을 넘으면 AE-R1 문장 줄과 같은 예산 함수로 단어 앞뒤만 남긴다(설계서 §3.1·§9.2).
 * 누른 토큰이 없거나 못 찾으면 줄 전체를 칠 없이 그대로(막대·드래그로 연 경우).
 * @returns {{before:string, term:string, after:string}}
 */
export function sentencePanelOriginal({ text, tokens = [], tokenId = null } = {}) {
  const s = String(text ?? '');
  const index = tokenId ? tokens.findIndex((t) => t.id === tokenId) : -1;
  const at = index >= 0 ? locateLineTokens(s, tokens)[index] : null;
  if (!at) return { before: s, term: '', after: '' };
  const { before, term, after } = clipSentenceToBudget({ before: s.slice(0, at.start), term: s.slice(at.start, at.end), after: s.slice(at.end) });
  return { before, term, after };
}

/**
 * 문형 칸 — 문형 스캔(visibleScan.hits) 중 이 문장 토큰에 걸린 것, 본문 순서. 문법 표시를 끄면 스캔이 없어 빈 목록.
 * @returns {Array<object>} hits 원소 그대로(PatternCard가 받는 모양)
 */
export function sentencePatternHits(scan, tokenIds) {
  if (!scan?.hits?.length || !tokenIds?.length) return [];
  const ids = new Set(tokenIds);
  return scan.hits.filter((hit) => (hit.tokenIds || []).some((id) => ids.has(id)));
}
