import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// 200자 넘는 중·일·영 줄이 분석에서 잘리던 문제(데이터 유실) 회귀 계약.
// 전: /api/analyze가 줄을 200자로 조용히 잘랐고, 클라이언트는 한국어만 긴 줄을 나눴다 — EPUB 문단·자막 8줄 합치기·PDF 쪽
// 합치기·붙여 넣은 기사의 200자 뒤 토큰이 사라진 채 자료가 completed · failed_indices=[]로 저장됐다. 뷰어는 그 줄 앞 200자만
// 그렸고, 복구 버튼은 같은 줄을 다시 보내 영원히 실패했다(「새 분석을 완료하지 못했어요」).
// 후: analyzeText가 캡을 넘는 줄을 문장 단위 조각으로 나눠 보내고 원래 줄로 잇는다. 서버는 자르면 truncated 표식을 달고,
// 클라이언트는 표식·덮지 못한 줄을 실패(복구 가능)로 남긴다.
// 실제 analyzeText(analyzeHybrid) → fetch → /api/analyze(가짜 모델·사전, 토크나이저 실물) → runPreservedReanalysis로 확인한다.

vi.mock('../server/llm.js', async () => ({ callLLM: (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).supabaseModule);
vi.mock('../server/rateLimit.js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).rateLimitModule);
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));

import { POST } from '../../app/api/analyze/route.js';
import { reset, routeFetch, runRoute } from '../server/__tests__/helpers/boundaryRouteHarness.js';
import { ANALYZE_MAX_LINE_LEN, ANALYZE_MAX_LINES, analyzeText, splitAnalysisLine } from '../analyzeText';
import { runPreservedReanalysis } from '../reanalysisPreservation';
import { inspectAnalysisCoverage } from '../analysisCoverage';
import { tokenizeEnLine } from '../server/tokenizeEn';
import {
  assignBoundaryPieceIds, boundaryLineEntries, compactBoundaryText, editBoundaries, readBoundaryEdits, replaceBoundaryLine,
} from '../boundaryEdits';

const read = (rel) => readFileSync(path.join(process.cwd(), rel), 'utf8');

const T0 = Date.UTC(2026, 9, 12, 3, 0, 0);
const T1 = T0 + 60_000;

// 재현 사례 — 영어 442자 한 줄(문장 5개) · 일본어 272자 한 줄(문장 7개).
const EN_442 = 'The old library stood at the end of the street, and every morning the children walked past it on their way to school. '
  + 'Nobody remembered when it had been built, but everyone agreed that it was the most lovely building in the town. '
  + 'One wet afternoon, a girl named Lucy pushed open the heavy door and stepped inside. '
  + 'She found rows of dusty shelves, a sleeping cat, and a letter addressed to her. It said: come back tomorrow, and bring a friend.';
const JA_272 = '駅前の小さな喫茶店は、毎朝七時に開いて、近所の人たちが新聞を読みながらコーヒーを飲む場所になっている。'
  + '店主の田中さんは三十年前からこの店を続けていて、常連の顔と好みをすべて覚えているそうだ。'
  + '雨の日には窓際の席が人気で、外を歩く人を眺めながら静かに本を読む学生も多い。'
  + '最近は若い観光客も増えてきたので、田中さんは英語のメニューを作ることにした。'
  + 'けれども、昔ながらの味と雰囲気だけは、これからも変えないつもりだという。'
  + '週末になると、店の前には開店前から小さな列ができ、田中さんは一人ひとりに笑顔で挨拶をする。'
  + 'それが、この町の朝のいつもの風景なのだ。';

let bodies, rpcs, uuid;
const client = () => ({
  from: () => {
    const chain = { select: () => chain, eq: () => chain, order: () => chain, range: async () => ({ data: [], error: null }) };
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
const lineEntries = (json, line) => boundaryLineEntries(json, line);
const lineTexts = (json, line) => lineEntries(json, line).map((e) => e.token.text);
const sentLines = () => bodies.flatMap(({ body }) => JSON.parse(body).lines);

/** 줄 토큰 id가 보통 분석한 줄과 같은 모양인가 — id_<줄>_<0..n-1>_<시각> 연속, 줄 끝 개행 하나. */
function expectLineShape(json, line, { last = false } = {}) {
  const ids = json.sequence.filter((id) => new RegExp(`^(id|br|failed)_${line}_`).test(id));
  const tokens = ids.filter((id) => id.startsWith('id_'));
  expect(tokens).toEqual(tokens.map((_, k) => `id_${line}_${k}_${T0}`));
  expect(ids.slice(tokens.length)).toEqual(last ? [] : [`br_${line}_${T0}`]);
}

describe('서버 — 줄을 조용히 자르지 않는다(계약)', () => {
  it('클라이언트 캡 미러가 route.js의 MAX_LINES·MAX_LINE_LEN과 같다', () => {
    const route = read('src/app/api/analyze/route.js');
    expect(Number(route.match(/const MAX_LINES = (\d+);/)?.[1])).toBe(ANALYZE_MAX_LINES);
    expect(Number(route.match(/const MAX_LINE_LEN = (\d+);/)?.[1])).toBe(ANALYZE_MAX_LINE_LEN);
  });

  it('캡을 넘은 줄은 결과에 truncated 표식이 붙고, 캡 안 줄은 키조차 없다(응답 바이트 동일)', async () => {
    const long = EN_442.slice(0, 250);
    const exact = EN_442.slice(0, ANALYZE_MAX_LINE_LEN);
    const { status, body } = await runRoute(POST, { lines: [long, exact, 'Short line.'], language: 'English' });
    expect(status).toBe(200);
    expect(body.results[0].truncated).toBe(true);
    expect('truncated' in body.results[1]).toBe(false);
    expect('truncated' in body.results[2]).toBe(false);
  });

  it('줄을 자르는 자리는 truncated 표식과 함께만 있다(정적 계약)', () => {
    const route = read('src/app/api/analyze/route.js');
    const slices = [...route.matchAll(/\.slice\(0, MAX_LINE_LEN\)/g)];
    expect(slices).toHaveLength(1);
    expect(route).toMatch(/if \(line\.length > MAX_LINE_LEN\) truncatedLines\.add\(i\);/);
    expect(route).toMatch(/truncatedLines\.has\(lineIdx\) \? \{ \.\.\.lineResult, truncated: true \}/);
  });
});

describe('splitAnalysisLine — 문장 단위 조각(정본 splitSentenceRanges 재사용)', () => {
  const pieces = (line, opts) => splitAnalysisLine(line, opts).map(({ start, end }) => line.slice(start, end));

  it('캡 안 줄은 한 조각 그대로', () => {
    expect(splitAnalysisLine('A short line.', { language: 'English' })).toEqual([{ start: 0, end: 13 }]);
  });

  it('영어 442자 — 문장 끝에서 캡 안으로 묶고, 공백 말고는 한 글자도 빠지지 않는다', () => {
    const out = pieces(EN_442, { language: 'English' });
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((p) => p.length <= ANALYZE_MAX_LINE_LEN)).toBe(true);
    expect(out.every((p) => /[.!?;:]$/.test(p) || p === out.at(-1))).toBe(true);
    expect(out.join(' ')).toBe(EN_442);
  });

  it('일본어 272자 — 。에서 자른다', () => {
    const out = pieces(JA_272, { language: 'Japanese' });
    expect(out.every((p) => p.length <= ANALYZE_MAX_LINE_LEN && p.endsWith('。'))).toBe(true);
    expect(out.join('')).toBe(JA_272);
  });

  it('문장 끝이 없는 긴 문장 — 영어는 캡 앞 마지막 공백, 중·일은 、，, 뒤, 아무것도 없으면 캡 자리', () => {
    const en = 'word '.repeat(60).trim();
    expect(pieces(en, { language: 'English' }).every((p) => p.length <= 200 && /^(word )*word$/.test(p))).toBe(true);
    expect(pieces(en, { language: 'English' }).join(' ')).toBe(en);
    const zh = '我们今天去公园散步，'.repeat(25);
    expect(pieces(zh, { language: 'Chinese' }).every((p) => p.endsWith('，') && p.length <= 200)).toBe(true);
    const bare = 'あ'.repeat(450);
    expect(pieces(bare, { language: 'Japanese' }).map((p) => p.length)).toEqual([200, 200, 50]);
  });

  it('서로게이트 쌍 안쪽은 자르지 않는다', () => {
    const line = `a${'𠀋'.repeat(150)}`; // 301 UTF-16 — 200번째 자리가 쌍의 뒤쪽(low surrogate)
    const out = pieces(line, { language: 'Chinese' });
    expect(out.join('')).toBe(line);
    expect(out.map((p) => p.length)).toEqual([199, 102]);
    expect(out.every((p) => !/^[\uDC00-\uDFFF]/.test(p) && !/[\uD800-\uDBFF]$/.test(p))).toBe(true);
  });

  it('canCut이 막은 자리(경계 기록 구간 안)는 피해서 그 앞에서 자른다', () => {
    const en = 'word '.repeat(60).trim();
    const free = splitAnalysisLine(en, { language: 'English' });
    const blocked = splitAnalysisLine(en, { language: 'English', canCut: (p) => p !== free[0].end });
    expect(blocked[0].end).toBeLessThan(free[0].end);
    expect(blocked.map(({ start, end }) => en.slice(start, end)).join(' ')).toBe(en);
  });
});

describe('자료 분석 — 긴 줄을 나눠 보내고 원래 줄로 잇는다', () => {
  it('영어 442자 줄: 요청 줄은 모두 캡 안, 토큰은 줄 전체 = 한 줄 토큰화와 같다, failed_indices=[]', async () => {
    const raw = `${EN_442}\nShe smiled.`;
    const json = await analyzeText(raw, signal(), { metadata: { language: 'English' } });
    expect(sentLines().every((l) => l.length <= ANALYZE_MAX_LINE_LEN)).toBe(true);
    expect(bodies).toHaveLength(1); // 한 문단 = 한 요청(조각이 늘어도 100줄 안)
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
    expect(lineTexts(json, 0)).toEqual(tokenizeEnLine(EN_442).map((t) => t.text));
    expect(lineTexts(json, 1)).toEqual(['She', 'smiled', '.']);
    expectLineShape(json, 0);
    expectLineShape(json, 1, { last: true });
    expect(inspectAnalysisCoverage(raw, json)).toMatchObject({ validStructure: true, missingIndices: [] });
    // 200자 뒤 단어도 뜻을 받았다(전에는 토큰째 없었다)
    const friend = lineEntries(json, 0).find((e) => e.token.text === 'friend');
    expect(friend.token.meaning).toBeTruthy();
  });

  it('일본어 272자 줄: 토큰을 이으면 원문 줄 그대로, failed_indices=[]', async () => {
    const json = await analyzeText(JA_272, signal(), { metadata: { language: 'Japanese' } });
    expect(sentLines().every((l) => l.length <= ANALYZE_MAX_LINE_LEN)).toBe(true);
    expect(sentLines().length).toBeGreaterThan(1);
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
    expect(lineTexts(json, 0).join('')).toBe(JA_272);
    expectLineShape(json, 0, { last: true });
    expect(inspectAnalysisCoverage(JA_272, json).missingIndices).toEqual([]);
  });

  it('조각이 100줄을 넘으면 문단을 여러 요청으로 나눠 보낸다 — 한 줄의 조각이 두 요청에 걸쳐도 잇는다', async () => {
    const a = 'The children walked along the quiet river and talked about the stories they had read in the old library last winter.';
    const b = 'Their teacher smiled and told them that every book is a door to another world that is waiting for them.';
    const c = 'Then they went home together, still talking about the strange letter and the sleeping cat on the shelf.';
    const lines = [`${a} ${b} ${c}`, ...Array.from({ length: 50 }, () => `${a} ${b}`)];
    const json = await analyzeText(lines.join('\n'), signal(), { metadata: { language: 'English' } });
    const requests = bodies.map(({ body }) => JSON.parse(body).lines);
    expect(requests.map((r) => r.length)).toEqual([100, 3]);
    expect(requests.flat().every((l) => l.length <= ANALYZE_MAX_LINE_LEN)).toBe(true);
    // 99번째·100번째 조각 = 줄 49의 앞·뒤 문장(두 요청에 걸친 줄)
    expect([requests[0][99], requests[1][0]]).toEqual([a, b]);
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
    expect(lineTexts(json, 49)).toEqual(tokenizeEnLine(`${a} ${b}`).map((t) => t.text));
    expectLineShape(json, 49);
    expect(inspectAnalysisCoverage(lines.join('\n'), json).missingIndices).toEqual([]);
  });

  it('서버가 truncated를 단 줄·줄을 다 덮지 못한 결과는 completed로 저장하지 않는다(실패 · 복구 가능)', async () => {
    const reply = (results) => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results }) }));
    const short = 'One two three four.';
    // 1) truncated 표식(토큰은 다 있어도)
    vi.stubGlobal('fetch', reply([{ sequence: ['a'], dictionary: { a: { text: short } }, truncated: true }]));
    expect(await analyzeText(short, signal(), { metadata: { language: 'English' } })).toMatchObject({ status: 'failed', failed_indices: [0] });
    // 2) 표식 없이 앞부분만(구 서버의 조용한 자르기) — 일·영 모두
    vi.stubGlobal('fetch', reply([{ sequence: ['a', 'b'], dictionary: { a: { text: 'One' }, b: { text: 'two' } } }]));
    expect(await analyzeText(short, signal(), { metadata: { language: 'English' } })).toMatchObject({ failed_indices: [0] });
    vi.stubGlobal('fetch', reply([{ sequence: ['a'], dictionary: { a: { text: '駅前の' } } }]));
    expect(await analyzeText('駅前の喫茶店。', signal(), { metadata: { language: 'Japanese' } })).toMatchObject({ failed_indices: [0] });
    // 3) 영어 토크나이저가 내지 않는 기호(— ’ %)만 빈 정상 줄은 완료 그대로(정상 줄을 깨지 않는다)
    const line = 'It’s 50% done — really.';
    vi.stubGlobal('fetch', reply([{ sequence: tokenizeEnLine(line).map((_, k) => `t${k}`),
      dictionary: Object.fromEntries(tokenizeEnLine(line).map((t, k) => [`t${k}`, t])) }]));
    expect(await analyzeText(line, signal(), { metadata: { language: 'English' } })).toMatchObject({ status: 'completed', failed_indices: [] });
  });
});

describe('경계 기록 · 복구 경로', () => {
  /** 화면(boundaryEditFlow)이 할 일을 순수 함수로 — 묶기 한 번 → processed_json. */
  function edit(json, raw, line, request, rev) {
    const r = editBoundaries(lineEntries(json, line), readBoundaryEdits(json), { line, ...request },
      { language: json.metadata.language, lineText: raw.split('\n')[line] });
    expect(r.ok && r.changed).toBe(true);
    return replaceBoundaryLine(json, line, assignBoundaryPieceIds(r.tokens, line, rev), r.edits);
  }

  it('조각 칼선 자리에 걸친 기록(picked up)은 자르지 않고 그 앞에서 자른다 — 조각 좌표로 싣고 줄 좌표로 되돌린다', async () => {
    // 문장 끝이 없는 긴 한 문장: 캡(200) 앞 마지막 공백이 picked|up 사이(200번째)다.
    const head = 'the children walked along the river '.repeat(5) + 'and then they ';
    expect(head.length).toBe(194);
    const line = `${head}picked up the book and read it together under the old tree near the bridge`;
    const raw = `${line}\nShe smiled.`;
    const json0 = await analyzeText(raw, signal(), { metadata: { language: 'English' } });
    expect(JSON.parse(bodies[0].body).lines[0].endsWith('picked')).toBe(true); // 기록 전에는 그 공백에서 잘렸다
    expect(json0.failed_indices).toEqual([]);
    const start = compactBoundaryText(head).length;
    const json1 = edit(json0, raw, 0, { start, end: start + 8, cuts: [] }, 'rev1aaaa');
    expect(lineTexts(json1, 0)).toContain('picked up');

    bodies.splice(0);
    vi.setSystemTime(T1);
    await runPreservedReanalysis(client(), { id: 3, raw_text: raw, processed_json: json1 }, signal(), analyzeText, { fullReset: true });
    const sent = JSON.parse(bodies[0].body);
    expect(sent.lines[0]).toBe(head.trim()); // 칼선이 기록 구간 앞(193)으로 물러났다
    expect(sent.lines[1].startsWith('picked up')).toBe(true);
    expect(sent.boundaries).toEqual([{ line: 1, start: 0, end: 8, text: 'pickedup', cuts: [], id: `b_0_${start}_${start + 8}` }]);
    const [{ args }] = rpcs;
    const json2 = args.p_json;
    expect(json2.failed_indices).toEqual([]);
    expect(lineTexts(json2, 0)).toContain('picked up');
    expect(lineEntries(json2, 0).find((e) => e.token.text === 'picked up').token.boundary).toBe('user');
    const [record] = readBoundaryEdits(json2);
    expect(record).toMatchObject({ status: 'applied', line: 0, start, end: start + 8, text: 'pickedup', cuts: [] });
    expect(record.base.map((e) => e.token.text)).toEqual(['picked', 'up']);
    expect(inspectAnalysisCoverage(raw, json2)).toMatchObject({ validStructure: true, missingIndices: [] });
  });

  it('예전에 잘린 채 저장된 자료(앞 200자 토큰만)는 복구(resume)가 이제 성공한다 — 다른 줄 id·뜻은 그대로', async () => {
    const raw = `${JA_272}\n天気予報を見た。`;
    // 구 서버가 남긴 모양 재현: 줄 0은 앞 200자 토큰만, completed · failed_indices=[]
    const legacy = await analyzeText(`${JA_272.slice(0, 200)}\n天気予報を見た。`, signal(), { metadata: { language: 'Japanese' } });
    expect(legacy).toMatchObject({ status: 'completed', failed_indices: [] });
    expect(inspectAnalysisCoverage(raw, legacy).missingIndices).toEqual([0]); // 뷰어의 「분석이 끝나지 않은 줄」
    const line1Before = lineEntries(legacy, 1);

    bodies.splice(0);
    vi.setSystemTime(T1);
    const record = await runPreservedReanalysis(client(), { id: 4, raw_text: raw, processed_json: legacy }, signal(), analyzeText, { resume: true });
    const json = record.processed_json;
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
    expect(inspectAnalysisCoverage(raw, json)).toMatchObject({ validStructure: true, missingIndices: [] });
    expect(lineTexts(json, 0).join('')).toBe(JA_272);
    expect(lineEntries(json, 1)).toEqual(line1Before);
    expect(sentLines().every((l) => l.length <= ANALYZE_MAX_LINE_LEN)).toBe(true);
  });
});
