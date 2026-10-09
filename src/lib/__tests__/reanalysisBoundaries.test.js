import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// 뷰어 v2 AD-R3 PR② — 재분석 뒤에도 「이 자료」 단어 경계가 유지된다(§3.5 · §4.3 · §8.1 「재분석 뒤 유지」).
// 실제 analyzeText(analyzeHybrid) → fetch → /api/analyze(가짜 모델·사전) → runPreservedReanalysis → RPC 저장 인자로 확인한다.
// 묶기 자체(PR③ 화면)는 PR① 순수 함수(editBoundaries·assignBoundaryPieceIds·replaceBoundaryLine)로 흉내 낸다.
//
// PR① 「PR②에서 정할 것」 1 — 재분석으로 기록 base를 새 분석기 토큰으로 바꿀 때, preserveReanalysisTokens와 같은 규칙
// (같은 줄(이동 반영)·같은 글자 위치·같은 표면)으로 옛 id와 교정값을 잇는다. 그래서 묶기 전에 저장한 단어의 문맥이
// 재분석 뒤에도 「덮는 토큰」(§4.3)으로 돌아가고, 다시 나누면 원래 id로 정확히 돌아간다.

vi.mock('../server/llm.js', async () => ({ callLLM: (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).supabaseModule);
vi.mock('../server/rateLimit.js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).rateLimitModule);
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));

import { POST } from '../../app/api/analyze/route.js';
import { reset, routeFetch } from '../server/__tests__/helpers/boundaryRouteHarness.js';
import { analyzeText } from '../analyzeText';
import { runPreservedReanalysis } from '../reanalysisPreservation';
import { inspectAnalysisCoverage } from '../analysisCoverage';
import { buildEditPlan } from '../sourceEdit';
import { readingSourceTarget } from '../learningSources';
import {
  assignBoundaryPieceIds, boundaryLineEntries, editBoundaries, pendingBoundaryCount, readBoundaryEdits, replaceBoundaryLine,
} from '../boundaryEdits';

const T0 = Date.UTC(2026, 9, 7, 12, 0, 0);
const T1 = T0 + 60_000;
const RAW = {
  Chinese: '运动员的身体素质非常好。\n他是我的社恐朋友。\n\n身体好。',
  Japanese: '明日は申し込んだ映画館に行きます。\n天気予報を見た。',
  English: 'I picked up the book.\nShe looked after them.',
};

let bodies, rpcs, uuid;
const client = (rows = []) => ({
  from: () => {
    const chain = { select: () => chain, eq: () => chain, order: () => chain, range: async () => ({ data: rows, error: null }) };
    return chain;
  },
  rpc: async (name, args) => {
    rpcs.push({ name, args: JSON.parse(JSON.stringify(args)) });
    return { data: { material: { id: args.p_id, raw_text: args.p_raw, processed_json: args.p_json } }, error: null };
  },
});

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
const lineTexts = (json, line) => boundaryLineEntries(json, line).map((e) => e.token.text);
const lineIds = (json, line) => boundaryLineEntries(json, line).map((e) => e.id);

/** PR③ 화면이 할 일을 PR① 순수 함수로 흉내 낸다 — 묶기/나누기 한 번 → processed_json. */
function edit(json, raw, line, request, rev) {
  const language = json.metadata.language;
  const r = editBoundaries(boundaryLineEntries(json, line), readBoundaryEdits(json), { line, ...request },
    { language, lineText: raw.split('\n')[line] });
  expect(r.ok && r.changed).toBe(true);
  const entries = r.restored ? r.tokens : assignBoundaryPieceIds(r.tokens, line, rev);
  return replaceBoundaryLine(json, line, entries, r.edits);
}

async function material(language, raw = RAW[language]) {
  const json = await analyzeText(raw, signal(), { metadata: { language } });
  bodies.splice(0);
  return json;
}

async function reanalyze(mat, options = {}, rows = []) {
  vi.setSystemTime(T1);
  await runPreservedReanalysis(client(rows), mat, signal(), analyzeText, options);
  const [{ args }] = rpcs.splice(0);
  return args.p_json;
}

const sentBoundaries = () => bodies.map(({ body }) => JSON.parse(body).boundaries).filter(Boolean);

describe('중국어 — 묶기 → 재분석 → 유지 · 저장 문맥 돌아가기', () => {
  const raw = RAW.Chinese;
  async function merged() {
    const json0 = await material('Chinese');
    const saved = { locator: { tokenId: lineIds(json0, 0)[2], surface: '身体' }, quote: '运动员的身体素质非常好。' };
    expect(readingSourceTarget(json0, saved)).toBe(`id_0_2_${T0}`);
    const json1 = edit(json0, raw, 0, { start: 4, end: 8, cuts: [] }, 'rev1aaaa');
    expect(lineTexts(json1, 0)).toEqual(['运动员', '的', '身体素质', '非常', '好', '。']);
    expect(readingSourceTarget(json1, saved)).toBe('id_0_e2_rev1aaaa');
    return { json0, json1, saved, mat: { id: 7, raw_text: raw, processed_json: json1 } };
  }

  it('요청에 그 문단의 기록만 문단 안 줄 번호로 싣는다(id·좌표·칼선, base는 보내지 않는다)', async () => {
    const { mat } = await merged();
    await reanalyze(mat, { fullReset: true });
    expect(sentBoundaries()).toEqual([[{ line: 0, start: 4, end: 8, text: '身体素质', cuts: [], id: 'b_0_4_8' }]]);
  });

  it('재분석 뒤 묶음·id·표식이 유지되고 기록은 applied · base는 새 분석기 토큰(옛 id 승계)', async () => {
    const { json1, saved, mat } = await merged();
    const json2 = await reanalyze(mat, { fullReset: true });
    expect(inspectAnalysisCoverage(raw, json2)).toMatchObject({ validStructure: true, missingIndices: [] });
    expect(lineTexts(json2, 0)).toEqual(['运动员', '的', '身体素质', '非常', '好', '。']);
    // preserveReanalysisTokens: 같은 위치·같은 표면 → 묶은 토큰도 옛 id를 잇는다(§3.5-4)
    expect(lineIds(json2, 0)[2]).toBe('id_0_e2_rev1aaaa');
    expect(json2.dictionary.id_0_e2_rev1aaaa).toMatchObject({ text: '身体素质', boundary: 'user', meaning: '身体素质의 뜻' });
    const [record] = readBoundaryEdits(json2);
    const [old] = readBoundaryEdits(json1);
    expect(record).toMatchObject({ id: 'b_0_4_8', line: 0, start: 4, end: 8, text: '身体素质', cuts: [], status: 'applied' });
    expect(record.base.map((e) => e.id)).toEqual(old.base.map((e) => e.id));
    expect(record.base.map((e) => e.token.meaning)).toEqual(['身体의 뜻', '素质의 뜻']);
    // 저장 문맥 돌아가기: 재분석 뒤에도 덮는 토큰으로 간다(회귀 계약)
    expect(readingSourceTarget(json2, saved)).toBe('id_0_e2_rev1aaaa');
    // 다시 나누면 원래 id가 돌아와 ① 규칙으로 정확히 맞는다
    const json3 = edit(json2, raw, 0, { start: 4, end: 8, cuts: [6] }, 'rev2bbbb');
    expect(lineIds(json3, 0)[2]).toBe(`id_0_2_${T0}`);
    expect(readBoundaryEdits(json3)).toEqual([]);
    expect(readingSourceTarget(json3, saved)).toBe(`id_0_2_${T0}`);
  });

  it('base 토큰의 교정값(교정 이력·viewerCorrections)도 preserveReanalysisTokens처럼 잇는다', async () => {
    const { mat } = await merged();
    const oldId = `id_0_2_${T0}`;
    const record = readBoundaryEdits(mat.processed_json)[0];
    record.base[0].token = { ...record.base[0].token, meaning: '몸(교정)' };
    const json2 = await reanalyze(mat, { fullReset: true }, [{ token_id: oldId, after_value: { meaning: '몸(교정)' } }]);
    const [next] = readBoundaryEdits(json2);
    expect(next.base[0]).toMatchObject({ id: oldId, token: { text: '身体', meaning: '몸(교정)' } });
    expect(next.base[1].token.meaning).toBe('素质의 뜻');
  });

  it('원문이 바뀌어 기록 글자가 없으면 pending으로 남긴다 — base·좌표 보존, 토큰은 분석기 그대로, 개수 알림', async () => {
    const { mat, json1 } = await merged();
    const plan = buildEditPlan(raw, raw.replace('身体素质', '身体条件'), json1);
    const json2 = await reanalyze(mat, { selectedLineIndices: plan.selected, rawTextOverride: plan.newText, baseJsonOverride: plan.remapped });
    const [record] = readBoundaryEdits(json2);
    const [old] = readBoundaryEdits(json1);
    expect(record).toEqual({ ...old, status: 'pending' });
    expect(lineTexts(json2, 0)).toEqual(['运动员', '的', '身体', '条件', '非常', '好', '。']);
    expect(lineTexts(json2, 0).length).toBe(7);
    expect(boundaryLineEntries(json2, 0).some((e) => 'boundary' in e.token)).toBe(false);
    expect(pendingBoundaryCount(json2)).toBe(1);
  });

  it('같은 줄 안에서 글자가 옮겨졌으면(줄 수정 1:1) 옮겨 적용하고 base 옛 id를 잇는다', async () => {
    const { mat, json1, saved } = await merged();
    const plan = buildEditPlan(raw, raw.replace('运动员的', '那个运动员的'), json1);
    const json2 = await reanalyze(mat, { selectedLineIndices: plan.selected, rawTextOverride: plan.newText, baseJsonOverride: plan.remapped });
    const [record] = readBoundaryEdits(json2);
    expect(record).toMatchObject({ line: 0, start: 6, end: 10, text: '身体素质', status: 'applied' });
    expect(record.base.map((e) => e.id)).toEqual(readBoundaryEdits(json1)[0].base.map((e) => e.id));
    expect(lineTexts(json2, 0)).toContain('身体素质');
    expect(readingSourceTarget(json2, saved)).toBe(lineIds(json2, 0)[lineTexts(json2, 0).indexOf('身体素质')]);
    expect(pendingBoundaryCount(json2)).toBe(0);
  });

  it('위에 줄을 넣으면 기록 줄 번호와 base id 줄 접두가 함께 옮겨진다(preserveReanalysisTokens의 id 이동과 같다)', async () => {
    const { mat, json1 } = await merged();
    const plan = buildEditPlan(raw, `新的一行。\n${raw}`, json1);
    const json2 = await reanalyze(mat, { selectedLineIndices: plan.selected, rawTextOverride: plan.newText, baseJsonOverride: plan.remapped });
    const [record] = readBoundaryEdits(json2);
    expect(record).toMatchObject({ line: 1, start: 4, end: 8, status: 'applied' });
    expect(record.base.map((e) => e.id)).toEqual([`id_1_2_${T0}`, `id_1_3_${T0}`]);
    expect(lineTexts(json2, 1)).toEqual(['运动员', '的', '身体素质', '非常', '好', '。']);
    expect(lineIds(json2, 1)[2]).toBe('id_1_e2_rev1aaaa');
    expect(inspectAnalysisCoverage(plan.newText, json2)).toMatchObject({ validStructure: true, missingIndices: [] });
  });

  it('기록 줄이 삭제되면 조용히 버리지 않고 pending(줄 없음)으로 남긴다', async () => {
    const { mat, json1 } = await merged();
    const plan = buildEditPlan(raw, raw.split('\n').slice(1).join('\n'), json1);
    const json2 = await reanalyze(mat, { selectedLineIndices: [], rawTextOverride: plan.newText, baseJsonOverride: plan.remapped });
    const [record] = readBoundaryEdits(json2);
    expect(record).toMatchObject({ id: 'b_0_4_8', text: '身体素质', status: 'pending', line: null });
    expect(pendingBoundaryCount(json2)).toBe(1);
  });

  it('선택 줄 재분석: 기록 줄이 선택 밖이면 같은 문단이 다시 분석돼도 기록·토큰을 그대로 둔다', async () => {
    const { mat, json1 } = await merged();
    // 새 분석과 구별되게 옛 base 값을 바꿔 둔다(교정 이력 없음 → 선택 밖이면 그대로 남아야 한다).
    readBoundaryEdits(json1)[0].base[0].token.meaning = '옛 분석 뜻';
    const json2 = await reanalyze(mat, { selectedLineIndices: [1] });
    expect(readBoundaryEdits(json2)[0].base[0].token.meaning).toBe('옛 분석 뜻');
    expect(readBoundaryEdits(json2)).toEqual(readBoundaryEdits(json1));
    expect(boundaryLineEntries(json2, 0)).toEqual(boundaryLineEntries(json1, 0));
  });

  it('나누기(재절단)도 유지된다 — 社|恐을 묶고 运动员을 运动|员으로', async () => {
    const json0 = await material('Chinese');
    const json1 = edit(edit(json0, raw, 1, { start: 4, end: 6, cuts: [] }, 'rev3cccc'), raw, 0, { start: 0, end: 3, cuts: [2] }, 'rev4dddd');
    const json2 = await reanalyze({ id: 7, raw_text: raw, processed_json: json1 }, { fullReset: true });
    expect(lineTexts(json2, 0).slice(0, 3)).toEqual(['运动', '员', '的']);
    expect(lineTexts(json2, 1)).toEqual(['他', '是', '我', '的', '社恐', '朋友', '。']);
    expect(readBoundaryEdits(json2).map((r) => [r.text, r.status])).toEqual([['社恐', 'applied'], ['运动员', 'applied']]);
  });
});

describe('일본어·영어 — 재분석 뒤 유지', () => {
  it('일본어 映画館 나누기', async () => {
    const raw = RAW.Japanese;
    const json1 = edit(await material('Japanese'), raw, 0, { start: 8, end: 11, cuts: [10] }, 'rev5eeee');
    const json2 = await reanalyze({ id: 8, raw_text: raw, processed_json: json1 }, { fullReset: true });
    expect(lineTexts(json2, 0)).toEqual(['明日', 'は', '申し込ん', 'だ', '映画', '館', 'に', '行き', 'ます', '。']);
    expect(readBoundaryEdits(json2)[0]).toMatchObject({ status: 'applied', cuts: [10] });
    expect(readBoundaryEdits(json2)[0].base.map((e) => e.id)).toEqual([`id_0_4_${T0}`]);
  });

  it('영어 picked up 묶기', async () => {
    const raw = RAW.English;
    const json1 = edit(await material('English'), raw, 0, { start: 1, end: 9, cuts: [] }, 'rev6ffff');
    const json2 = await reanalyze({ id: 9, raw_text: raw, processed_json: json1 }, { fullReset: true });
    expect(lineTexts(json2, 0)).toEqual(['I', 'picked up', 'the', 'book', '.']);
    expect(lineIds(json2, 0)[1]).toBe('id_0_e1_rev6ffff');
    expect(readBoundaryEdits(json2)[0]).toMatchObject({ status: 'applied', text: 'pickedup' });
  });
});

describe('한국어 · 알림 배선', () => {
  it('한국어는 요청에 boundaries를 싣지 않고 기록을 건드리지 않는다', async () => {
    const seen = [];
    vi.stubGlobal('fetch', async (url, init) => { seen.push(init.body); return { ok: false, status: 500, json: async () => ({ error: 'x' }) }; });
    const edits = [{ id: 'k', line: 0, start: 0, end: 5, text: '도서관에서', cuts: [3], base: [], status: 'applied' }];
    const json = await analyzeText('도서관에서 공부해요.', signal(), { metadata: { language: 'Korean', viewerBoundaries: { version: 1, edits } } });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((body) => !body.includes('boundaries'))).toBe(true);
    expect(json.metadata.viewerBoundaries.edits).toEqual(edits);
  });

  it('재분석 결과에 적용 못 한 기록이 있으면 개수를 알린다(useReanalyze)', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/lib/useReanalyze.js'), 'utf8');
    expect(src).toContain('pendingBoundaryCount(json)');
    expect(src).toContain('직접 고친 단어 경계');
    expect(pendingBoundaryCount({ metadata: { viewerBoundaries: { version: 1, edits: [{ status: 'pending' }, { status: 'applied' }, { status: 'pending' }] } } })).toBe(2);
    expect(pendingBoundaryCount({ metadata: {} })).toBe(0);
  });
});
