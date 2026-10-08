import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 뷰어 v2 AD-R3 PR③ — 「이 자료」 묶기·나누기·되돌리기의 화면 쪽 흐름(boundaryEditFlow.js).
// 실제 /api/analyze(가짜 모델·사전, PR② 하네스) → commitBoundaryEdit → viewer_replace_analysis 인자 · token_corrections 이력.
// 정본: docs/manabi-viewer-v2-ad-r3.md §4.1 · §4.2 · §4.3 · §6.1 · §9 PR③. PR② 판단 1(원래 id 별칭)도 여기서 고정한다.

vi.mock('../server/llm.js', async () => ({ callLLM: (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).supabaseModule);
vi.mock('../server/rateLimit.js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).rateLimitModule);
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));

import { POST } from '../../app/api/analyze/route.js';
import { reset, routeFetch } from '../server/__tests__/helpers/boundaryRouteHarness.js';
import { analyzeText } from '../analyzeText';
import { runPreservedReanalysis } from '../reanalysisPreservation';
import { buildEditPlan } from '../sourceEdit';
import { readingSourceTarget } from '../learningSources';
import { inspectAnalysisCoverage } from '../analysisCoverage';
import { boundaryLineEntries, readBoundaryEdits } from '../boundaryEdits';
import {
  boundaryEditContext, boundaryEntryAllowed, boundaryReasonHidden, boundaryReasonMessage, boundaryTokenOrigin, boundaryUndoValid,
  commitBoundaryEdit, pendingBoundaryRows, planBoundaryMerge, planBoundarySplit, planNeighborMerge, splitPreview, undoBoundaryEdit,
} from '../boundaryEditFlow';
import { VIEWER_MESSAGES } from '../viewerMessages';

const T0 = Date.UTC(2026, 9, 8, 3, 0, 0);
const RAW = {
  Chinese: '运动员的身体素质非常好。\n他是我的社恐朋友。\n\n身体好。',
  English: 'I picked up the book.\nShe looked after them.',
};
const OWNER = 'u-owner';

let bodies, rpcs, inserts, tables, uuid;
const client = (rows = []) => ({
  from: (table) => {
    tables.push(table);
    const chain = {
      select: () => chain, eq: () => chain, order: () => chain, range: async () => ({ data: rows, error: null }),
      insert: async (row) => { inserts.push({ table, row: JSON.parse(JSON.stringify(row)) }); return { error: null }; },
      update: () => { throw new Error(`direct update on ${table}`); },
    };
    return chain;
  },
  rpc: async (name, args) => {
    rpcs.push({ name, args: JSON.parse(JSON.stringify(args)) });
    return { data: { material: { id: args.p_id, owner_id: OWNER, raw_text: args.p_raw, processed_json: args.p_json } }, error: null };
  },
});
const analyze = async (body) => (await (await fetch('/api/analyze', { method: 'POST', body: JSON.stringify(body) })).json());
const deps = (extra = {}) => ({ client: client(), analyze, userId: OWNER, ...extra });

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ['Date'] });
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  uuid = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`);
  bodies = []; rpcs = []; inserts = []; tables = [];
  vi.stubGlobal('fetch', routeFetch(POST, bodies));
  reset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const signal = () => new AbortController().signal;
const texts = (json, line) => boundaryLineEntries(json, line).map((e) => e.token.text);
const ids = (json, line) => boundaryLineEntries(json, line).map((e) => e.id);
async function material(language = 'Chinese', raw = RAW[language]) {
  const json = await analyzeText(raw, signal(), { metadata: { language } });
  bodies.splice(0);
  return { id: 7, owner_id: OWNER, raw_text: raw, processed_json: json };
}
const ctxOf = (mat, extra = {}) => boundaryEditContext(mat, { userId: OWNER, ...extra });
const seqIndex = (mat, id) => mat.processed_json.sequence.indexOf(id);

describe('진입점 조건 — 소유자 · 중·일·영 · 사본/구간/수업 모드 제외 · 한국어 0', () => {
  it('소유자만, 승인 언어만, 사본·구간·수업 모드에서는 진입점이 없다', async () => {
    const mat = await material();
    expect(boundaryEntryAllowed(ctxOf(mat))).toBe(true);
    expect(boundaryEntryAllowed(boundaryEditContext(mat, { userId: 'someone-else' }))).toBe(false);
    expect(boundaryEntryAllowed(boundaryEditContext(mat, {}))).toBe(false);
    expect(boundaryEntryAllowed(ctxOf(mat, { classMode: true }))).toBe(false);
    expect(boundaryEntryAllowed(ctxOf(mat, { passage: true }))).toBe(false);
    const copy = { ...mat, processed_json: { ...mat.processed_json, metadata: { ...mat.processed_json.metadata, source_ref: 'class-src' } } };
    expect(boundaryEntryAllowed(ctxOf(copy))).toBe(false);
    expect(boundaryEntryAllowed(ctxOf({ ...mat, __local: true }))).toBe(false);
    const korean = { ...mat, processed_json: { ...mat.processed_json, metadata: { language: 'Korean' } } };
    expect(boundaryEntryAllowed(ctxOf(korean))).toBe(false);
    expect(planBoundaryMerge(korean, 0, 1, ctxOf(korean))).toEqual({ ok: false, reason: 'korean' });
    expect(planBoundarySplit(korean, ids(mat.processed_json, 0)[0], ctxOf(korean))).toEqual({ ok: false, reason: 'korean' });
    for (const reason of ['korean', 'not_owner', 'class_copy', 'passage', 'class_mode']) expect(boundaryReasonHidden(reason)).toBe(true);
  });

  it('이유 문구는 세 언어 모두 있다(문장부호·줄·대기 기록 등)', () => {
    for (const reason of ['cross_line', 'punctuation', 'failed', 'separable', 'too_few', 'too_many', 'too_long', 'edit_limit',
      'single_word', 'too_short', 'no_neighbor', 'pending_edit', 'stale_edits', 'whatever']) {
      const [key] = boundaryReasonMessage(reason);
      for (const locale of ['ko', 'zh-CN', 'zh-TW']) expect(Object.hasOwn(VIEWER_MESSAGES[locale], key), `${locale}: ${key}`).toBe(true);
    }
    expect(boundaryReasonMessage('punctuation')[0]).toBe('문장부호를 넘어서는 묶을 수 없어요');
  });

  it('드래그 묶기 미리 보기: 身体 + 素质 → 身体素质 · 문장부호를 넘으면 이유', async () => {
    const mat = await material();
    const [, , a, b, , , stop] = ids(mat.processed_json, 0);
    const plan = planBoundaryMerge(mat, seqIndex(mat, a), seqIndex(mat, b), ctxOf(mat));
    expect(plan).toMatchObject({ ok: true, parts: ['身体', '素质'], result: '身体素质', request: { line: 0, start: 4, end: 8, cuts: [] } });
    expect(planBoundaryMerge(mat, seqIndex(mat, b), seqIndex(mat, stop), ctxOf(mat))).toEqual({ ok: false, reason: 'punctuation' });
    const near = planNeighborMerge(mat, a, ctxOf(mat));
    expect(near.next).toMatchObject({ ok: true, result: '身体素质' });
    expect(near.prev).toMatchObject({ ok: true, result: '的身体' });
    expect(planNeighborMerge(mat, ids(mat.processed_json, 0)[0], ctxOf(mat)).prev).toEqual({ ok: false, reason: 'no_neighbor' });
  });
});

describe('묶기 → 저장(원자 RPC) · 이력 · 보존', () => {
  it('묶기 한 번: 그 줄만 서버에 boundaries로 보내고, viewer_replace_analysis(원문 그대로) + token_corrections 1행만 쓴다', async () => {
    const mat = await material();
    const before = structuredClone(mat.processed_json);
    const plan = planBoundaryMerge(mat, seqIndex(mat, ids(before, 0)[2]), seqIndex(mat, ids(before, 0)[3]), ctxOf(mat));
    const out = await commitBoundaryEdit(mat, plan.request, deps());
    expect(bodies.map(({ body }) => JSON.parse(body))).toEqual([{ lines: ['运动员的身体素质非常好。'], language: 'Chinese',
      boundaries: [{ line: 0, start: 4, end: 8, text: '身体素质', cuts: [], id: 'b_0_4_8' }] }]);
    expect(rpcs).toHaveLength(1);
    const { name, args } = rpcs[0];
    expect(name).toBe('viewer_replace_analysis');
    expect(args.p_raw).toBe(mat.raw_text);
    expect(args.p_expected_raw).toBe(mat.raw_text);
    expect(args.p_expected_json).toEqual(before);
    expect(args.p_json.metadata.viewerRevision).toBe(args.p_attempt);
    const json = args.p_json;
    expect(texts(json, 0)).toEqual(['运动员', '的', '身体素质', '非常', '好', '。']);
    expect(json.dictionary[out.selectId]).toMatchObject({ text: '身体素质', boundary: 'user', meaning: '身体素质의 뜻' });
    expect(out.selectId).toMatch(/^id_0_e2_/);
    // 바뀐 구간 밖 토큰은 기존 객체·id 그대로(§4.1-3), 다른 줄도 그대로
    for (const k of [0, 1, 3, 4, 5]) expect(json.dictionary[ids(json, 0)[k]]).toEqual(before.dictionary[ids(json, 0)[k]]);
    expect(boundaryLineEntries(json, 1)).toEqual(boundaryLineEntries(before, 1));
    const [record] = readBoundaryEdits(json);
    expect(record).toMatchObject({ id: 'b_0_4_8', line: 0, start: 4, end: 8, text: '身体素质', cuts: [], status: 'applied' });
    expect(record.base.map((e) => e.id)).toEqual([ids(before, 0)[2], ids(before, 0)[3]]);
    expect(inspectAnalysisCoverage(mat.raw_text, json)).toMatchObject({ validStructure: true, missingIndices: [] });
    // 이력: token_corrections insert 1행만 — 재분석 보존기가 읽는 뜻 키(meaning·furigana·reading·pos)는 after_value에 없다
    expect(tables).toEqual(['token_corrections']);
    expect(inserts).toEqual([{ table: 'token_corrections', row: { material_id: 7, token_id: ids(before, 0)[2], user_id: OWNER,
      before_value: { boundary: { line: 0, start: 4, end: 8, text: '身体素质', cuts: [6] } },
      after_value: { source: 'boundary_edit', id: 'b_0_4_8', cuts: [], scope: 'material' } } }]);
    expect(out.kind).toBe('merge');
    expect(boundaryTokenOrigin(json, out.selectId)).toBe('merged');
    expect(boundaryTokenOrigin(json, ids(json, 0)[0])).toBe(null);
  });

  it('나누기(원래 칼선) = base 복원: 서버 호출 0, 원래 토큰 객체·id가 돌아오고 기록 0', async () => {
    const mat0 = await material();
    const before = structuredClone(mat0.processed_json);
    const merged = await commitBoundaryEdit(mat0, { line: 0, start: 4, end: 8, cuts: [] }, deps());
    bodies.splice(0); rpcs.splice(0); inserts.splice(0);
    const mat1 = merged.material;
    const plan = planBoundarySplit(mat1, merged.selectId, ctxOf(mat1));
    expect(plan).toMatchObject({ ok: true, chars: ['身', '体', '素', '质'], cuts: [5, 6, 7] });
    expect(splitPreview(plan, [6])).toEqual(['身体', '素质']);
    const out = await commitBoundaryEdit(mat1, { line: 0, start: plan.start, end: plan.end, cuts: [6] }, deps());
    expect(bodies).toEqual([]);
    expect(out.restored).toBe(true);
    const json = rpcs[0].args.p_json;
    expect(ids(json, 0)).toEqual(ids(before, 0));
    expect(boundaryLineEntries(json, 0)).toEqual(boundaryLineEntries(before, 0));
    expect(json.metadata.viewerBoundaries).toBeUndefined();
    expect(out.selectId).toBe(ids(before, 0)[2]);
    expect(inserts[0].row.after_value).toEqual({ source: 'boundary_edit', id: 'b_0_4_8', cuts: [6], scope: 'material', restored: true });
  });

  it('되돌리기 = 편집 전 토큰·기록을 그대로(서버 호출 0) · 다른 편집 뒤에는 무효', async () => {
    const mat0 = await material();
    const before = structuredClone(mat0.processed_json);
    const merged = await commitBoundaryEdit(mat0, { line: 0, start: 4, end: 8, cuts: [] }, deps());
    bodies.splice(0); rpcs.splice(0); inserts.splice(0);
    expect(boundaryUndoValid(merged.material.processed_json, merged.undo)).toBe(true);
    const out = await undoBoundaryEdit(merged.material, merged.undo, deps());
    expect(bodies).toEqual([]);
    const json = rpcs[0].args.p_json;
    expect(boundaryLineEntries(json, 0)).toEqual(boundaryLineEntries(before, 0));
    expect(readBoundaryEdits(json)).toEqual([]);
    expect(rpcs[0].args.p_raw).toBe(mat0.raw_text);
    expect(out.selectId).toBe(ids(before, 0)[2]);
    expect(inserts[0].row.after_value).toMatchObject({ source: 'boundary_edit', undo: true, cuts: [6] });
    expect(boundaryUndoValid(out.material.processed_json, merged.undo)).toBe(false);
  });

  it('대기(pending) 기록과 겹치는 편집은 거부한다(pending_edit) — 화면은 이유 한 줄', async () => {
    const mat0 = await material();
    const merged = await commitBoundaryEdit(mat0, { line: 0, start: 4, end: 8, cuts: [] }, deps());
    const json = structuredClone(merged.material.processed_json);
    json.metadata.viewerBoundaries.edits[0].status = 'pending';
    const mat = { ...merged.material, processed_json: json };
    const merge = planBoundaryMerge(mat, seqIndex(mat, ids(json, 0)[1]), seqIndex(mat, ids(json, 0)[2]), ctxOf(mat));
    expect(merge).toEqual({ ok: false, reason: 'pending_edit' });
    expect(planBoundarySplit(mat, ids(json, 0)[2], ctxOf(mat))).toEqual({ ok: false, reason: 'pending_edit' });
    await expect(commitBoundaryEdit(mat, { line: 0, start: 3, end: 8, cuts: [] }, deps())).rejects.toMatchObject({ reason: 'pending_edit' });
    expect(pendingBoundaryRows(mat)).toEqual([{ id: 'b_0_4_8', text: '身体素质', display: '身体素质', merged: true, sentence: '运动员的身体素质非常好。' }]);
  });

  it('영어 picked up 묶기 — 공백 든 토큰, 나누기는 단어 사이만', async () => {
    const mat0 = await material('English');
    const plan = planBoundaryMerge(mat0, 1, 2, ctxOf(mat0));
    expect(plan).toMatchObject({ ok: true, parts: ['picked', 'up'], result: 'picked up' });
    const out = await commitBoundaryEdit(mat0, plan.request, deps());
    const json = out.material.processed_json;
    expect(texts(json, 0)).toEqual(['I', 'picked up', 'the', 'book', '.']);
    const split = planBoundarySplit(out.material, out.selectId, ctxOf(out.material));
    expect(split).toMatchObject({ ok: true, chars: ['picked', 'up'], cuts: [7] });
    expect(splitPreview(split, [7])).toEqual(['picked', 'up']);
  });
});

describe('PR② 판단 1 — 원래 id 별칭: 저장 → 묶기 → 원문 위 줄 추가 재분석 → 출처 열기 = 묶은 토큰', () => {
  it('base 원래 id가 별칭으로 남아 옛 저장 문맥이 묶인 자리로 돌아간다', async () => {
    const mat0 = await material();
    const raw = mat0.raw_text;
    const saved = { locator: { tokenId: ids(mat0.processed_json, 0)[2], surface: '身体' }, quote: '运动员的身体素质非常好。' };
    expect(readingSourceTarget(mat0.processed_json, saved)).toBe(ids(mat0.processed_json, 0)[2]);
    const merged = await commitBoundaryEdit(mat0, { line: 0, start: 4, end: 8, cuts: [] }, deps());
    expect(readingSourceTarget(merged.material.processed_json, saved)).toBe(merged.selectId);
    rpcs.splice(0);
    const mat1 = merged.material;
    const plan = buildEditPlan(raw, `新的一行。\n${raw}`, mat1.processed_json);
    await runPreservedReanalysis(client(), mat1, signal(), analyzeText,
      { selectedLineIndices: plan.selected, rawTextOverride: plan.newText, baseJsonOverride: plan.remapped });
    const json2 = rpcs.at(-1).args.p_json;
    const at = texts(json2, 1).indexOf('身体素质');
    expect(at).toBe(2);
    expect(readingSourceTarget(json2, saved)).toBe(ids(json2, 1)[at]);
    const [record] = readBoundaryEdits(json2);
    expect(record.base[0]).toMatchObject({ id: ids(mat0.processed_json, 0)[2].replace(/^id_0_/, 'id_1_'), was: [ids(mat0.processed_json, 0)[2]] });
  });
});
