// [문장] 탭의 칸 재료 — 뷰어 v2 AE-R2 PR ③(설계서 docs/manabi-viewer-v2-ae-r2.md §3, 정본 VIEWER-V2-ROUNDS-001 §4).
// 순서: 원문 줄(누른 단어 칠) → 번역 → [더 쉽게][자세히] → 문형 → 단어별 뜻. 이 파일은 순수 함수만 둔다(의존: 문장 줄·사전 키).
//
// 단어별 뜻은 드래그 재분석(/api/analyze → dragTokens)이 아니라 **자료 토큰**(processed_json)에서 만든다(설계서 §3.3):
// 재분석은 요청을 만들고(선처리 요청 수 계약), dragTokens가 생기면 만남이 기록된다(학습 이벤트 0 위반). 자료 토큰의
// 뜻은 이미 화면의 뜻(교정 반영)과 같다.
import { tokenDictKeyOf } from './tokenDictPrefetch.js';
import { composeRangeText } from './useTokenRangeSelect.js';
import { cleanLineText } from './sentenceNav.js';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from './viewerMessages.js';

// 드래그 단어 목록과 같은 기호 판정(ViewerPage runSelectedSentence) — 글자 없는 토큰은 뜻 목록에 넣지 않는다.
const PUNCT_ONLY = /^[\s。、！？!?,.:;""''（）()「」『』【】…·\-/]+$/u;

/**
 * 단어별 뜻 — 토큰 순서대로, 같은 어휘 키는 한 번만.
 * 키는 카드·사전·저장과 같은 규칙(sep_link ‖ base_form ‖ text, tokenDictKeyOf) — 이합사 O 조각(歉, sep_link 道歉)은
 * VO(道歉)에 합쳐진다. 중국어는 표제어(키)를 보이고(道 → 道歉), 다른 언어는 본문 표면을 보인다(활용형 그대로).
 * 읽기: 중국어 = 토큰 병음의 음절 공백을 뺀 표기(합친 이합사는 조각 병음이라 비운다), 일본어 = 표면과 다른 요미.
 * @param {Record<string, object>} dictionary processed_json.dictionary
 * @param {string[]} tokenIds 이 문장의 토큰 id(본문 순서)
 * tokenId = 그 어휘가 처음 나온 토큰(단어 ☆ 담기 · 문맥 출처가 이 자리를 쓴다).
 * @returns {Array<{key:string, text:string, reading:string, meaning:string, tokenId:string}>}
 */
export function sentenceWordGlosses(dictionary, tokenIds, { language } = {}) {
  const out = [];
  const seen = new Set();
  for (const id of tokenIds || []) {
    const token = dictionary?.[id];
    // 조사(的 · 了 · を)는 단어 줄에 두지 않는다 — 문장 속 쓰임은 패턴 카드가 말한다(목업 U 4판 「조사 · 문장부호 빼기」).
    if (!token || token.pos === '개행' || token.pos === '기호' || token.pos === '조사') continue;
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
    out.push({ key, text, reading, meaning, tokenId: id });
  }
  return out;
}

/**
 * [문장] 탭 문장의 토큰 — 단어별 뜻·문형의 범위.
 * ① 드래그 범위가 있고 그 합성 텍스트가 탭 문장과 같으면 그 범위 ② 아니면 탭 문장의 각 줄과 (막대·카드와 같은 정리로)
 * 같은 원문 줄의 토큰. 못 찾은 줄(부분 문자열 등)은 건너뛴다 — 칸이 비면 그리지 않는다.
 * @param {{text:string, rawLines?:string[], lineTokens?:Map<number, Array<{id:string}>>, sequence?:string[],
 *   dictionary?:object, range?:{start:number,end:number}|null, sentences?:Array<{key:string,text:string,tokenIds:string[]}>|null}} input
 * @returns {string[]}
 */
export function sentencePanelTokenIds({ text, rawLines = [], lineTokens, sequence, dictionary, range = null, sentences = null } = {}) {
  if (!text) return [];
  if (range && Array.isArray(sequence) && composeRangeText(sequence, dictionary, range.start, range.end).trim() === text) {
    return sequence.slice(range.start, range.end + 1);
  }
  const ids = [];
  const used = new Set();
  const usedSentences = new Set();
  for (const segment of String(text).split('\n').map((s) => s.trim()).filter(Boolean)) {
    // 마침표까지 한 문장(지정 · 카드 [문장] 탭)은 그 문장 토큰만 — 줄 전체가 아니다.
    const sentence = (sentences || []).find((s) => !usedSentences.has(s.key) && s.text === segment);
    if (sentence) { usedSentences.add(sentence.key); ids.push(...sentence.tokenIds); continue; }
    const line = rawLines.findIndex((raw, i) => !used.has(i) && cleanLineText(raw) === segment);
    if (line < 0) continue;
    used.add(line);
    for (const token of lineTokens?.get(line) || []) ids.push(token.id);
  }
  return ids;
}

/**
 * 번역 결과 → 번역 줄과 회색 줄(목업 U 4판: 번역 16px, 말투 · 교재 표시는 그 아래 13px 회색 한 덩이. 맥락은 그리지 않는다).
 * 제목 줄(**번역** · **맥락** …)은 그리지 않는다 — 위치와 크기가 이미 구분한다. 굵게 표시는 걷어 낸다.
 * @returns {{translation:string[], notes:string[]}}
 */
// 설명 언어별 「맥락」 제목(중국어 설명은 formatViewerExplanation이 语境 · 語境으로 단다).
const CONTEXT_HEADINGS = new Set(VIEWER_MESSAGE_LOCALES.map((locale) => VIEWER_MESSAGES[locale]['맥락']));

export function sentenceTranslationParts(text) {
  const sections = [];
  let current = null;
  for (const raw of String(text || '').split('\n')) {
    const heading = /^\s*\*\*(.+?)\*\*\s*$/u.exec(raw);
    if (heading) { current = { name: heading[1].trim(), lines: [] }; sections.push(current); continue; }
    if (!current) { current = { lines: [] }; sections.push(current); }
    const line = raw.replace(/\*\*/gu, '').trim();
    if (line && line !== '-') current.lines.push(line);
  }
  // 맥락(배경 설명) 줄은 그리지 않는다(오너 10-24 「… 장면이에요 문구 제거」) — 캐시에 남은 옛 결과도 같다.
  const filled = sections.filter((section) => section.lines.length && !CONTEXT_HEADINGS.has(section.name));
  const first = filled[0]?.lines || [];
  const book = first.filter((line) => line.startsWith('📘'));
  return {
    translation: first.filter((line) => !line.startsWith('📘')),
    notes: [...filled.slice(1).flatMap((section) => section.lines), ...book],
  };
}
