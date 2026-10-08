// 서버 전용 — /api/analyze의 `boundaries`(이 자료의 단어 경계 기록) 적용. 뷰어 v2 AD-R3 PR②.
// 정본: docs/manabi-viewer-v2-ad-r3.md §3.4 · §3.5 · §0.4.
//
// · 적용 위치: 토큰화 **직후**, 기본형 수집 **전** — 새 조각이 사전 조회·뜻 조회·품사 판별·병음의 입력이 된다.
// · 적용 함수는 브라우저와 같이 쓰는 순수 함수(boundaryEdits.applyBoundaryLayers)다. 범위 간 순서는 공유 규칙 → 사용자 규칙
//   → 이 자료 기록(뒤가 이긴다)이고, 지금은 이 자료 기록('user')만 있다. 규칙 표(②③)는 PR④.
// · 표식: 기록 구간의 토큰(새 조각·그대로 쓴 분석기 토큰·redundant 기록의 토큰)에 boundary를 단다. 라우트는 표식이 있는
//   토큰에 OOV 분리(splitZhToken)를 적용하지 않고, collectZhPosMarks는 단어성 판정을 붙이지 않는다(§0.4).
// · 기록이 없으면 null을 돌려주고 라우트는 기존 경로를 그대로 탄다(기록 0 = 바이트 단위 동일, analyzeRouteNoBoundary.test.js).
import { applyBoundaryLayers, BOUNDARY_LIMITS } from '../boundaryEdits';

/**
 * 요청 본문의 boundaries 검증. 없으면 {ok:true, byLine:null}. 배열이 아니거나, 항목이 객체가 아니거나, 줄 번호가 요청 줄 밖이거나,
 * 개수가 상한(자료당 기록 200개)을 넘으면 {ok:false}(400). 좌표·칼선 모양은 적용 함수가 기록별 pending(invalid_edit)으로 알린다.
 */
export function readRequestBoundaries(boundaries, lineCount) {
  if (boundaries === undefined || boundaries === null) return { ok: true, byLine: null };
  if (!Array.isArray(boundaries) || boundaries.length > BOUNDARY_LIMITS.maxEdits) return { ok: false };
  const byLine = new Map();
  for (const item of boundaries) {
    if (!item || typeof item !== 'object' || !Number.isInteger(item.line) || item.line < 0 || item.line >= lineCount) return { ok: false };
    // 요청에서 받는 필드만 옮긴다(base·status·표식은 서버가 정한다).
    const { id = null, line, start, end, text, cuts } = item;
    if (!byLine.has(line)) byLine.set(line, []);
    byLine.get(line).push({ id: typeof id === 'string' ? id.slice(0, 80) : null, line, start, end, text, cuts });
  }
  return { ok: true, byLine: byLine.size ? byLine : null };
}

/**
 * 토큰화 결과에 기록을 적용한다. 반환 null = 기록 없음(라우트 무변경).
 * 아니면 {tokenizedLines(기록 적용), lookupLines(+ base 토큰 — 사전 조회·뜻 조회 대상), lines: Map<줄, {results, base}>}.
 * base = 적용된 기록들의 분석기 원래 토큰을 기록 순서대로 이은 것(응답 조립에서 함께 뜻·품사를 받는다).
 */
export function applyRequestBoundaries(tokenizedLines, byLine, language) {
  if (!byLine) return null;
  const lines = new Map();
  const baseLines = [];
  const next = tokenizedLines.map((entry, lineIdx) => {
    const edits = byLine.get(lineIdx);
    if (!edits) return entry;
    const { tokens, layers } = applyBoundaryLayers(
      entry.tokens.map((token, k) => ({ id: k, token })),
      [{ marker: 'user', edits }],
      { language, lineText: entry.original, markRedundant: true },
    );
    const results = layers[0];
    const base = results.flatMap((result) => (result.status === 'applied' ? result.base.map((e) => e.token) : []));
    lines.set(lineIdx, { results, base });
    if (base.length) baseLines.push({ tokens: base });
    return { ...entry, tokens: tokens.map((e) => e.token) };
  });
  return { tokenizedLines: next, lookupLines: [...next, ...baseLines], lines };
}

/** 응답 조립에 넣을 그 줄의 base 토큰(조립 뒤 boundaryLineResult가 떼어 낸다). */
export const boundaryBaseTokens = (state, lineIdx) => state?.lines.get(lineIdx)?.base ?? [];

/**
 * 조립된 줄(편집 토큰 + 뒤에 붙인 base 토큰)에서 base를 떼어 boundaryApplied로 돌려준다.
 * 응답: {sequence, dictionary, boundaryApplied?: [{id, status, start?, end?, cuts?, reason?, moved?, redundant?, base: [토큰…]}]}.
 * pending 기록의 base는 [] — 클라이언트는 옛 base를 그대로 둔다.
 */
export function boundaryLineResult(state, lineIdx, sequence, dictionary) {
  const line = state?.lines.get(lineIdx);
  if (!line) return { sequence, dictionary };
  const baseIds = sequence.splice(sequence.length - line.base.length, line.base.length);
  const assembled = baseIds.map((id) => {
    const token = dictionary[id];
    delete dictionary[id];
    return token;
  });
  let at = 0;
  const boundaryApplied = line.results.map((result) => {
    const count = result.status === 'applied' ? result.base.length : 0;
    const base = assembled.slice(at, at + count);
    at += count;
    return { ...result, base };
  });
  return { sequence, dictionary, boundaryApplied };
}
