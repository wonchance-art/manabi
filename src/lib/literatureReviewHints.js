// 정본 문학책 검수 힌트(AOZORA-P0-4, 오너 확정 2026-10-14 KST 「분석 → 검수·편집 → 공개」) — 순수 함수.
//
// 작품 폴더의 review.json(선택)은 사전 검토자(Claude)가 「이 자리에서 사전 뜻으로는 부족한 낱말」을 골라 문맥 뜻 제안을 단 것이다.
//   { schemaVersion: 1, reviewedBy: 'claude', hints: [{ chapter, form, nth?, meaning, note? }] }
//   form = 그 장 rawText에 실제로 있는 글자(nth번째, 기본 1), meaning = 이 자리의 한국어 뜻 제안(문맥 뜻), note = 검수자용 짧은 근거.
// 빌드가 장 rawText 기준 문자 범위로 풀어 chapters.json의 metadata.literature.reviewHints에 싣고(원문이 바뀌면 빌드 실패),
// 분석 말미(analyzeHybrid — 저자 루비 잠금 바로 뒤)가 그 범위의 토큰에 「뜻 확인 필요」 표식(meaningCheck 'ctx')과 제안
// (meaningSuggest·meaningNote)을 붙인다. **뜻 자체는 바꾸지 않는다** — 관리자가 「뜻 확인 필요」 목록에서 제안을 고르거나,
// 사전 뜻을 고르거나, 그대로 두기로 확정해야 표식이 지워진다(applyTokenCorrections). 모든 장의 표식이 0이어야 「검수 완료」.
import { indexAozoraTokenSpans } from './aozoraRuby.js';

export const REVIEW_HINT_VERSION = 1;
export const REVIEW_HINT_MEANING_MAX = 80;
export const REVIEW_HINT_NOTE_MAX = 120;

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

/** 문자열에서 form의 nth(1부터) 번째 위치. 없으면 -1. */
function nthIndex(text, form, nth) {
  let at = -1;
  for (let k = 0; k < nth; k += 1) {
    at = text.indexOf(form, at + 1);
    if (at < 0) return -1;
  }
  return at;
}

/**
 * review.json 검증 + 장마다 문자 범위로 풀기(빌드). 실패하면 throw — 원문이 바뀌어 낡은 힌트는 공개 전에 막는다.
 * @param {object} review review.json
 * @param {string[]} chapterTexts 장 rawText(순서 = 장 order - 1)
 * @returns {Array<Array<{start:number,end:number,base:string,meaning:string,note?:string}>>} 장마다 힌트(시작 위치 순)
 */
export function resolveReviewHints(review, chapterTexts) {
  invariant(review && typeof review === 'object' && !Array.isArray(review), 'review.json must be an object');
  invariant(review.schemaVersion === REVIEW_HINT_VERSION, 'Unsupported review.json schemaVersion');
  invariant(typeof review.reviewedBy === 'string' && review.reviewedBy.trim(), 'review.json requires reviewedBy');
  invariant(Array.isArray(review.hints), 'review.json hints must be an array');
  const out = chapterTexts.map(() => []);
  review.hints.forEach((hint, index) => {
    const where = `hints[${index}]`;
    invariant(hint && typeof hint === 'object', `${where} must be an object`);
    invariant(Number.isInteger(hint.chapter) && hint.chapter >= 1 && hint.chapter <= chapterTexts.length, `${where}.chapter is out of range`);
    invariant(typeof hint.form === 'string' && hint.form.trim() && !/\s/u.test(hint.form), `${where}.form must be text without spaces`);
    const nth = hint.nth ?? 1;
    invariant(Number.isInteger(nth) && nth >= 1, `${where}.nth must be a positive integer`);
    invariant(typeof hint.meaning === 'string' && hint.meaning.trim() && hint.meaning.length <= REVIEW_HINT_MEANING_MAX,
      `${where}.meaning must be 1–${REVIEW_HINT_MEANING_MAX} chars`);
    invariant(hint.note == null || (typeof hint.note === 'string' && hint.note.length <= REVIEW_HINT_NOTE_MAX),
      `${where}.note must be ≤${REVIEW_HINT_NOTE_MAX} chars`);
    const text = chapterTexts[hint.chapter - 1];
    const start = nthIndex(text, hint.form, nth);
    invariant(start >= 0, `${where}: 「${hint.form}」 (${nth}번째) is not in chapter ${hint.chapter}`);
    out[hint.chapter - 1].push({ start, end: start + hint.form.length, base: hint.form, meaning: hint.meaning.trim(),
      ...(hint.note ? { note: hint.note.trim() } : {}) });
  });
  for (const hints of out) {
    hints.sort((a, b) => a.start - b.start);
    for (let k = 1; k < hints.length; k += 1) {
      invariant(hints[k - 1].end <= hints[k].start, `review hints overlap at 「${hints[k].base}」`);
    }
  }
  return out;
}

/**
 * 분석 말미 훅 — metadata.literature.reviewHints의 범위와 맞는 토큰에 표식·제안을 붙인다.
 * 범위와 정확히 같은 토큰 → 없으면 범위를 품은 토큰 하나. 사용자가 이미 뜻을 교정한 토큰은 건드리지 않는다(교정 > 힌트).
 * 원문과 어긋나는 힌트(base 불일치)는 그 힌트만 건너뛴다. 분석 결과의 뜻·독음은 바꾸지 않는다.
 * @returns {{json: object, diagnostics: null | {hintCount:number, attachedCount:number}}}
 */
export function applyMaterialReviewHints(rawText, json) {
  const hints = json?.metadata?.literature?.reviewHints;
  if (!Array.isArray(hints) || hints.length === 0) return { json, diagnostics: null };
  let spans;
  try {
    spans = indexAozoraTokenSpans(rawText, json.sequence, json.dictionary);
  } catch {
    return { json, diagnostics: { hintCount: hints.length, attachedCount: 0 } };
  }
  const corrected = json.metadata?.viewerCorrections || {};
  const dictionary = { ...json.dictionary };
  let attached = 0;
  for (const hint of hints) {
    if (!hint || typeof hint.base !== 'string' || rawText.slice(hint.start, hint.end) !== hint.base) continue;
    const span = spans.find((s) => s.start === hint.start && s.end === hint.end)
      || spans.find((s) => s.start <= hint.start && s.end >= hint.end && s.text !== '\n');
    if (!span) continue;
    const token = dictionary[span.tokenId];
    if (!token || token.failed || token.pos === '개행') continue;
    if (Array.isArray(corrected[span.tokenId]) && corrected[span.tokenId].includes('meaning')) continue;
    dictionary[span.tokenId] = { ...token, meaningCheck: 'ctx', meaningSuggest: hint.meaning, ...(hint.note ? { meaningNote: hint.note } : {}) };
    attached += 1;
  }
  return { json: { ...json, dictionary }, diagnostics: { hintCount: hints.length, attachedCount: attached } };
}

/** 이미 붙은 제안 수(관리자 화면 검수 보조 — 따로 저장하지 않고 다시 센다). */
export function countAttachedReviewHints(json) {
  return (json?.sequence || []).filter((id) => typeof json.dictionary?.[id]?.meaningSuggest === 'string').length;
}
