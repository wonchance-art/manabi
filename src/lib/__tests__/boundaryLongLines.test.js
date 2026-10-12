import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

// BOUNDARY-LONG-LINE-001 — 200자 넘는 줄의 200자 뒤에서 단어 경계 편집(묶기·나누기)이 analysis_mismatch로 막히던 문제 회귀 계약.
// 전: commitBoundaryEdit가 줄 전체를 한 요청 줄로 보냈고, /api/analyze는 줄을 200자에서 잘라(truncated) 기록이
// 구간 밖 pending으로 돌아왔다(데이터 유실은 없지만 편집 불가 — ANALYZE-LONG-LINE-001 #1412의 남은 문제).
// 후: 자료 분석과 같은 조각(analyzeText.analysisLineUnits — splitAnalysisLine · 칼선은 기록 구간 밖)으로 줄을 나누고,
// 새 기록이 든 조각 하나만 조각 좌표로 보낸 뒤 줄 좌표로 되돌려 맞춘다. 캡 안 줄의 요청은 그대로(boundaryEditFlow.test.js).
// 실제 analyzeText → /api/analyze(가짜 모델·사전, 토크나이저 실물) → commitBoundaryEdit → viewer_replace_analysis 인자로 확인한다.

vi.mock('../server/llm.js', async () => ({ callLLM: (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).supabaseModule);
vi.mock('../server/rateLimit.js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).rateLimitModule);
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));

import { POST } from '../../app/api/analyze/route.js';
import { reset, routeFetch } from '../server/__tests__/helpers/boundaryRouteHarness.js';
import { ANALYZE_MAX_LINE_LEN, analyzeText } from '../analyzeText';
import { runPreservedReanalysis } from '../reanalysisPreservation';
import { inspectAnalysisCoverage } from '../analysisCoverage';
import { boundaryLineEntries, boundarySpans, compactBoundaryText, readBoundaryEdits } from '../boundaryEdits';
import { boundaryEditContext, boundaryTokenOrigin, commitBoundaryEdit, planBoundaryMerge, planBoundarySplit } from '../boundaryEditFlow';

const T0 = Date.UTC(2026, 9, 12, 3, 0, 0);
const T1 = T0 + 60_000;
const OWNER = 'u-owner';

// 영어 350자 한 줄(문장 4개) · 중국어 300자 한 줄(12자 문장 25개).
const EN_350 = 'The old library stood at the end of the street, and every morning the children walked past it on their way to school. '
  + 'Nobody remembered when it had been built, but everyone agreed that it was the most lovely building in the town. '
  + 'One wet afternoon, a girl named Lucy picked up a letter and looked after the sleeping cat by the door. '
  + 'She smiled at me.';
const ZH_300 = '运动员的身体素质非常好。'.repeat(25);

let bodies, rpcs, uuid;
const client = () => ({
  from: () => {
    const chain = {
      select: () => chain, eq: () => chain, order: () => chain, range: async () => ({ data: [], error: null }),
      insert: async () => ({ error: null }),
    };
    return chain;
  },
  rpc: async (name, args) => {
    rpcs.push({ name, args: JSON.parse(JSON.stringify(args)) });
    return { data: { material: { id: args.p_id, owner_id: OWNER, raw_text: args.p_raw, processed_json: args.p_json } }, error: null };
  },
});
const analyze = async (body) => (await (await fetch('/api/analyze', { method: 'POST', body: JSON.stringify(body) })).json());
const deps = () => ({ client: client(), analyze, userId: OWNER });

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ['Date'] });
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  uuid = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`);
  bodies = [];
  rpcs = [];
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
const sent = () => bodies.map(({ body }) => JSON.parse(body));
const ctxOf = (mat) => boundaryEditContext(mat, { userId: OWNER });

async function material(language, raw) {
  const json = await analyzeText(raw, signal(), { metadata: { language } });
  expect(json.failed_indices).toEqual([]);
  bodies.splice(0);
  return { id: 9, owner_id: OWNER, raw_text: raw, processed_json: json };
}
/** 줄 0에서 compact 좌표 from 이후 처음 나오는 연속 토큰 texts의 시퀀스 인덱스 [첫, 끝]과 그 줄 좌표. */
function findRun(mat, words, from) {
  const entries = boundaryLineEntries(mat.processed_json, 0);
  const spans = boundarySpans(entries);
  const k = spans.findIndex((span, i) => span.start >= from && words.every((w, j) => spans[i + j]?.entry.token.text === w));
  expect(k).toBeGreaterThanOrEqual(0);
  const seq = mat.processed_json.sequence;
  return { first: seq.indexOf(spans[k].entry.id), last: seq.indexOf(spans[k + words.length - 1].entry.id),
    start: spans[k].start, end: spans[k + words.length - 1].end, ids: spans.slice(k, k + words.length).map((s) => s.entry.id) };
}
/** 저장된 줄이 온전한가 — 줄 전체를 덮고, 구조가 유효하고, 바뀐 구간 밖 토큰은 객체·id 그대로. */
function expectIntact(raw, before, json, { start, end }) {
  expect(inspectAnalysisCoverage(raw, json)).toMatchObject({ validStructure: true, missingIndices: [] });
  expect(compactBoundaryText(texts(json, 0).join(''))).toBe(compactBoundaryText(raw.split('\n')[0]));
  const outside = (j) => boundarySpans(boundaryLineEntries(j, 0)).filter((s) => s.end <= start || s.start >= end).map((s) => s.entry);
  expect(outside(json)).toEqual(outside(before));
  expect(boundaryLineEntries(json, 1)).toEqual(boundaryLineEntries(before, 1));
  expect(new Set(json.sequence).size).toBe(json.sequence.length);
  for (const id of json.sequence) expect(json.dictionary[id]).toBeTruthy();
}

describe('200자 넘는 줄 — 200자 뒤 묶기·나누기가 적용된다', () => {
  it('영어 350자 줄: 200자 뒤 looked + after 묶기 — 기록이 든 조각만 조각 좌표로 보내고 줄 좌표로 저장한다', async () => {
    expect(EN_350.length).toBe(350);
    const raw = `${EN_350}\nShe looked after them.`;
    const mat = await material('English', raw);
    const before = structuredClone(mat.processed_json);
    const run = findRun(mat, ['looked', 'after'], 200);
    const plan = planBoundaryMerge(mat, run.first, run.last, ctxOf(mat));
    expect(plan).toMatchObject({ ok: true, result: 'looked after', request: { line: 0, start: run.start, end: run.end, cuts: [] } });
    const out = await commitBoundaryEdit(mat, plan.request, deps());

    const [body] = sent();
    expect(bodies).toHaveLength(1);
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].length).toBeLessThanOrEqual(ANALYZE_MAX_LINE_LEN);
    const at = EN_350.indexOf(body.lines[0]);
    expect(at).toBeGreaterThan(0);
    const offset = compactBoundaryText(EN_350.substring(0, at)).length;
    expect(offset).toBeGreaterThan(0);
    expect(body.boundaries).toEqual([{ line: 0, start: run.start - offset, end: run.end - offset, text: 'lookedafter', cuts: [],
      id: `b_0_${run.start}_${run.end}` }]);

    const json = rpcs[0].args.p_json;
    expect(texts(json, 0)).toContain('looked after');
    expect(json.dictionary[out.selectId]).toMatchObject({ text: 'looked after', boundary: 'user' });
    expect(out.selectId).toMatch(/^id_0_e\d+_/);
    expect(out.kind).toBe('merge');
    expect(boundaryTokenOrigin(json, out.selectId)).toBe('merged');
    expectIntact(raw, before, json, run);
    const [record] = readBoundaryEdits(json);
    expect(record).toMatchObject({ line: 0, start: run.start, end: run.end, text: 'lookedafter', cuts: [], status: 'applied' });
    expect(record.base.map((e) => e.id)).toEqual(run.ids);

    // 같은 줄을 기록과 함께 처음부터 다시 분석해도 같은 토큰 구조 — 경계 편집과 자료 분석의 조각이 갈리지 않는다.
    bodies.splice(0); rpcs.splice(0);
    vi.setSystemTime(T1);
    await runPreservedReanalysis(client(), out.material, signal(), analyzeText, { fullReset: true });
    const json2 = rpcs.at(-1).args.p_json;
    expect(json2.failed_indices).toEqual([]);
    expect(texts(json2, 0)).toEqual(texts(json, 0));
    expect(readBoundaryEdits(json2)[0]).toMatchObject({ status: 'applied', start: run.start, end: run.end });
  });

  it('중국어 300자 줄: 200자 뒤 身体 + 素质 묶기, 그 뒤 运动员 나누기(运动│员 — 새 조각은 서버에서)', async () => {
    expect(ZH_300.length).toBe(300);
    const raw = `${ZH_300}\n他是我的朋友。`;
    const mat = await material('Chinese', raw);
    const before = structuredClone(mat.processed_json);
    const run = findRun(mat, ['身体', '素质'], 200);
    expect(run.start).toBe(208); // 18번째 문장(204자부터)의 身体素质
    const plan = planBoundaryMerge(mat, run.first, run.last, ctxOf(mat));
    expect(plan).toMatchObject({ ok: true, result: '身体素质' });
    const merged = await commitBoundaryEdit(mat, plan.request, deps());
    // 칼선은 200자 앞 마지막 문장 끝(192) — 기록은 둘째 조각에 조각 좌표(208 - 192 = 16)로 실린다.
    expect(sent()).toEqual([{ lines: [ZH_300.slice(192)], language: 'Chinese',
      boundaries: [{ line: 0, start: 16, end: 20, text: '身体素质', cuts: [], id: 'b_0_208_212' }] }]);
    const json = rpcs[0].args.p_json;
    expect(json.dictionary[merged.selectId]).toMatchObject({ text: '身体素质', boundary: 'user', meaning: '身体素质의 뜻' });
    expectIntact(raw, before, json, run);

    // 나누기: 200자 뒤(19번째 문장, 216자부터) 运动员 → 运动│员. 원래 칼선이 아니므로 서버가 조각을 만든다.
    bodies.splice(0); rpcs.splice(0);
    const mat1 = merged.material;
    const target = findRun(mat1, ['运动员'], 210);
    expect(target.start).toBe(216);
    const split = planBoundarySplit(mat1, target.ids[0], ctxOf(mat1));
    expect(split).toMatchObject({ ok: true, chars: ['运', '动', '员'], cuts: [217, 218] });
    const out = await commitBoundaryEdit(mat1, { line: 0, start: split.start, end: split.end, cuts: [218] }, deps());
    expect(sent()[0].lines).toEqual([ZH_300.slice(192)]);
    expect(sent()[0].boundaries).toEqual([{ line: 0, start: 24, end: 27, text: '运动员', cuts: [26], id: 'b_0_216_219' }]);
    const json2 = rpcs[0].args.p_json;
    expect(out.kind).toBe('split');
    expect(json2.dictionary[out.selectId]).toMatchObject({ text: '运动', boundary: 'user' });
    const after = boundarySpans(boundaryLineEntries(json2, 0)).filter((s) => s.start >= 216 && s.end <= 219).map((s) => s.entry.token.text);
    expect(after).toEqual(['运动', '员']);
    expectIntact(raw, json, json2, { start: 216, end: 219 });
    expect(readBoundaryEdits(json2).map((r) => [r.start, r.end, r.cuts, r.status])).toEqual([[208, 212, [], 'applied'], [216, 219, [218], 'applied']]);
  });

  it('영어 나누기: 200자 뒤 picked up a 묶은 뒤 picked │ up a 로 나누기 — 새 조각(up a)은 서버에서', async () => {
    const raw = EN_350;
    const mat = await material('English', raw);
    const run = findRun(mat, ['picked', 'up', 'a'], 200);
    const merged = await commitBoundaryEdit(mat, { line: 0, start: run.start, end: run.end, cuts: [] }, deps());
    const mat1 = merged.material;
    expect(mat1.processed_json.dictionary[merged.selectId].text).toBe('picked up a');
    bodies.splice(0); rpcs.splice(0);
    const split = planBoundarySplit(mat1, merged.selectId, ctxOf(mat1));
    expect(split).toMatchObject({ ok: true, chars: ['picked', 'up', 'a'], cuts: [run.start + 6, run.start + 8] });
    const out = await commitBoundaryEdit(mat1, { line: 0, start: split.start, end: split.end, cuts: [run.start + 6] }, deps());
    expect(bodies).toHaveLength(1);
    expect(sent()[0].lines[0].length).toBeLessThanOrEqual(ANALYZE_MAX_LINE_LEN);
    const json = rpcs[0].args.p_json;
    const pieces = boundarySpans(boundaryLineEntries(json, 0)).filter((s) => s.start >= run.start && s.end <= run.end).map((s) => s.entry.token.text);
    expect(pieces).toEqual(['picked', 'up a']);
    expect(out.kind).toBe('split');
    expectIntact(raw, mat1.processed_json, json, run);
  });
});

describe('조각 칼선에 걸친 편집 — 기록을 자르지 않고 칼선이 물러난다', () => {
  it('영어: 칼선 자리(picked│up, 200번째)에 걸친 picked up 묶기 — 보낸 조각이 picked up으로 시작한다', async () => {
    // 문장 끝이 없는 긴 한 문장: 캡(200) 앞 마지막 공백이 picked|up 사이(200번째)다.
    const head = 'the children walked along the river '.repeat(5) + 'and then they ';
    expect(head.length).toBe(194);
    const line = `${head}picked up the book and read it together under the old tree near the bridge while the sun went down over the quiet hills and the birds sang far away`;
    expect(line.length).toBeGreaterThan(300);
    const raw = `${line}\nShe smiled.`;
    const json0 = await analyzeText(raw, signal(), { metadata: { language: 'English' } });
    expect(JSON.parse(bodies[0].body).lines[0].endsWith('picked')).toBe(true); // 기록 전에는 그 공백에서 잘렸다
    bodies.splice(0);
    const mat = { id: 5, owner_id: OWNER, raw_text: raw, processed_json: json0 };
    const run = findRun(mat, ['picked', 'up'], 0);
    const start = compactBoundaryText(head).length;
    expect(run.start).toBe(start);
    const out = await commitBoundaryEdit(mat, { line: 0, start, end: start + 8, cuts: [] }, deps());
    const [body] = sent();
    expect(body.lines[0].startsWith('picked up')).toBe(true); // 칼선이 기록 구간 앞(193)으로 물러났다
    expect(body.lines[0].length).toBeLessThanOrEqual(ANALYZE_MAX_LINE_LEN);
    expect(body.boundaries).toEqual([{ line: 0, start: 0, end: 8, text: 'pickedup', cuts: [], id: `b_0_${start}_${start + 8}` }]);
    const json = rpcs[0].args.p_json;
    expect(json.dictionary[out.selectId]).toMatchObject({ text: 'picked up', boundary: 'user' });
    expectIntact(raw, json0, json, run);
  });

  it('중국어: 문장부호 없는 긴 줄 — 캡 자리(200)에 걸친 묶기는 칼선을 기록 앞(198)으로 옮긴다', async () => {
    const line = '我们'.repeat(99) + '朋友' + '我们'.repeat(30); // 198자 뒤 朋友(198~200)… 캡 자리 200 = 朋友 바로 뒤
    const raw = `${line}\n他是我的朋友。`;
    const mat = await material('Chinese', raw);
    const before = structuredClone(mat.processed_json);
    const run = findRun(mat, ['朋友', '我们'], 190);
    expect(run.start).toBe(198);
    const out = await commitBoundaryEdit(mat, { line: 0, start: run.start, end: run.end, cuts: [] }, deps());
    const [body] = sent();
    expect(body.lines[0].length).toBeLessThanOrEqual(ANALYZE_MAX_LINE_LEN);
    const offset = line.indexOf(body.lines[0], 1);
    expect(offset).toBeLessThanOrEqual(198); // 칼선이 기록(198~202) 안(200)이 아니라 그 앞
    expect(body.boundaries).toEqual([{ line: 0, start: 198 - offset, end: 202 - offset, text: '朋友我们', cuts: [], id: 'b_0_198_202' }]);
    const json = rpcs[0].args.p_json;
    expect(json.dictionary[out.selectId]).toMatchObject({ text: '朋友我们', boundary: 'user' });
    expectIntact(raw, before, json, run);
  });
});

describe('배선 — 화면의 경계 편집 요청도 429는 Retry-After만큼 기다려 다시 보낸다', () => {
  it('ViewerPage analyzeBoundaryLine은 analyzeText.fetchWithRateLimitRetry로 /api/analyze를 부른다', () => {
    const viewer = readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    const fn = sliceBetween(viewer, 'const analyzeBoundaryLine', 'const boundaryMutation');
    expect(fn).toContain("fetchWithRateLimitRetry('/api/analyze'");
    expect(fn).not.toMatch(/\bfetch\('\/api\/analyze'/);
  });
});
