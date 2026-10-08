// 서버 전용 — 중국어 단어 경계 검수(AD-R4 PR④, 설계서 docs/manabi-viewer-v2-ad-r4.md §5 · §4.2 · §7).
// 이웃한 두 한자 토큰을 이은 꼴이 「등재」(zhRegistered.js §5.1)이거나 사전 행이 있으면, 품사 판별 호출(disambiguateZhPos —
// 요청당 light 1회)의 앞 토큰 줄에 `[묶음 판정: A+B]`를 실어 같은 호출로 「이 문장에서 한 단어인가」를 받는다(판별 호출 수 0 증가).
//
//   등재 + join:true   → 자동으로 묶는다. AD-R3 applyBoundaryEdits를 같은 요청 안에서 적용하고 표식 boundary:'ai_registered'
//                        (OOV 분리에서 빠진다 — 재분석 때 뒤집히지 않는다). 묶은 꼴의 사전 행·뜻은 같은 조립 단계에서 붙는다.
//   등재 + join:false  → 아무것도 하지 않는다(오병합 꼴 个人·得了·完了·多方面도 HSK 표에 있다 — §0.5 실측).
//   미등재 + join:true → 후보만. 앞 토큰에 boundarySuggest:'<이은 꼴>'을 단다 — 뷰어 「뜻 확인 필요」 목록의 「한 단어로 묶을까요?」
//                        행이 되고, 확정은 AD-R3 묶기 흐름(boundaryEditFlow)이 한다. 서버는 경계를 바꾸지 않는다.
//   AD-R3 기록 구간     → 쌍을 만들지 않는다. 표식(boundary)이 붙은 토큰 · 요청 기록 구간(적용 못 한 pending 포함)과 겹치는 쌍은 0.
//                        사용자/이 자료가 정한 경계가 항상 이긴다(AD-R3 설계서 기록 우선 규칙).
//
// 켜고 끄는 것은 이 파일의 ZH_BOUNDARY_REVIEW 상수(기본 false)다. 새 환경 변수는 쓰지 않는다. 꺼져 있으면 라우트가 이 모듈의
// 어떤 함수도 부르지 않아 사전 조회 목록·프롬프트·응답 처리·DB 쓰기·응답 JSON이 현행과 바이트 단위로 같다
// (zhBoundaryReviewRoute.test.js 스냅숏). 측정 세트 D 범주에서 「자동 오병합 0」을 확인한 별도 PR로만 켠다(§3.5).
// OOV 「단어성 판정」 분리 조건(설계서 Q2)은 오너 미결이라 건드리지 않는다(현행 자동 분리 그대로).
//
// 측정 실행기(scripts/eval/run-zh-sense-holdout.mjs)가 번들러 없이 import한다 — 상대 import만 쓴다.

import { applyBoundaryEdits, boundarySpans, BOUNDARY_LIMITS } from '../boundaryEdits';
import { isZhRegisteredWord } from './zhRegistered';

export const ZH_BOUNDARY_REVIEW = false;
export const ZH_BOUNDARY_MAX_PAIRS = 20;       // 설계서 §4.2 · §12.2 — 요청당 묶음 판정 상한
export const ZH_BOUNDARY_MAX_LOOKUP = 120;     // 사전 조회 .in() 목록에 더하는 이은 꼴 상한(DB 쿼리는 1회 그대로)
export const ZH_AUTO_BOUNDARY_MARKER = 'ai_registered';

const ALL_HANZI = /^[一-鿿]+$/u;
const markKey = (lineIdx, word) => `${lineIdx}:${word}`; // disambiguateZhPos.js zhPosMarkKey와 같은 키

// 쌍이 될 수 있는 토큰: 온전한 한자 토큰 · 경계 표식 없음 · 이합사 조각 아님 · 기본형 = 표면형(중국어 사전 키).
const pairable = (t) => !!t && typeof t.text === 'string' && ALL_HANZI.test(t.text)
  && !t.boundary && !t.sep_link && (t.base_form ?? t.text) === t.text;

/** 요청 경계 기록이 덮는 줄 좌표 구간(요청 좌표 + 서버가 옮겨 적용한 좌표). 적용 못 한(pending) 기록의 자리도 막는다. */
export function zhBoundaryBlockedRegions(byLine, boundaryState) {
  const blocked = new Map();
  const add = (line, start, end) => {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) return;
    if (!blocked.has(line)) blocked.set(line, []);
    blocked.get(line).push([start, end]);
  };
  for (const [line, edits] of byLine || []) for (const e of edits) add(line, e.start, e.end);
  for (const [line, info] of boundaryState?.lines || []) for (const r of info.results || []) add(line, r.start, r.end);
  return blocked;
}

/** 한 줄의 이웃 한자 쌍(사전·등재 판정 전) — {index, a, b, start, end, form, reading}. 좌표는 AD-R3과 같은 공백 뺀 줄 좌표. */
function linePairs(tokens, blockedRanges = []) {
  const spans = boundarySpans((tokens || []).map((token, k) => ({ id: k, token })));
  const out = [];
  for (let i = 0; i + 1 < spans.length; i++) {
    const a = spans[i].entry.token, b = spans[i + 1].entry.token;
    if (!pairable(a) || !pairable(b)) continue;
    const start = spans[i].start, end = spans[i + 1].end;
    if (blockedRanges.some(([s, e]) => s < end && e > start)) continue;
    const form = a.text + b.text;
    if ([...form].length > BOUNDARY_LIMITS.maxChars.Chinese) continue;
    out.push({ index: i, a: a.text, b: b.text, start, end, form, reading: [a.furigana, b.furigana].filter(Boolean).join(' ') });
  }
  return out;
}

/** 사전 조회(.in())에 함께 넣을 이은 꼴 — gemini 행(미등재 후보)과 등재 꼴의 행(뜻)을 같은 쿼리로 받는다(§5.2). */
export function collectZhPairLookupForms(tokenizedLines, blocked = new Map(), limit = ZH_BOUNDARY_MAX_LOOKUP) {
  const forms = new Set();
  tokenizedLines.forEach(({ tokens }, lineIdx) => {
    for (const p of linePairs(tokens, blocked.get(lineIdx))) if (forms.size < limit) forms.add(p.form);
  });
  return [...forms];
}

/**
 * [묶음 판정] 쌍 — 이은 꼴이 등재(isZhRegisteredWord)이거나 사전 행이 있는 이웃 한자 쌍, 줄 순서로 최대 limit개.
 * 단어성 판정(oov) 마크가 걸린 토큰은 빼고(분리 판정과 겹치지 않게), 같은 마크 키(줄:앞 토큰)에는 쌍 하나만 싣는다.
 * @returns {Array<{lineIdx, index, a, b, start, end, form, key, registered}>}
 */
export function collectZhBoundaryPairs(tokenizedLines, { cache, marks = [], blocked = new Map(), limit = ZH_BOUNDARY_MAX_PAIRS }) {
  const oovKeys = new Set(marks.filter((m) => m.oov).map((m) => m.key));
  const used = new Set();
  const pairs = [];
  tokenizedLines.forEach(({ tokens }, lineIdx) => {
    for (const p of linePairs(tokens, blocked.get(lineIdx))) {
      if (oovKeys.has(markKey(lineIdx, p.a)) || oovKeys.has(markKey(lineIdx, p.b))) continue;
      const row = cache.get(p.form) || null;
      const registered = isZhRegisteredWord(p.form, row);
      if (!registered && !row) continue;
      const key = markKey(lineIdx, p.a);
      if (used.has(key)) continue;
      used.add(key);
      pairs.push({ lineIdx, ...p, key, registered });
    }
  });
  return pairs.slice(0, limit);
}

/**
 * 판별 마크에 쌍을 싣는다(새 배열 — 입력은 바꾸지 않는다). 앞 토큰이 마크가 아니면(个는 양사라 마크 밖) 그 쌍만을 위한
 * pairOnly 마크를 뒤에 더한다 — 품사 결과는 쓰지 않는다(zhSensePickFrom). 마크가 하나도 없으면 쌍을 싣지 않는다
 * (호출이 새로 생기지 않게 — 호출하는 쪽이 pairs를 비워 보낸다).
 */
export function attachZhBoundaryPairs(marks, pairs) {
  const out = marks.map((m) => ({ ...m }));
  for (const p of pairs) {
    let mark = out.find((m) => m.key === p.key);
    if (!mark) { mark = { lineIdx: p.lineIdx, word: p.a, key: p.key, pairOnly: true }; out.push(mark); }
    if (!mark.pair) mark.pair = [p.a, p.b];
  }
  return out;
}

/**
 * 판별 결과(picks.get(key).join)로 경계를 정한다. join:true만 본다 — 등재면 자동 묶기, 미등재면 앞 토큰에 후보 표식.
 * 같은 줄에서 겹치는 쌍은 앞의 것만. canJoin(form) = 묶은 꼴의 뜻을 붙일 수 있나(라우트: 사전 행이 있음 — 없으면 묶지 않고 현행).
 * 결과 {tokenizedLines(바뀐 줄만 새 객체), applied, suggested}. 바뀐 것이 없으면 입력 배열을 그대로 돌려준다.
 */
export function applyZhBoundaryJoins(tokenizedLines, pairs, picks, { canJoin = () => true } = {}) {
  const byLine = new Map();
  for (const p of pairs) {
    if (picks.get(p.key)?.join !== true) continue;
    if (!byLine.has(p.lineIdx)) byLine.set(p.lineIdx, []);
    byLine.get(p.lineIdx).push(p);
  }
  if (!byLine.size) return { tokenizedLines, applied: 0, suggested: 0 };
  let applied = 0, suggested = 0;
  const next = tokenizedLines.map((entry, lineIdx) => {
    const list = byLine.get(lineIdx);
    if (!list) return entry;
    const taken = [], joins = [], suggest = new Map();
    for (const p of list) {
      if (taken.some(([s, e]) => s < p.end && e > p.start)) continue;
      if (p.registered) {
        if (!canJoin(p.form)) continue;
        joins.push(p);
      } else suggest.set(p.index, p.form);
      taken.push([p.start, p.end]);
    }
    if (!joins.length && !suggest.size) return entry;
    let tokens = entry.tokens.map((t, k) => (suggest.has(k) ? { ...t, boundarySuggest: suggest.get(k) } : t));
    suggested += suggest.size;
    if (joins.length) {
      const result = applyBoundaryEdits(tokens.map((token, k) => ({ id: k, token })),
        joins.map((p) => ({ id: null, start: p.start, end: p.end, text: p.form, cuts: [] })),
        { language: 'Chinese', lineText: entry.original, marker: ZH_AUTO_BOUNDARY_MARKER });
      applied += result.results.filter((r) => r.status === 'applied' && !r.redundant).length;
      tokens = result.tokens.map((e) => e.token);
    }
    return { ...entry, tokens };
  });
  return { tokenizedLines: next, applied, suggested };
}
