// 뷰어 v2 AD-R3 — 단어 경계 편집(한 단어로 묶기 · 나누기) 순수 함수. 정본: docs/manabi-viewer-v2-ad-r3.md §3·§4.3·§6.1.
//
// ── 모델(§3.1·§3.2): 「구간별 칼선 + 원래 토큰 보관」
// processed_json.metadata.viewerBoundaries = {version: 1, edits: [{id, line, start, end, text, cuts, base, status, at?}]}.
// · start·end·cuts는 그 줄의 **공백을 뺀 글자 위치(UTF-16)**다. 중·일 분석 요청은 줄을 trim하고, 영어는 공백이 토큰이
//   아니며, 커버리지·출처 대조도 공백을 지운 좌표를 쓴다(analysisCoverage.js·learningSources.js).
// · base = 그 구간의 **분석기 원래 토큰**({id, token})이다. 새 칼선이 base 칼선과 같아지면 기록을 지우고 base를 그대로
//   되살린다 — 「묶기 → 나누기」 「나누기 → 묶기」 「재절단 → 되돌리기」가 id·뜻·병음까지 원상태가 되는 이유는 이것 하나다.
// · 불변식: ① 한 줄의 기록은 서로 겹치지 않는다 ② base는 분석기 토큰만 ③ 기록 구간 양 끝은 지금 토큰 경계.
//
// ── 범위(PR①): 계산만 한다. 저장(viewer_replace_analysis)·화면은 PR③.
// PR②: /api/analyze `boundaries` 서버 적용(server/analyzeBoundaries.js → applyBoundaryLayers)과 재분석 연결
// (analyzeHybrid → boundaryParagraphRequest·settleBoundaryRecord, runPreservedReanalysis → 줄 이동·base id 승계).
// 원문·판본·저장 단어·FSRS·출처에 닿는 쓰기는 없다. 한국어는 어절 칼선 오너 결정(안 A/B, §7.4) 전이라 모든 함수가
// 명시적으로 거부(무변경)한다. 승인 범위 언어는 중국어·일본어·영어뿐이다.
// 브라우저·서버 공용 — 서버 전용 모듈·Node 내장을 import하지 않는다(boundaryEdits.test.js 계약).
import {analysisTokenLine} from './analysisCoverage';

export const BOUNDARY_LANGUAGES = Object.freeze(['Chinese', 'Japanese', 'English']);
// §11.2 제안값: 묶기 토큰 8개 · 글자 12(중·일)/40(영) · 자료당 기록 200개.
export const BOUNDARY_LIMITS = Object.freeze({
  maxTokens: 8,
  maxChars: Object.freeze({Chinese: 12, Japanese: 12, English: 40}),
  maxEdits: 200,
});
// 'ai_registered' = AD-R4 PR④ 서버 자동 묶기(등재 + 이 문장에서 한 단어 판정, server/zhBoundaryReview.js). 기록(viewerBoundaries)을
// 남기지 않는 분석기 쪽 경계라 사용자가 나누면 AD-R3 기록('user')이 이긴다.
export const BOUNDARY_MARKERS = Object.freeze(['user', 'user_rule', 'shared_rule', 'ai_registered']);

const SPACE = /\s/u;
const HIRAGANA = /^[ぁ-ゟー]+$/u;
const WORDISH = /[\p{L}\p{N}]/u;

export const compactBoundaryText = value => String(value ?? '').replace(/\s+/gu, '');

function languageReason(language) {
  if (language === 'Korean') return 'korean';
  return BOUNDARY_LANGUAGES.includes(language) ? null : 'unsupported_language';
}
export const boundaryLanguageSupported = language => languageReason(language) === null;

const tokenText = entry => (typeof entry?.token?.text === 'string' ? entry.token.text : '');
const isNewline = (id, token) => token?.pos === '개행' || (typeof id === 'string' && id.startsWith('br_'));

/** 줄 토큰({id, token}) → 공백 뺀 줄 좌표 구간 [{entry, start, end}]. 공백 토큰은 길이 0이다. */
export function boundarySpans(entries) {
  const spans = [];
  let at = 0;
  for (const entry of entries || []) {
    const length = compactBoundaryText(tokenText(entry)).length;
    spans.push({entry, start: at, end: at + length});
    at += length;
  }
  return spans;
}

const lineCompact = spans => spans.map(span => compactBoundaryText(tokenText(span.entry))).join('');
const boundsOf = spans => new Set([0, ...spans.map(span => span.end)]);
const cutsWithin = (spans, start, end) => [...new Set(spans.map(span => span.end).filter(at => at > start && at < end))].sort((a, b) => a - b);
const sameCuts = (a, b) => a.length === b.length && a.every((value, k) => value === b[k]);
// 길이 0(공백) 토큰은 구간 **안쪽**에 있을 때만 구간 소속이다 — 끝에 붙은 공백은 구간 밖에 남는다.
const inRegion = (span, start, end) => (span.start === span.end
  ? span.start > start && span.start < end
  : span.start >= start && span.end <= end);
const isLowSurrogate = code => code >= 0xDC00 && code <= 0xDFFF;

function validCuts(cuts, start, end, compact) {
  if (!Array.isArray(cuts)) return false;
  let previous = start;
  for (const cut of cuts) {
    if (!Number.isInteger(cut) || cut <= previous || cut >= end) return false;
    if (isLowSurrogate(compact.charCodeAt(cut))) return false; // 서로게이트 쌍 안쪽 칼선 금지
    previous = cut;
  }
  return true;
}

/** 공백 뺀 위치 [from, to)를 원문 문자열에서 잘라낸다. 안쪽 공백은 살리고 양 끝 공백은 뺀다(영어 `pick up`). */
function sliceByCompact(value, from, to) {
  if (to <= from) return '';
  const raw = [];
  for (let i = 0; i < value.length && raw.length < to; i++) if (!SPACE.test(value[i])) raw.push(i);
  return value.slice(raw[from], raw[to - 1] + 1);
}

/** 구간 [start, end)를 덮는 분석기 토큰 조각들 — {token, from, to, whole}(from·to는 그 토큰 안 공백 뺀 위치). */
function partsOf(spans, start, end) {
  const parts = [];
  for (const span of spans) {
    const from = Math.max(start, span.start), to = Math.min(end, span.end);
    if (to <= from) continue;
    parts.push({token: span.entry.token, from: from - span.start, to: to - span.start,
      whole: from === span.start && to === span.end});
  }
  return parts;
}

function pieceText(spans, start, end, {language, lineText, compact}) {
  if (typeof lineText === 'string' && compactBoundaryText(lineText) === compact) return sliceByCompact(lineText, start, end);
  return partsOf(spans, start, end).map(part => sliceByCompact(part.token.text, part.from, part.to))
    .join(language === 'English' ? ' ' : '');
}

// 중국어 병음: 글자 수와 음절 수가 같은 토큰만 글자마다 나눠 쓴다(splitZhToken과 같은 규칙,
// server/disambiguateZhPos.js — 서버 전용이라 import하지 않는다). 어긋난 토큰의 일부는 추측하지 않고 비운다.
function zhPieceReading(parts) {
  const out = [];
  for (const {token, from, to, whole} of parts) {
    const syllables = String(token.furigana || '').split(' ').filter(Boolean);
    if (!syllables.length) continue;
    if (whole) { out.push(...syllables); continue; }
    const chars = [...compactBoundaryText(token.text)];
    if (chars.length !== syllables.length) return '';
    let at = 0;
    chars.forEach((ch, k) => { if (at >= from && at < to) out.push(syllables[k]); at += ch.length; });
  }
  return out.join(' ');
}

function jaPieceReading(parts, text) {
  let reading = '';
  for (const {token} of parts) {
    if (typeof token.furigana === 'string' && token.furigana) reading += token.furigana;
    else if (HIRAGANA.test(token.text)) reading += token.text;
    else return null;
  }
  return reading && reading !== text ? reading : null;
}

/**
 * 새 조각의 잠정 필드(§3.4 표). 뜻·품사·사전 읽기는 서버 분석 경로(PR②)가 채우고 덮는다.
 * parts는 조각을 이루는 분석기 토큰 조각들이다(partsOf).
 */
export function composeBoundaryPiece({language, text, parts = [], marker = 'user'}) {
  const whole = parts.length > 0 && parts.every(part => part.whole);
  const token = {text, base_form: text, furigana: language === 'Japanese' ? null : '', pos: null, boundary: marker};
  if (language === 'Chinese') {
    token.furigana = zhPieceReading(parts);
  } else if (language === 'Japanese' && whole) {
    // 申し|込ん → 申し込む: 앞 조각 표면 + 마지막 조각 기본형.
    const last = parts.at(-1).token;
    token.base_form = parts.slice(0, -1).map(part => part.token.text).join('') + (last.base_form || last.text);
    token.furigana = jaPieceReading(parts, text);
  } else if (language === 'English') {
    // picked|up → pick up: 첫 조각 lemma + 나머지 소문자. 일부 조각이면 표면 소문자.
    token.base_form = whole
      ? [parts[0].token.base_form || parts[0].token.text.toLowerCase(), ...parts.slice(1).map(part => part.token.text.toLowerCase())].join(' ')
      : text.toLowerCase();
  }
  return token;
}

/** 기록 하나가 지금 줄 토큰과 맞는가(구간 글자·양 끝 경계·칼선·base 글자). */
function recordMatches(record, spans, compact, bounds) {
  const {start, end, text, cuts, base} = record || {};
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= end || typeof text !== 'string') return false;
  if (!bounds.has(start) || !bounds.has(end) || compact.slice(start, end) !== text) return false;
  if (!validCuts(cuts, start, end, compact) || !sameCuts(cuts, cutsWithin(spans, start, end))) return false;
  return Array.isArray(base) && base.length > 0 && base.map(entry => compactBoundaryText(tokenText(entry))).join('') === text;
}

const shiftedSpans = (entries, offset) => boundarySpans(entries).map(span => ({...span, start: span.start + offset, end: span.end + offset}));

/**
 * 경계 편집 한 번(§3.2). lineTokens = 그 줄의 지금 토큰 [{id, token}], edits = 자료의 기록 목록(다른 줄 기록은 그대로 둔다),
 * request = {line, start, end, cuts}: [start, end) 안의 칼선을 cuts로 바꾼다. 묶기 = cuts [], 나누기 = cuts [칼선…].
 * options = {language, id?, at?, lineText?}. 결과:
 * · 거부 {ok:false, reason, tokens: lineTokens, edits}(같은 참조 — 아무것도 바꾸지 않는다)
 * · {ok:true, changed, restored, tokens, edits, record, pieces}. restored면 base를 id째 되살렸고 서버 호출이 필요 없다.
 *   pieces = 서버가 분석해야 할 새 조각 [{index, start, end, text}](그 자리 토큰은 id:null · needsAnalysis:true).
 */
export function editBoundaries(lineTokens, edits, request = {}, options = {}) {
  const allEdits = Array.isArray(edits) ? edits : [];
  const result = (extra) => ({ok: true, changed: false, restored: false, tokens: lineTokens, edits: allEdits, record: null, pieces: [], ...extra});
  const reject = reason => result({ok: false, reason});
  const {language} = options;
  const blocked = languageReason(language);
  if (blocked) return reject(blocked);
  if (!Array.isArray(lineTokens) || !lineTokens.length) return reject('invalid_line');
  const {line, start, end, cuts} = request || {};
  const spans = boundarySpans(lineTokens), compact = lineCompact(spans), bounds = boundsOf(spans);
  if (!Number.isInteger(line) || line < 0 || !Number.isInteger(start) || !Number.isInteger(end)
    || start < 0 || end > compact.length || start >= end) return reject('invalid_range');
  if (!bounds.has(start) || !bounds.has(end)) return reject('not_token_boundary');
  if (!validCuts(cuts, start, end, compact)) return reject('invalid_cuts');

  const lineEdits = allEdits.filter(record => record?.line === line);
  const applied = lineEdits.filter(record => record.status !== 'pending');
  if (lineEdits.some(record => record.status === 'pending' && record.start < end && record.end > start)) return reject('pending_edit');
  const ordered = [...applied].sort((a, b) => a.start - b.start);
  if (applied.some(record => !recordMatches(record, spans, compact, bounds))
    || ordered.some((record, k) => k > 0 && record.start < ordered[k - 1].end)) return reject('stale_edits');

  // 1) 겹치는 기록을 모아 구간을 넓힌다.
  const hits = applied.filter(record => record.start < end && record.end > start);
  const s = Math.min(start, ...hits.map(record => record.start)), e = Math.max(end, ...hits.map(record => record.end));
  const region = spans.filter(span => inRegion(span, s, e));
  if (region.some(span => span.start === span.end)) return reject('whitespace_inside');

  // 2) base 재구성: 겹친 기록의 base + 기록 밖 지금 토큰(= 분석기 원래 토큰), 순서대로.
  const base = [], used = new Set();
  for (const span of region) {
    const hit = hits.find(record => span.start >= record.start && span.end <= record.end);
    if (!hit) base.push(span.entry);
    else if (!used.has(hit)) { used.add(hit); base.push(...hit.base); }
  }

  // 3) 목표 칼선 = 넓힌 구간의 지금 칼선 중 요청 구간 밖의 것 ∪ 요청 칼선.
  const current = cutsWithin(spans, s, e);
  const want = [...new Set([...current.filter(cut => cut <= start || cut >= end), ...cuts])].sort((a, b) => a - b);
  if (sameCuts(want, current)) return result({});
  const head = lineTokens.slice(0, spans.indexOf(region[0]));
  const tail = lineTokens.slice(spans.indexOf(region.at(-1)) + 1);
  const rest = allEdits.filter(record => !hits.includes(record));
  const baseSpans = shiftedSpans(base, s);

  // 4) 목표 칼선이 base 칼선과 같으면 기록을 지우고 base를 id째 되살린다(서버 호출 0).
  if (sameCuts(want, cutsWithin(baseSpans, s, e))) {
    return result({changed: true, restored: true, tokens: [...head, ...base, ...tail], edits: rest});
  }

  // 5) 아니면 기록 하나로 합친다. 같은 자리의 지금 토큰 → 분석기 토큰 → 새 조각 순으로 쓴다.
  const points = [s, ...want, e], middle = [], pieces = [];
  const context = {language, lineText: options.lineText, compact};
  for (let k = 0; k + 1 < points.length; k++) {
    const a = points[k], b = points[k + 1];
    const same = region.find(span => span.start === a && span.end === b) || baseSpans.find(span => span.start === a && span.end === b);
    if (same) { middle.push(same.entry); continue; }
    const text = pieceText(baseSpans, a, b, context);
    pieces.push({index: head.length + middle.length, start: a, end: b, text});
    middle.push({id: null, token: composeBoundaryPiece({language, text, parts: partsOf(baseSpans, a, b)}), needsAnalysis: true});
  }
  const record = {id: options.id ?? hits[0]?.id ?? `b_${line}_${s}_${e}`, line, start: s, end: e,
    text: compact.slice(s, e), cuts: want, base, status: 'applied', ...(options.at ? {at: options.at} : {})};
  const firstHit = hits.length ? allEdits.indexOf(hits[0]) : -1, nextEdits = [];
  allEdits.forEach((item, index) => { if (index === firstHit) nextEdits.push(record); if (!hits.includes(item)) nextEdits.push(item); });
  if (firstHit < 0) nextEdits.push(record);
  return result({changed: true, tokens: [...head, ...middle, ...tail], edits: nextEdits, record, pieces});
}

/**
 * 분석기가 새로 낸 줄 토큰 위에 그 줄의 기록을 다시 적용한다(§3.4 서버 적용 · §3.5 재분석 뒤 유지).
 * 구간 글자가 기록 text와 다르면 줄에서 정확히 한 번 나올 때만 옮기고, 양 끝이 새 토큰 경계와 맞지 않거나
 * 찾지 못하면 pending으로 남긴다(조용히 버리지 않는다). 기록이 없거나 하나도 적용되지 않으면 입력 배열을 그대로 돌려준다.
 * 결과 {tokens, results: [{id, status, start?, end?, cuts?, base, reason?, moved?, redundant?}]}(입력 순서).
 * options.markRedundant(서버 적용): 분석기가 이미 같은 칼선을 낸 기록의 토큰에도 표식을 단다 — 사용자가 정한 경계를
 * AI 단어성 판정(OOV 분리)이 다시 가르지 않게 한다(§0.4). options.markers: 기록별 표식(applyBoundaryLayers가 쓴다).
 */
export function applyBoundaryEdits(lineTokens, lineEdits, options = {}) {
  const list = Array.isArray(lineEdits) ? lineEdits : [];
  const pending = (record, reason) => ({id: record?.id ?? null, status: 'pending', reason, base: []});
  const blocked = languageReason(options.language);
  if (blocked) return {tokens: lineTokens, results: list.map(record => pending(record, blocked))};
  if (!Array.isArray(lineTokens)) return {tokens: lineTokens, results: list.map(record => pending(record, 'invalid_line'))};
  const marker = BOUNDARY_MARKERS.includes(options.marker) ? options.marker : 'user';
  const markers = Array.isArray(options.markers) ? options.markers : [];
  const markerAt = index => (BOUNDARY_MARKERS.includes(markers[index]) ? markers[index] : marker);
  const spans = boundarySpans(lineTokens), compact = lineCompact(spans), bounds = boundsOf(spans);
  const results = new Array(list.length), regions = [];
  // 입력 순서대로 적용한다 — 겹치면 앞의 기록이 이기고 뒤의 것은 pending(한 자료 안 기록은 불변식 1로 겹치지 않는다).
  list.forEach((record, index) => {
    const {start, end, text, cuts} = record || {};
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= end || typeof text !== 'string'
      || compactBoundaryText(text) !== text || text.length !== end - start || !Array.isArray(cuts)) { results[index] = pending(record, 'invalid_edit'); return; }
    let delta = null, reason = null;
    if (compact.slice(start, end) === text) {
      if (bounds.has(start) && bounds.has(end)) delta = 0; else reason = 'edge_mismatch';
    } else {
      const first = compact.indexOf(text);
      if (first < 0 || compact.indexOf(text, first + 1) >= 0) reason = 'text_mismatch';
      else if (bounds.has(first) && bounds.has(first + text.length)) delta = first - start;
      else reason = 'edge_mismatch';
    }
    if (delta === null) { results[index] = pending(record, reason); return; }
    const s = start + delta, e = end + delta, want = cuts.map(cut => cut + delta);
    if (!validCuts(want, s, e, compact)) { results[index] = pending(record, 'invalid_edit'); return; }
    const region = spans.filter(span => inRegion(span, s, e));
    if (region.some(span => span.start === span.end)) { results[index] = pending(record, 'whitespace_inside'); return; }
    if (regions.some(other => other.s < e && other.e > s)) { results[index] = pending(record, 'overlap'); return; }
    const redundant = sameCuts(want, cutsWithin(spans, s, e));
    regions.push({s, e, want, region, redundant, marker: markerAt(index)});
    results[index] = {id: record.id ?? null, status: 'applied', start: s, end: e, cuts: want, base: region.map(span => span.entry),
      ...(delta ? {moved: true} : {}), ...(redundant ? {redundant: true} : {})};
  });

  const active = options.markRedundant ? regions : regions.filter(item => !item.redundant);
  if (!active.length) return {tokens: lineTokens, results};
  const context = {language: options.language, lineText: options.lineText, compact};
  const tokens = [];
  for (const span of spans) {
    const item = active.find(candidate => inRegion(span, candidate.s, candidate.e));
    if (!item) { tokens.push(span.entry); continue; }
    if (span !== item.region[0]) continue;
    const points = [item.s, ...item.want, item.e];
    for (let k = 0; k + 1 < points.length; k++) {
      const a = points[k], b = points[k + 1];
      const same = item.region.find(candidate => candidate.start === a && candidate.end === b);
      if (same) { tokens.push({...same.entry, token: {...same.entry.token, boundary: item.marker}}); continue; }
      const text = pieceText(spans, a, b, context);
      tokens.push({id: null, token: composeBoundaryPiece({language: options.language, text, parts: partsOf(spans, a, b), marker: item.marker})});
    }
  }
  return {tokens, results};
}

/**
 * 범위 간 적용 순서(§3.4): layers = [{marker:'shared_rule', edits}, {marker:'user_rule', edits}, {marker:'user', edits}]처럼
 * **적용 순서대로** 받고, 뒤 층이 이긴다. applyBoundaryEdits는 겹치면 앞 기록이 이기므로 뒤 층부터 넣어 한 번에 적용한다
 * — base는 언제나 분석기 원래 토큰이다(불변식 ②). 결과 {tokens, layers: [층마다 입력 순서의 results]}.
 * 지금은 「이 자료」('user') 층만 쓴다. 사용자·공유 규칙 표는 PR④.
 */
export function applyBoundaryLayers(lineTokens, layers, options = {}) {
  const list = Array.isArray(layers) ? layers : [];
  const records = [], markers = [], owners = [];
  for (let k = list.length - 1; k >= 0; k--) {
    const edits = Array.isArray(list[k]?.edits) ? list[k].edits : [];
    edits.forEach((record, i) => { records.push(record); markers.push(list[k].marker); owners.push([k, i]); });
  }
  const {tokens, results} = applyBoundaryEdits(lineTokens, records, {...options, markers});
  const out = list.map(layer => new Array(Array.isArray(layer?.edits) ? layer.edits.length : 0));
  results.forEach((result, j) => { const [k, i] = owners[j]; out[k][i] = result; });
  return {tokens, layers: out};
}

// ── 재분석 연결(PR②, analyzeHybrid) ────────────────────────────────────────

/**
 * 문단 하나의 분석 요청에 실을 기록. 줄 번호를 문단 안 번호로 바꾸고 요청 필드(§3.4)만 싣는다 — base는 보내지 않는다.
 * [{index(자료 기록 목록 위치), payload: {line, start, end, text, cuts, id}}]. 없으면 [] — 요청 본문에 키를 넣지 않는다.
 */
export function boundaryParagraphRequest(edits, lineIndices) {
  const at = new Map((lineIndices || []).map((line, k) => [line, k]));
  const sent = [];
  (Array.isArray(edits) ? edits : []).forEach((record, index) => {
    if (!at.has(record?.line)) return;
    const {start, end, text, cuts} = record;
    sent.push({index, payload: {line: at.get(record.line), start, end, text, cuts, id: record.id ?? null}});
  });
  return sent;
}

/**
 * 서버 적용 결과로 기록 하나를 갱신한다(§3.5-3). applied면 좌표·칼선과 base(새 분석기 토큰, makeId로 새 id)를 바꾸고,
 * 아니면(pending·결과 없음·base 글자가 기록과 다름) 기록을 그대로 두고 status만 pending — 조용히 버리지 않는다.
 * 옛 base id·교정값 승계는 재분석 보존(reanalysisPreservation.preserveBoundaryBase)이 한다.
 */
export function settleBoundaryRecord(record, result, makeId) {
  const base = Array.isArray(result?.base) ? result.base : [];
  const ok = result?.status === 'applied' && base.length > 0 && Number.isInteger(result.start) && Number.isInteger(result.end)
    && Array.isArray(result.cuts) && base.every(token => typeof token?.text === 'string')
    && base.map(token => compactBoundaryText(token.text)).join('') === record?.text;
  if (!ok) return record?.status === 'pending' ? record : {...record, status: 'pending'};
  return {...record, start: result.start, end: result.end, cuts: result.cuts,
    base: base.map(token => ({id: makeId(), token})), status: 'applied'};
}

/** 적용하지 못한(pending) 기록 수 — 재분석 결과 알림(§3.4 「적용하지 못한 단어 경계 N개」). */
export const pendingBoundaryCount = json => readBoundaryEdits(json).filter(record => record?.status === 'pending').length;

// ── processed_json 좌표 변환 ─────────────────────────────────────────────

/** 자료의 경계 기록 목록. 형식(version 1)이 아니면 빈 목록. */
export function readBoundaryEdits(json) {
  const store = json?.metadata?.viewerBoundaries;
  return store?.version === 1 && Array.isArray(store.edits) ? store.edits : [];
}

// ── AD-R4 PR④ 경계 후보(「한 단어로 묶을까요?」)를 [아니요]로 접은 꼴 ──
// metadata.viewerBoundaryDismissed = [이은 꼴…](이 자료 전체 · 최근 BOUNDARY_DISMISSED_LIMIT개). 서버는 재분석마다 후보 표식
// (토큰 boundarySuggest)을 다시 달지만, 재분석은 원래 metadata를 이어 쓰므로(runPreservedReanalysis) 접은 꼴은 재분석 뒤에도 접힌 채다.
export const BOUNDARY_DISMISSED_LIMIT = 200;

/** 접은 꼴 집합. 형식이 아니면 빈 집합. */
export function dismissedBoundaryForms(json) {
  const list = json?.metadata?.viewerBoundaryDismissed;
  return new Set(Array.isArray(list) ? list.filter(form => typeof form === 'string' && form) : []);
}

/** form을 접은 꼴에 더한 새 processed_json(입력은 바꾸지 않는다 · 토큰·기록·원문 무변경). */
export function withBoundarySuggestionDismissed(json, form) {
  const list = [...dismissedBoundaryForms(json)].filter(item => item !== form);
  list.push(form);
  return {...json, metadata: {...json?.metadata, viewerBoundaryDismissed: list.slice(-BOUNDARY_DISMISSED_LIMIT)}};
}

/** 원문 줄 하나의 토큰 [{id, token}](개행 제외). 줄 번호는 토큰 id 접두다(analysisTokenLine). */
export function boundaryLineEntries(json, line) {
  const out = [];
  for (const id of Array.isArray(json?.sequence) ? json.sequence : []) {
    const token = json.dictionary?.[id];
    if (analysisTokenLine(id) === line && !isNewline(id, token)) out.push({id, token});
  }
  return out;
}

function lineRange(json, ids) {
  const newline = ids.filter(id => isNewline(id, json.dictionary?.[id])).length;
  if (!ids.length || newline === ids.length) return {ok: false, reason: 'invalid_range'};
  const lines = ids.map(analysisTokenLine);
  if (newline) return {ok: false, reason: 'cross_line'};
  if (lines.includes(null)) return {ok: false, reason: 'invalid_range'};
  if (lines.some(line => line !== lines[0])) return {ok: false, reason: 'cross_line'};
  const line = lines[0];
  const entries = boundaryLineEntries(json, line), spans = boundarySpans(entries);
  const first = spans.find(span => span.entry.id === ids[0]), last = spans.find(span => span.entry.id === ids.at(-1));
  if (!first || !last) return {ok: false, reason: 'invalid_range'};
  return {ok: true, line, start: first.start, end: last.end, entries, ids};
}

/** 본문 드래그 범위(시퀀스 인덱스, 끝 포함 — useTokenRangeSelect) → 줄 좌표 {line, start, end, entries, ids}. */
export function boundarySelection(json, startIdx, endIdx) {
  const sequence = Array.isArray(json?.sequence) ? json.sequence : [];
  if (!Number.isInteger(startIdx) || !Number.isInteger(endIdx) || startIdx < 0 || endIdx < startIdx || endIdx >= sequence.length) {
    return {ok: false, reason: 'invalid_range'};
  }
  return lineRange(json, sequence.slice(startIdx, endIdx + 1));
}

/** 토큰 하나(카드 「나누기」) → 줄 좌표 {line, start, end, entries, entry}. */
export function boundaryTokenRange(json, tokenId) {
  if (!Array.isArray(json?.sequence) || !json.sequence.includes(tokenId) || isNewline(tokenId, json.dictionary?.[tokenId])) {
    return {ok: false, reason: 'invalid_range'};
  }
  const range = lineRange(json, [tokenId]);
  return range.ok ? {...range, entry: range.entries.find(entry => entry.id === tokenId)} : range;
}

/** id 없는 새 조각에 `id_<줄>_e<k>_<리비전 8자>`를 단다(§3.3). 줄 좌표 검사·재분석 id 이동을 그대로 통과하는 접두다. */
export function assignBoundaryPieceIds(entries, line, revision) {
  const rev = String(revision ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 8);
  if (!Number.isInteger(line) || line < 0 || !rev) return null;
  return entries.map((entry, k) => (entry.id ? entry : {id: `id_${line}_e${k}_${rev}`, token: entry.token}));
}

/**
 * 편집 결과(줄 토큰 + 기록)를 processed_json에 반영한 새 객체. 다른 줄·개행·다른 토큰 객체는 그대로 둔다.
 * 기록이 0이 되면 viewerBoundaries 키를 지워 원래 모양으로 돌아간다. id 없는 조각이 있거나 줄이 비면 null.
 */
export function replaceBoundaryLine(json, line, entries, edits) {
  if (!Array.isArray(json?.sequence) || !Array.isArray(entries) || !entries.length) return null;
  if (entries.some(entry => typeof entry?.id !== 'string' || analysisTokenLine(entry.id) !== line || !entry.token || isNewline(entry.id, entry.token))) return null;
  const sequence = [], dictionary = {...json.dictionary}, removed = [];
  let inserted = false;
  for (const id of json.sequence) {
    if (analysisTokenLine(id) === line && !isNewline(id, json.dictionary?.[id])) {
      removed.push(id);
      if (!inserted) { sequence.push(...entries.map(entry => entry.id)); inserted = true; }
      continue;
    }
    sequence.push(id);
  }
  if (!inserted) return null;
  for (const id of removed) delete dictionary[id];
  for (const entry of entries) dictionary[entry.id] = entry.token;
  const metadata = {...json.metadata};
  if (Array.isArray(edits) && edits.length) metadata.viewerBoundaries = {version: 1, edits};
  else delete metadata.viewerBoundaries;
  return {...json, sequence, dictionary, metadata};
}

/**
 * 저장 문맥 id가 경계 기록 base에 있으면, 그 원래 토큰 자리를 통째로 덮는 지금 토큰 id(하나일 때만)를 돌려준다(§4.3).
 * 기록 구간 글자가 지금 토큰과 다르거나(오래된 기록) 표면이 다르면 null. readingSourceTarget이 쓴다.
 */
export function boundaryCoveringToken(json, tokenId, surface) {
  if (typeof tokenId !== 'string' || json?.metadata?.language === 'Korean') return null;
  for (const record of readBoundaryEdits(json)) {
    // id 또는 원래 id 별칭(was — 원문 위에 줄을 넣어 줄 접두가 바뀐 base, reanalysisPreservation.mapBoundaryEdits)으로 찾는다.
    const at = Array.isArray(record?.base) ? record.base.findIndex(entry => entry?.id === tokenId
      || (Array.isArray(entry?.was) && entry.was.includes(tokenId))) : -1;
    if (at < 0 || !Number.isInteger(record.line) || !Number.isInteger(record.start)) continue;
    const saved = compactBoundaryText(tokenText(record.base[at]));
    if (!saved || (surface && saved !== surface)) return null;
    const spans = boundarySpans(boundaryLineEntries(json, record.line));
    if (lineCompact(spans).slice(record.start, record.end) !== record.text) return null;
    const from = record.start + record.base.slice(0, at).reduce((sum, entry) => sum + compactBoundaryText(tokenText(entry)).length, 0);
    const covering = spans.filter(span => span.start <= from && span.end >= from + saved.length && span.end > span.start);
    return covering.length === 1 ? covering[0].entry.id : null;
  }
  return null;
}

// ── 조건 판정(§6.1 · §4.4 · §12.2) ─────────────────────────────────────────
// 이유 코드만 돌려준다. 화면 문구는 PR③에서 vt() 3벌(ko·zh-CN·zh-TW)로 붙인다.

function contextReason(json, ctx) {
  const language = ctx.language ?? json?.metadata?.language;
  const blocked = json?.metadata?.language === 'Korean' ? 'korean' : languageReason(language);
  if (blocked) return blocked;
  if (ctx.owner !== true) return 'not_owner';
  if (ctx.classCopy) return 'class_copy';
  if (ctx.passage) return 'passage';
  if (ctx.classMode) return 'class_mode';
  return null;
}

function tokenReason(id, token, language) {
  if (!token || token.failed || String(id).startsWith('failed_')) return 'failed';
  const text = typeof token.text === 'string' ? token.text : '';
  if (token.pos === '기호' || !WORDISH.test(text)) return 'punctuation';
  // 이합사 조각(道了歉의 歉 → sep_link)·삽입형(吵过架 base_form 吵架). 일본어 활용형은 기본형이 달라도 된다.
  if (language === 'Chinese' && (token.sep_link || (token.base_form && token.base_form !== text))) return 'separable';
  return null;
}

function editLimitReason(json, line, start, end) {
  const edits = readBoundaryEdits(json);
  if (edits.length < BOUNDARY_LIMITS.maxEdits) return null;
  const overlaps = edits.some(record => record?.line === line && record.start < end && record.end > start);
  return overlaps ? null : 'edit_limit';
}

/** 본문 드래그 범위(시퀀스 인덱스, 끝 포함)를 한 단어로 묶을 수 있나. {ok, reason, selection?} */
export function boundaryMergeEligibility(json, startIdx, endIdx, ctx = {}) {
  const gate = contextReason(json, ctx);
  if (gate) return {ok: false, reason: gate};
  const language = ctx.language ?? json?.metadata?.language;
  const selection = boundarySelection(json, startIdx, endIdx);
  if (!selection.ok) return selection;
  const picked = selection.entries.filter(entry => selection.ids.includes(entry.id));
  for (const entry of picked) {
    const reason = tokenReason(entry.id, entry.token, language);
    if (reason) return {ok: false, reason};
  }
  if (picked.length < 2) return {ok: false, reason: 'too_few'};
  if (picked.length > BOUNDARY_LIMITS.maxTokens) return {ok: false, reason: 'too_many'};
  if (selection.end - selection.start > BOUNDARY_LIMITS.maxChars[language]) return {ok: false, reason: 'too_long'};
  const limit = editLimitReason(json, selection.line, selection.start, selection.end);
  return limit ? {ok: false, reason: limit} : {ok: true, reason: null, selection};
}

/** 토큰 하나를 나눌 수 있나. 영어는 공백이 든(묶은) 토큰만. {ok, reason, selection?} */
export function boundarySplitEligibility(json, tokenId, ctx = {}) {
  const gate = contextReason(json, ctx);
  if (gate) return {ok: false, reason: gate};
  const language = ctx.language ?? json?.metadata?.language;
  const selection = boundaryTokenRange(json, tokenId);
  if (!selection.ok) return selection;
  const {token} = selection.entry;
  const reason = tokenReason(tokenId, token, language);
  if (reason) return {ok: false, reason};
  if (language === 'English' && !SPACE.test(token.text.trim())) return {ok: false, reason: 'single_word'};
  if ([...compactBoundaryText(token.text)].length < 2) return {ok: false, reason: 'too_short'};
  const limit = editLimitReason(json, selection.line, selection.start, selection.end);
  return limit ? {ok: false, reason: limit} : {ok: true, reason: null, selection};
}
