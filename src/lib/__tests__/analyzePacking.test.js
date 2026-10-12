import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// 20문단 넘는 자료가 분석에서 막히던 문제 회귀 계약(#1412 위 수정, 2026-10-12 실계정 Preview 재현).
// 전: analyzeText가 빈 줄 문단마다 /api/analyze를 한 번씩 순서대로 불렀다. 서버는 사용자당 분당 20회(고정 창)라
// 21번째 문단부터 429를 받았고, 클라이언트는 기다리지도 다시 보내지도 않고 그 문단 줄을 failed_indices로 남겼다
// — 28문단 자료가 partial로 끝났고, 복구 버튼도 같은 벽에 다시 부딪혔다.
// 후: ① 분석할 문단의 요청 줄(조각)을 문단을 넘어 한 요청에 묶는다(≤100줄 · 줄 ≤200자 · 언어별 글자 예산).
//     재사용 문단은 여전히 보내지 않고, 결과는 문단별로 보낼 때와 같은 processed_json으로 잇는다.
//     ② 429면 Retry-After(초, 없거나 이상하면 5초 · 최대 60초)만큼 기다렸다가 두 번까지 다시 보낸다(signal로 중단 가능).
// 「같은 processed_json」은 __snapshots__/analyzePacking.perParagraph.json이 증거다 — 이 수정 **전** 코드(문단마다 요청)로 뜬
// 결과를 고정했고(toEqual, 자동 갱신 아님), 묶어 보내는 지금 코드가 바이트 단위로 같은 결과를 내야 한다.

vi.mock('../server/llm.js', async () => ({ callLLM: (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).supabaseModule);
vi.mock('../server/rateLimit.js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).rateLimitModule);
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));

import { POST } from '../../app/api/analyze/route.js';
import { reset, routeFetch } from '../server/__tests__/helpers/boundaryRouteHarness.js';
import { ANALYZE_PACK_MAX_CHARS, analyzeText, retryAfterMs } from '../analyzeText';
import { inspectAnalysisCoverage } from '../analysisCoverage';

const FIXTURE = path.join(process.cwd(), 'src/lib/__tests__/__snapshots__/analyzePacking.perParagraph.json');
const T0 = Date.UTC(2026, 9, 12, 4, 0, 0);
const T1 = T0 + 60_000;

/** 줄마다 결정적인 가짜 서버 — 같은 줄이면 어느 요청에 묶여도 같은 결과. 요청 본문을 calls에 남긴다. */
function lineServer(calls, { status = () => 200, headers } = {}) {
  return vi.fn(async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const code = status(body, calls.length);
    if (code !== 200) {
      return { ok: false, status: code, ...(headers ? { headers: new Headers(headers) } : {}),
        json: async () => ({ error: 'too many' }) };
    }
    return {
      ok: true, status: 200,
      json: async () => ({ results: body.lines.map((line) => {
        const words = line.match(/[A-Za-z0-9']+|[\u4e00-\u9fff]{1,2}|\S/gu) || [];
        const sequence = words.map((_, k) => `s${k}`);
        const dictionary = Object.fromEntries(words.map((text, k) => [`s${k}`,
          { text, meaning: `뜻:${text}` }]));
        return { sequence, dictionary };
      }) }),
    };
  });
}

const EN_LONG = 'The old library stood at the end of the street, and every morning the children walked past it on their way to school. '
  + 'Nobody remembered when it had been built, but everyone agreed that it was the most lovely building in the town. '
  + 'One wet afternoon, a girl named Lucy pushed open the heavy door and stepped inside.';
const ZH_LONG = '我们今天去公园散步，'.repeat(25);

const EN_RAW = ['', 'The cat sat on the mat.', '  It was warm.  ', '', '   ', EN_LONG, 'Short one.', '', `${EN_LONG}\n${EN_LONG.toUpperCase()}\n${EN_LONG.slice(40)}`, '',
  ...Array.from({ length: 24 }, (_, k) => (k % 5 === 0 ? `Paragraph ${k} has words.\nAnd a second line ${k}.\n` : `Paragraph ${k} has words.\n`)),
  'Last line.', ''].join('\n');
const ZH_RAW = ['运动员的身体素质非常好。', '他是我的朋友。', '', ZH_LONG, '', '身体好。', '', `${ZH_LONG}今天很好。`, '今天天气很好。', '我们去公园。', '', '再见。'].join('\n');

const signal = () => new AbortController().signal;

/** 줄마다 결정적인 가짜 서버로 새 분석 · 복구(일부 줄 실패) · 영어/중국어. */
async function lineScenarios() {
  const out = {};
  const requests = {};
  for (const [language, raw] of [['English', EN_RAW], ['Chinese', ZH_RAW]]) {
    vi.setSystemTime(T0);
    const createdCalls = [];
    vi.stubGlobal('fetch', lineServer(createdCalls));
    const created = await analyzeText(raw, signal(), { metadata: { language } });
    // 복구: 떨어진 세 문단의 줄이 실패로 남은 자료 — 실패 줄이 든 문단만 다시 분석하고 나머지는 재사용한다.
    const lines = raw.split('\n');
    const failed = [lines.findIndex((l) => l.trim().startsWith('It') || l.startsWith('他')),
      lines.findIndex((l) => l.includes('Paragraph 10') || l.startsWith('身体')), lines.findLastIndex((l) => l.trim())];
    const broken = structuredClone(created);
    broken.failed_indices = failed;
    broken.status = 'partial';
    vi.setSystemTime(T1);
    const resumedCalls = [];
    vi.stubGlobal('fetch', lineServer(resumedCalls));
    const resumed = await analyzeText(raw, signal(), { metadata: { language }, existingJson: broken });
    out[language] = { created, resumed };
    requests[language] = { created: createdCalls.map((c) => c.lines.length), resumed: resumedCalls.map((c) => c.lines.length) };
  }
  return { out, requests };
}

/** 실제 라우트(가짜 모델·사전) — 두 문단에 걸친 단어 경계 기록이 한 요청에 실려도 문단별 요청과 같은 결과. */
async function boundaryScenario() {
  vi.setSystemTime(T0);
  const bodies = [];
  vi.stubGlobal('fetch', routeFetch(POST, bodies));
  reset();
  const raw = '运动员的身体素质非常好。\n他是我的社恐朋友。\n\n身体好。';
  const viewerBoundaries = { version: 1, edits: [
    { id: 'b_0_4_8', line: 0, start: 4, end: 8, text: '身体素质', cuts: [], status: 'applied', base: [] },
    { id: 'b_3_0_3', line: 3, start: 0, end: 3, text: '身体好', cuts: [], status: 'applied', base: [] },
  ] };
  const json = await analyzeText(raw, signal(), { metadata: { language: 'Chinese', viewerBoundaries } });
  return { json, bodies: bodies.map(({ body }) => JSON.parse(body)) };
}

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ['Date'] });
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('여러 문단을 한 요청에 묶어도 문단별 요청과 같은 processed_json(고정 증거)', () => {
  it('새 분석 · 복구 · 단어 경계 기록 — 수정 전 문단별 출력과 같다', async () => {
    const lines = await lineScenarios();
    const boundary = await boundaryScenario();
    const now = { lines: lines.out, boundary: boundary.json };
    // 고정본은 수정 전 analyzeText(문단마다 요청 — #1412 머리 c37dc406의 src/lib/analyzeText.js)로 떴다. 장면을 바꿀 때만, 그 옛 코드로 되돌려 다시 뜬다.
    if (process.env.WRITE_PACKING_FIXTURE) writeFileSync(FIXTURE, `${JSON.stringify(now)}\n`);
    expect(now).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
    // 같은 결과를 훨씬 적은 요청으로 — 문단별로는 영어 새 분석 28번 · 복구 3번, 중국어 5번 · 3번이었다(28문단 = QA 재현 자료 모양).
    expect(lines.requests).toEqual({ English: { created: [41], resumed: [5] }, Chinese: { created: [5, 5], resumed: [4] } });
    // 두 문단의 경계 기록이 한 요청에 — 줄 번호는 요청 안 번호(문단별일 때는 둘 다 line 0이었다)
    expect(boundary.bodies).toHaveLength(1);
    expect(boundary.bodies[0].boundaries.map(({ id, line }) => [id, line])).toEqual([['b_0_4_8', 0], ['b_3_0_3', 2]]);
  });
});

describe('문단을 넘어 묶기 — 요청 수', () => {
  it('짧은 문단 28개(QA 재현 자료 모양) = 요청 1번 · completed · 중간 저장 1번 + 마지막 1번', async () => {
    const calls = [];
    vi.stubGlobal('fetch', lineServer(calls));
    const raw = Array.from({ length: 28 }, (_, k) => `Paragraph ${k} is short.`).join('\n\n');
    const onBatch = vi.fn();
    const json = await analyzeText(raw, signal(), { metadata: { language: 'English' }, onBatch });
    expect(calls).toHaveLength(1);
    expect(calls[0].lines).toEqual(Array.from({ length: 28 }, (_, k) => `Paragraph ${k} is short.`));
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
    expect(inspectAnalysisCoverage(raw, json)).toMatchObject({ validStructure: true, missingIndices: [] });
    expect(onBatch.mock.calls.map(([{ processed, total }]) => [processed, total])).toEqual([[55, 55], [55, 55]]);
  });

  it('120줄(3줄 문단 40개) = 요청 2번(100 + 20) — 두 요청에 걸친 문단도 잇는다', async () => {
    const calls = [];
    vi.stubGlobal('fetch', lineServer(calls));
    const paras = Array.from({ length: 40 }, (_, p) => [0, 1, 2].map((k) => `Line ${p * 3 + k}.`).join('\n'));
    const raw = paras.join('\n\n');
    const json = await analyzeText(raw, signal(), { metadata: { language: 'English' } });
    expect(calls.map((c) => c.lines.length)).toEqual([100, 20]);
    expect([calls[0].lines.at(-1), calls[1].lines[0]]).toEqual(['Line 99.', 'Line 100.']); // 문단 33 = Line 99~101
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
    expect(inspectAnalysisCoverage(raw, json)).toMatchObject({ validStructure: true, missingIndices: [] });
  });

  it('요청은 언어별 글자 예산(ANALYZE_PACK_MAX_CHARS)을 넘지 않는다 — 넘칠 조각부터 다음 요청', async () => {
    const calls = [];
    vi.stubGlobal('fetch', lineServer(calls));
    const line = '今天天气很好我们一起去公园散步吧。'.repeat(5); // 85자
    const raw = Array.from({ length: 12 }, () => line).join('\n\n');
    await analyzeText(raw, signal(), { metadata: { language: 'Chinese' } });
    expect(calls.map((c) => c.lines.length)).toEqual([4, 4, 4]); // 85 × 4 = 340 ≤ 400 < 425
    expect(calls.every((c) => c.lines.join('').length <= ANALYZE_PACK_MAX_CHARS.Chinese)).toBe(true);
  });

  it('재사용 문단은 보내지 않는다 — 떨어진 실패 문단 셋이 한 요청', async () => {
    vi.stubGlobal('fetch', lineServer([]));
    const raw = Array.from({ length: 10 }, (_, k) => `Paragraph ${k} here.`).join('\n\n');
    const json0 = await analyzeText(raw, signal(), { metadata: { language: 'English' } });
    const calls = [];
    vi.stubGlobal('fetch', lineServer(calls));
    vi.setSystemTime(T1);
    const json = await analyzeText(raw, signal(), { metadata: { language: 'English' },
      existingJson: { ...json0, status: 'partial', failed_indices: [2, 10, 18] } });
    expect(calls.map((c) => c.lines)).toEqual([['Paragraph 1 here.', 'Paragraph 5 here.', 'Paragraph 9 here.']]);
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
    expect(json.sequence.filter((id) => id.startsWith('id_0_'))).toEqual(json0.sequence.filter((id) => id.startsWith('id_0_')));
  });

  it('한국어는 문단(8줄 · 1600자 배치) = 요청 그대로 묶지 않는다', async () => {
    const calls = [];
    vi.stubGlobal('fetch', koreanServer(calls));
    const raw = '첫 문단입니다.\n\n둘째 문단입니다.\n\n셋째 문단입니다.';
    const json = await analyzeText(raw, signal(), { metadata: { language: 'Korean' } });
    expect(calls.map((c) => c.lines)).toEqual([['첫 문단입니다.'], ['둘째 문단입니다.'], ['셋째 문단입니다.']]);
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
  });
});

/** 한국어 가짜 서버 — 줄 하나 = 토큰 하나. 앞의 limited번은 429. */
function koreanServer(calls, { limited = 0, headers } = {}) {
  return vi.fn(async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, ...body });
    if (calls.length <= limited) {
      return { ok: false, status: 429, ...(headers ? { headers: new Headers(headers) } : {}), json: async () => ({ error: 'too many' }) };
    }
    return { ok: true, status: 200, json: async () => ({
      metadata: { language: 'Korean', explanationLocale: 'ko', analysisVersion: 'ko-llm-v1' },
      results: body.lines.map((text) => ({ sequence: ['k0'], dictionary: { k0: { text, meaning: '뜻' } } })),
    }) };
  });
}

/** setTimeout은 가짜로 — 첫 요청이 나갈 때까지는 실제 매크로태스크(setImmediate)로 기다린다. */
const untilCalls = async (calls, n) => { while (calls.length < n) await new Promise((r) => setImmediate(r)); };
const fakeTimers = () => vi.useFakeTimers({ now: T0, toFake: ['Date', 'setTimeout', 'clearTimeout'] });

describe('429 — Retry-After만큼 기다렸다가 다시 보낸다', () => {
  it('Retry-After: 2 → 2초 기다린 뒤 다시 보내 성공(completed)', async () => {
    fakeTimers();
    const calls = [];
    vi.stubGlobal('fetch', lineServer(calls, { status: (_, n) => (n === 1 ? 429 : 200), headers: { 'Retry-After': '2' } }));
    const done = analyzeText('One line.\n\nTwo line.', signal(), { metadata: { language: 'English' } });
    await untilCalls(calls, 1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    const json = await done;
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
  });

  it('headers 없는 429(시험 목)도 받는다 — 기본 5초 기다림', async () => {
    fakeTimers();
    const calls = [];
    vi.stubGlobal('fetch', lineServer(calls, { status: (_, n) => (n === 1 ? 429 : 200) }));
    const done = analyzeText('One line.', signal(), { metadata: { language: 'English' } });
    await untilCalls(calls, 1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await done).toMatchObject({ status: 'completed', failed_indices: [] });
  });

  it('retryAfterMs — 숫자 초만 믿고, 없거나 이상하면 5초, 1~60초로 자른다', () => {
    const res = (value) => ({ headers: new Headers(value == null ? {} : { 'Retry-After': value }) });
    expect(retryAfterMs(res('2'))).toBe(2000);
    expect(retryAfterMs(res('0'))).toBe(1000);
    expect(retryAfterMs(res('600'))).toBe(60_000);
    expect(retryAfterMs(res('soon'))).toBe(5000);
    expect(retryAfterMs(res('-3'))).toBe(5000);
    expect(retryAfterMs(res(null))).toBe(5000);
    expect(retryAfterMs({})).toBe(5000);
    expect(retryAfterMs({ headers: { get: () => { throw new Error('x'); } } })).toBe(5000);
  });

  it('계속 429면 두 번 다시 보낸 뒤 그 요청 줄만 실패(partial) — 앞 요청 진행은 저장돼 있고, 복구는 남은 줄을 한 요청으로 끝낸다', async () => {
    fakeTimers();
    const calls = [];
    // 120줄(3줄 문단 40개) → 요청 100 + 20. 둘째 요청은 늘 429.
    vi.stubGlobal('fetch', lineServer(calls, { status: (_, n) => (n === 1 ? 200 : 429), headers: { 'Retry-After': '1' } }));
    const paras = Array.from({ length: 40 }, (_, p) => [0, 1, 2].map((k) => `Line ${p * 3 + k}.`).join('\n'));
    const raw = paras.join('\n\n');
    const saves = [];
    const done = analyzeText(raw, signal(), { metadata: { language: 'English' },
      onBatch: ({ currentJson, processed }) => { saves.push({ processed, json: structuredClone(currentJson) }); } });
    await untilCalls(calls, 2);
    await vi.advanceTimersByTimeAsync(2000);
    const json = await done;
    expect(calls.map((c) => c.lines.length)).toEqual([100, 20, 20, 20]); // 첫 시도 + 다시 보내기 2번
    const lineIdx = (n) => Math.floor(n / 3) * 4 + (n % 3); // 문단 사이 빈 줄 포함 원문 줄 번호
    const failed = Array.from({ length: 20 }, (_, k) => lineIdx(100 + k));
    expect(json.status).toBe('partial');
    expect(json.failed_indices).toEqual(failed);
    // 첫 요청 뒤 중간 저장 — 다 모인 문단(0~32)과 그 사이 빈 줄까지 · 실패 없음
    expect(saves[0].processed).toBe(33 * 4);
    expect(saves[0].json.failed_indices).toEqual([]);
    // Line 99(문단 33의 첫 줄)는 첫 요청에서 성공했다 — 같은 문단의 100·101만 실패
    expect(json.sequence).toContain(`id_${lineIdx(99)}_0_${T0}`);

    // 복구: 실패 줄이 든 문단(33~39)만 한 요청으로 — 성공 문단의 토큰 id는 그대로
    vi.useRealTimers();
    vi.useFakeTimers({ now: T1, toFake: ['Date'] });
    const again = [];
    vi.stubGlobal('fetch', lineServer(again));
    const resumed = await analyzeText(raw, signal(), { metadata: { language: 'English' }, existingJson: json });
    expect(again.map((c) => c.lines)).toEqual([Array.from({ length: 21 }, (_, k) => `Line ${99 + k}.`)]);
    expect(resumed).toMatchObject({ status: 'completed', failed_indices: [] });
    expect(resumed.sequence).toContain(`id_0_0_${T0}`);
    expect(resumed.sequence).toContain(`id_${lineIdx(119)}_0_${T1}`);
    expect(inspectAnalysisCoverage(raw, resumed).missingIndices).toEqual([]);
  });

  it('기다리는 중에 중단하면 곧바로 AbortError(타이머를 돌리지 않아도)', async () => {
    fakeTimers();
    const calls = [];
    vi.stubGlobal('fetch', lineServer(calls, { status: () => 429, headers: { 'Retry-After': '30' } }));
    const controller = new AbortController();
    const settled = analyzeText('One line.', controller.signal, { metadata: { language: 'English' } })
      .then(() => 'resolved', (e) => e);
    await untilCalls(calls, 1);
    while (vi.getTimerCount() === 0) await new Promise((r) => setImmediate(r));
    expect(vi.getTimerCount()).toBe(1); // Retry-After 30초 기다림 중
    controller.abort();
    const error = await settled;
    expect(error).toBeInstanceOf(DOMException);
    expect(error.name).toBe('AbortError');
    expect(calls).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0); // 기다림 타이머도 치웠다
  });

  it('한국어 경로도 429를 기다렸다가 다시 보낸다', async () => {
    fakeTimers();
    const calls = [];
    vi.stubGlobal('fetch', koreanServer(calls, { limited: 1, headers: { 'Retry-After': '3' } }));
    const done = analyzeText('안녕하세요.', signal(), { metadata: { language: 'Korean' } });
    await untilCalls(calls, 1);
    await vi.advanceTimersByTimeAsync(3000);
    const json = await done;
    expect(calls.map((c) => c.url)).toEqual(['/api/analyze/korean', '/api/analyze/korean']);
    expect(json).toMatchObject({ status: 'completed', failed_indices: [] });
  });
});
