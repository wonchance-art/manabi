// 뷰어 v2 AD-R3 PR③ — 「이 자료」 단어 경계 편집(한 단어로 묶기 · 나누기 · 되돌리기)의 화면 쪽 흐름.
// 정본: docs/manabi-viewer-v2-ad-r3.md §4.1(한 번의 흐름) · §4.2(보존) · §6.1(조건) · §11.2(제안값).
//
// · 계산은 PR① 순수 함수(boundaryEdits.js), 새 조각의 뜻·병음·품사는 PR② 서버 적용(/api/analyze `boundaries`)이 만든다.
// · 쓰기는 둘뿐이다: 이 자료의 processed_json(원자 RPC viewer_replace_analysis — 기대값 비교·소유자·분석 임대 확인)과
//   token_corrections 이력 한 줄(after_value.source = 'boundary_edit'). 원문(p_raw = p_expected_raw)·저장 단어·FSRS·
//   평가 이력·개인 뜻·출처·사전은 쓰지 않는다(boundaryEditWiring.test.js 소스 계약 + e2e 요청 감시).
// · 범위는 ① 이 자료만이다. ② 내 다른 자료·③ 공유 사전 규칙은 PR④(DDL)에서 더한다.
// · 한국어는 어절 칼선 오너 결정(§7.4) 전이라 진입점을 열지 않는다 — 모든 판정이 'korean'으로 거부한다.
import {
  BOUNDARY_LANGUAGES, BOUNDARY_LIMITS, assignBoundaryPieceIds, boundaryLineEntries, boundaryMergeEligibility,
  boundarySpans, boundarySplitEligibility, compactBoundaryText, editBoundaries, readBoundaryEdits, replaceBoundaryLine,
  withBoundarySuggestionDismissed,
} from './boundaryEdits';
import { analysisTokenLine } from './analysisCoverage';
import { replaceViewerAnalysis } from './reanalysisPreservation';

/** 화면 판정에 넘길 문맥(§6.1 · §4.4 · Q4 · §12.2). 수업 사본 = 팀 수업이 만든 사본(source_ref) 또는 기기 사본(__local). */
export function boundaryEditContext(material, { userId, classMode = false, passage = false } = {}) {
  const meta = material?.processed_json?.metadata || {};
  return {
    language: meta.language,
    owner: !!userId && userId === material?.owner_id,
    classCopy: !!meta.source_ref || !!material?.__local,
    passage: !!passage,
    classMode: !!classMode,
  };
}

/** 진입점(드래그 「한 단어로 묶기」 · ⋯ 「옆 단어와 묶기」·「나누기」 · 카드 [나누기])을 보일 수 있나. 비소유자·한국어·사본·구간·수업 모드는 0. */
export function boundaryEntryAllowed(ctx) {
  return !!ctx && ctx.owner === true && BOUNDARY_LANGUAGES.includes(ctx.language)
    && !ctx.classCopy && !ctx.passage && !ctx.classMode;
}

// 진입점을 숨기는 이유(보일 문구 없음) — 나머지는 버튼을 끄고 이유를 쓴다(§6.1 「숨기지 않고 꺼진 채 이유」).
const HIDDEN_REASONS = new Set(['korean', 'unsupported_language', 'not_owner', 'class_copy', 'passage', 'class_mode']);
export const boundaryReasonHidden = reason => HIDDEN_REASONS.has(reason);

/**
 * 이유 코드 → 화면 문구(한국어 원문 키 — 호출 쪽이 vt()로 3개 언어를 붙인다). viewerMessages.js에 세 벌이 있다.
 * 알 수 없는 코드는 일반 문구.
 */
export function boundaryReasonMessage(reason) {
  switch (reason) {
    case 'cross_line': return ['줄을 넘어서는 묶을 수 없어요'];
    case 'punctuation': return ['문장부호를 넘어서는 묶을 수 없어요'];
    case 'failed': return ['분석되지 않은 부분은 고칠 수 없어요'];
    case 'separable': return ['떨어진 동사(이합사) 조각은 묶거나 나눌 수 없어요'];
    case 'too_few': return ['두 단어 이상 골라 주세요'];
    case 'too_many': return ['한 번에 {count}개까지 묶을 수 있어요', { count: BOUNDARY_LIMITS.maxTokens }];
    case 'too_long': return ['너무 길어서 한 단어로 묶을 수 없어요'];
    case 'edit_limit': return ['이 자료에서는 더 고칠 수 없어요. 다시 분석한 뒤 고쳐 주세요'];
    case 'single_word': return ['한 단어라 나눌 수 없어요'];
    case 'too_short': return ['한 글자라 나눌 수 없어요'];
    case 'no_neighbor': return ['옆에 묶을 단어가 없어요'];
    case 'pending_edit': return ['적용하지 못한 단어 경계와 겹쳐서 고칠 수 없어요'];
    case 'stale_edits': return ['단어 경계 기록이 지금 분석과 달라요. 다시 분석한 뒤 고쳐 주세요'];
    default: return ['이 범위는 고칠 수 없어요'];
  }
}

const lineTextOf = (material, line) => String(material?.raw_text ?? '').split('\n')[line] ?? '';

/** 편집을 실제로 계산해 본다(쓰기 0) — 조건 판정이 못 보는 대기 기록(pending_edit)·오래된 기록(stale_edits)을 미리 잡는다. */
function dryRun(material, request) {
  const json = material?.processed_json;
  const language = json?.metadata?.language;
  return editBoundaries(boundaryLineEntries(json, request.line), readBoundaryEdits(json), request,
    { language, lineText: lineTextOf(material, request.line) });
}

/**
 * 본문 드래그 범위(시퀀스 인덱스, 끝 포함)를 한 단어로 묶을 수 있나.
 * {ok, reason, request?: {line,start,end,cuts:[]}, parts?: [표면…], result?: 묶은 꼴, ids?: [구성 토큰 id…]}
 */
export function planBoundaryMerge(material, startIdx, endIdx, ctx) {
  const json = material?.processed_json;
  const check = boundaryMergeEligibility(json, startIdx, endIdx, ctx);
  if (!check.ok) return { ok: false, reason: check.reason };
  const { line, start, end, ids, entries } = check.selection;
  const request = { line, start, end, cuts: [] };
  const run = dryRun(material, request);
  if (!run.ok) return { ok: false, reason: run.reason };
  if (!run.changed) return { ok: false, reason: 'invalid_range' };
  const picked = entries.filter(entry => ids.includes(entry.id));
  const merged = boundarySpans(run.tokens).find(span => span.start === start)?.entry;
  return {
    ok: true, reason: null, request, ids,
    parts: picked.map(entry => entry.token.text),
    result: merged?.token?.text || picked.map(entry => entry.token.text).join(''),
  };
}

/** 카드 ⋯ 「옆 단어와 묶기」: 같은 줄 앞·뒤 이웃과 묶는 두 안. {prev, next} 각각 planBoundaryMerge 결과(이웃이 없으면 no_neighbor). */
export function planNeighborMerge(material, tokenId, ctx) {
  const sequence = material?.processed_json?.sequence || [];
  const index = sequence.indexOf(tokenId);
  const none = { ok: false, reason: 'no_neighbor' };
  if (index < 0) return { prev: none, next: none };
  const neighbor = at => at >= 0 && at < sequence.length && analysisTokenLine(sequence[at]) === analysisTokenLine(tokenId)
    && material.processed_json.dictionary?.[sequence[at]]?.pos !== '개행';
  return {
    prev: neighbor(index - 1) ? planBoundaryMerge(material, index - 1, index, ctx) : none,
    next: neighbor(index + 1) ? planBoundaryMerge(material, index, index + 1, ctx) : none,
  };
}

/**
 * 카드 「나누기」: 칼선을 둘 수 있는 자리. 중·일은 글자 사이마다(일본어는 가나 경계 포함 §7.2), 영어는 단어 사이(공백)만.
 * {ok, reason, line?, start?, end?, chars?: [표시 조각…], cuts?: [줄 좌표 칼선 후보…](chars 사이 k번째 = cuts[k])}
 */
export function planBoundarySplit(material, tokenId, ctx) {
  const json = material?.processed_json;
  const check = boundarySplitEligibility(json, tokenId, ctx);
  if (!check.ok) return { ok: false, reason: check.reason };
  const { line, start, end, entry } = check.selection;
  const language = ctx?.language ?? json?.metadata?.language;
  const text = String(entry.token.text || '');
  const chars = [], cuts = [];
  if (language === 'English') {
    let at = start;
    text.trim().split(/\s+/u).forEach((word, k) => {
      if (k) cuts.push(at);
      chars.push(word);
      at += word.length;
    });
  } else {
    let at = start;
    [...compactBoundaryText(text)].forEach((ch, k) => {
      if (k) cuts.push(at);
      chars.push(ch);
      at += ch.length;
    });
  }
  // 대기 기록과 겹치면(pending_edit) 미리 알린다 — 칼선 하나로 계산해 본다.
  const run = cuts.length ? dryRun(material, { line, start, end, cuts: [cuts[0]] }) : { ok: false, reason: 'too_short' };
  if (!run.ok) return { ok: false, reason: run.reason };
  return { ok: true, reason: null, language, line, start, end, chars, cuts };
}

/** 고른 칼선(줄 좌표)으로 미리 보기 조각. chars·cuts는 planBoundarySplit 결과. */
export function splitPreview(plan, chosen) {
  if (!plan?.ok) return [];
  const pieces = [[]];
  plan.chars.forEach((ch, k) => {
    if (k && chosen.includes(plan.cuts[k - 1])) pieces.push([]);
    pieces.at(-1).push(ch);
  });
  return pieces.map(list => list.join(plan.language === 'English' ? ' ' : ''));
}

/**
 * 토큰이 직접 고친 경계에서 왔나 — 'merged'(묶은 단어: 분석기 칼선을 하나 이상 지운 조각) · 'split'(나눈 조각) · null.
 * 표식(boundary)이 아니라 기록 구간과 base 칼선으로 판정한다(같은 자리를 다시 쓴 조각은 표식이 없을 수 있다).
 */
export function boundaryTokenOrigin(json, tokenId) {
  if (typeof tokenId !== 'string' || json?.metadata?.language === 'Korean') return null;
  const line = analysisTokenLine(tokenId);
  if (line === null) return null;
  const spans = boundarySpans(boundaryLineEntries(json, line));
  const span = spans.find(item => item.entry.id === tokenId);
  if (!span || span.end <= span.start) return null;
  for (const record of readBoundaryEdits(json)) {
    if (record?.line !== line || record.status === 'pending' || !Array.isArray(record.base)) continue;
    if (span.start < record.start || span.end > record.end) continue;
    if (record.base.some(entry => entry?.id === tokenId)) return null; // 되살린 원래 토큰
    let at = record.start;
    const baseCuts = record.base.slice(0, -1).map(entry => (at += compactBoundaryText(entry?.token?.text).length));
    const baseEdges = new Set([record.start, ...baseCuts, record.end]);
    if (baseCuts.some(cut => cut > span.start && cut < span.end)) return 'merged';
    return baseEdges.has(span.start) && baseEdges.has(span.end) ? null : 'split';
  }
  return null;
}

export class BoundaryEditError extends Error {
  constructor(reason, message = reason) {
    super(message);
    this.name = 'BoundaryEditError';
    this.reason = reason;
  }
}

const cutsInside = (entries, start, end) => boundarySpans(entries).map(span => span.end).filter(at => at > start && at < end);

/** 서버 분석 결과(한 줄)에서 [start, end) 조각 토큰을 찾는다. 글자·양 끝이 정확히 맞을 때만. */
function serverPiece(result, piece) {
  const entries = (result?.sequence || []).map(id => ({ id, token: result.dictionary?.[id] }))
    .filter(entry => entry.token && entry.token.pos !== '개행');
  const span = boundarySpans(entries).find(item => item.start === piece.start && item.end === piece.end);
  if (!span || compactBoundaryText(span.entry.token.text) !== compactBoundaryText(piece.text)) return null;
  const { id: _drop, ...token } = span.entry.token;
  return { ...token, boundary: token.boundary || 'user' };
}

async function logBoundaryHistory(client, { materialId, userId, tokenId, before, after }) {
  if (!userId || !tokenId) return;
  try {
    const { error } = await client.from('token_corrections').insert({
      material_id: materialId, token_id: tokenId, user_id: userId, before_value: before, after_value: after,
    });
    if (error) console.warn('[boundary log] failed:', error.message);
  } catch (error) {
    console.warn('[boundary log] failed:', error?.message);
  }
}

/**
 * 묶기·나누기 한 번(§4.1). request = {line, start, end, cuts}(줄 좌표 — 묶기 cuts [], 나누기 cuts [칼선…]).
 * deps = {client(supabase), analyze(body) → 응답 JSON(/api/analyze), userId, attempt?(uuid), now?(ISO)}.
 * 1) editBoundaries로 새 기록 계산 → 2) base 복원이면 서버 호출 0, 아니면 그 줄 하나만 boundaries와 함께 분석해 조각을 받는다
 * → 3) 바뀐 구간 밖 토큰은 기존 객체·id 그대로 → 4) viewer_replace_analysis(원문 그대로) → 5) token_corrections 이력 1행.
 * 결과 {material(저장된 행), selectId(구간 첫 새 토큰), restored, undo(되돌리기 자료)}. 바뀐 것이 없으면 null.
 */
export async function commitBoundaryEdit(material, request, deps) {
  const { client, analyze, userId } = deps;
  const attempt = deps.attempt || crypto.randomUUID();
  const json = material?.processed_json;
  const language = json?.metadata?.language;
  const { line } = request;
  const lineText = lineTextOf(material, line);
  const entries = boundaryLineEntries(json, line);
  const edits = readBoundaryEdits(json);
  const run = editBoundaries(entries, edits, request, { language, lineText, at: deps.now || new Date().toISOString() });
  if (!run.ok) throw new BoundaryEditError(run.reason);
  if (!run.changed) return null;
  const hits = edits.filter(record => !run.edits.includes(record));
  const start = Math.min(request.start, ...hits.map(record => record.start));
  const end = Math.max(request.end, ...hits.map(record => record.end));

  let next = run.tokens;
  if (!run.restored) {
    const { record } = run;
    const response = await analyze({
      lines: [lineText.trim()], language,
      boundaries: [{ line: 0, start: record.start, end: record.end, text: record.text, cuts: record.cuts, id: record.id }],
    });
    const result = response?.results?.[0];
    const applied = result?.boundaryApplied?.[0];
    if (applied?.status !== 'applied' || applied.start !== record.start || applied.end !== record.end) {
      throw new BoundaryEditError('analysis_mismatch');
    }
    const byIndex = new Map(run.pieces.map(piece => [piece.index, serverPiece(result, piece)]));
    if ([...byIndex.values()].some(token => !token)) throw new BoundaryEditError('analysis_mismatch');
    next = assignBoundaryPieceIds(run.tokens.map((entry, k) => (byIndex.has(k) ? { id: null, token: byIndex.get(k) } : entry)), line, attempt);
    if (!next) throw new BoundaryEditError('analysis_mismatch');
  }
  const replaced = replaceBoundaryLine(json, line, next, run.edits);
  if (!replaced) throw new BoundaryEditError('analysis_mismatch');
  const nextJson = { ...replaced, metadata: { ...replaced.metadata, viewerRevision: attempt } };
  const saved = await replaceViewerAnalysis(client, material, material.raw_text, nextJson, attempt);

  const selectId = boundarySpans(next).find(span => span.start === request.start)?.entry.id ?? next[0].id;
  const firstBefore = boundarySpans(entries).find(span => span.start === start)?.entry.id ?? null;
  const recordId = run.record?.id ?? hits[0]?.id ?? null;
  const cutsBefore = cutsInside(entries, start, end);
  const cutsAfter = cutsInside(next, start, end);
  await logBoundaryHistory(client, {
    materialId: material.id, userId, tokenId: firstBefore,
    before: { boundary: { line, start, end, text: compactBoundaryText(lineText).slice(start, end), cuts: cutsBefore } },
    after: { source: 'boundary_edit', id: recordId, cuts: cutsAfter, scope: 'material', ...(run.restored ? { restored: true } : {}) },
  });
  return {
    material: saved, selectId, restored: run.restored,
    kind: cutsAfter.length < cutsBefore.length ? 'merge' : 'split',
    undo: { line, start, end, beforeEntries: entries, beforeEdits: edits, afterIds: next.map(entry => entry.id), afterEdits: run.edits, selectId, recordId },
  };
}

/** 되돌리기가 아직 맞나 — 그 줄 토큰과 기록이 편집 직후 그대로일 때만(다른 편집·재분석 뒤에는 줄을 숨긴다). */
export function boundaryUndoValid(json, undo) {
  if (!undo) return false;
  const ids = boundaryLineEntries(json, undo.line).map(entry => entry.id);
  return ids.length === undo.afterIds.length && ids.every((id, k) => id === undo.afterIds[k])
    && JSON.stringify(readBoundaryEdits(json)) === JSON.stringify(undo.afterEdits);
}

/**
 * 되돌리기 = 그 줄의 편집 전 토큰(객체·id)과 기록을 그대로 되살린다(서버 호출 0). 쓰기는 같은 원자 RPC + 이력 1행.
 * 결과 {material, selectId(편집 전 그 자리 토큰)}.
 */
export async function undoBoundaryEdit(material, undo, deps) {
  const { client, userId } = deps;
  const json = material?.processed_json;
  if (!boundaryUndoValid(json, undo)) throw new BoundaryEditError('stale_edits');
  const attempt = deps.attempt || crypto.randomUUID();
  const replaced = replaceBoundaryLine(json, undo.line, undo.beforeEntries, undo.beforeEdits);
  if (!replaced) throw new BoundaryEditError('stale_edits');
  const nextJson = { ...replaced, metadata: { ...replaced.metadata, viewerRevision: attempt } };
  const saved = await replaceViewerAnalysis(client, material, material.raw_text, nextJson, attempt);
  const current = boundaryLineEntries(json, undo.line);
  const spans = boundarySpans(undo.beforeEntries);
  await logBoundaryHistory(client, {
    materialId: material.id, userId, tokenId: spans.find(span => span.start === undo.start)?.entry.id ?? null,
    before: { boundary: { line: undo.line, start: undo.start, end: undo.end, cuts: cutsInside(current, undo.start, undo.end) } },
    after: { source: 'boundary_edit', id: undo.recordId, cuts: cutsInside(undo.beforeEntries, undo.start, undo.end), scope: 'material', undo: true },
  });
  return { material: saved, selectId: spans.find(span => span.start === undo.start)?.entry.id ?? undo.beforeEntries[0]?.id };
}

/**
 * AD-R4 PR④ 경계 후보 [아니요] — 그 꼴을 이 자료의 접은 꼴(metadata.viewerBoundaryDismissed)에 더한다(설계서 §6.2).
 * 쓰기는 묶기·나누기와 같은 원자 RPC(viewer_replace_analysis — 기대값 비교·소유자 확인, 원문 그대로) 하나. 토큰·기록·저장 단어·
 * FSRS·사전 쓰기 0. 중국어만. 결과 {material(저장된 행)}.
 */
export async function dismissBoundarySuggestion(material, form, deps) {
  const json = material?.processed_json;
  if (json?.metadata?.language !== 'Chinese') throw new BoundaryEditError('unsupported_language');
  if (typeof form !== 'string' || !form) throw new BoundaryEditError('invalid_range');
  const attempt = deps.attempt || crypto.randomUUID();
  const next = withBoundarySuggestionDismissed(json, form);
  const nextJson = { ...next, metadata: { ...next.metadata, viewerRevision: attempt } };
  return { material: await replaceViewerAnalysis(deps.client, material, material.raw_text, nextJson, attempt) };
}

/** 적용하지 못한(pending) 기록 목록 — 재분석 알림 [보기]. {id, text(칼선 │), sentence(그 줄 원문 또는 null)} */
export function pendingBoundaryRows(material) {
  const json = material?.processed_json;
  if (json?.metadata?.language === 'Korean') return [];
  const lines = String(material?.raw_text ?? '').split('\n');
  return readBoundaryEdits(json).filter(record => record?.status === 'pending').map((record, k) => {
    const text = String(record.text || '');
    const parts = [];
    let from = 0;
    for (const cut of Array.isArray(record.cuts) ? record.cuts : []) { parts.push(text.slice(from, cut - record.start)); from = cut - record.start; }
    parts.push(text.slice(from));
    const sentence = Number.isInteger(record.line) ? (lines[record.line] ?? '').trim() || null : null;
    return { id: record.id ?? `pending_${k}`, text, display: parts.filter(Boolean).join(' │ '), merged: !record.cuts?.length, sentence };
  });
}
