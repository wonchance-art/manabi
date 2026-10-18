import { afterEach, describe, expect, it, vi } from 'vitest';

// GEMINI-402-GUARD 후속(리뷰 비차단, 2026-10-17 KST) — 긴 자료 분석에서 서버가 「서비스 설정」(결제 · 크레딧)으로 실패하면
// 남은 요청을 보내지 않고 멈춘다. 남은 줄은 지금 실패 응답과 같은 길(결과 없음 → failed_indices · 복구 가능)로 끝난다.
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));
import { analyzeText } from '../analyzeText';

const signal = () => new AbortController().signal;
const RAW = Array.from({ length: 250 }, (_, k) => `Line ${k}.`).join('\n'); // 요청 3번(100 · 100 · 50)

function server(calls, firstFailure) {
  return vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    if (calls.length === 1) return { ok: false, status: 502, json: async () => firstFailure };
    return { ok: true, status: 200, json: async () => ({ results: body.lines.map((line) => {
      const words = line.match(/[A-Za-z0-9]+|\S/g) || [];
      return { sequence: words.map((_, k) => `s${k}`), dictionary: Object.fromEntries(words.map((text, k) => [`s${k}`, { text, meaning: `뜻:${text}` }])) };
    }) }) };
  });
}

describe('서비스 설정 실패 → 남은 요청 멈춤', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('첫 요청이 code service_config면 나머지 두 요청을 보내지 않고, 모든 줄이 실패(복구 가능)로 남는다', async () => {
    const calls = [];
    vi.stubGlobal('fetch', server(calls, { error: 'meaning service unavailable', code: 'service_config' }));
    const json = await analyzeText(RAW, signal(), { metadata: { language: 'English' } });
    expect(calls).toHaveLength(1);
    expect(json.status).not.toBe('completed');
    expect(json.failed_indices).toHaveLength(250);
  });

  it('표식 없는 실패(일시 502)는 지금처럼 다음 요청을 계속 보낸다 — 첫 100줄만 실패', async () => {
    const calls = [];
    vi.stubGlobal('fetch', server(calls, { error: 'Internal Server Error' }));
    const json = await analyzeText(RAW, signal(), { metadata: { language: 'English' } });
    expect(calls.map((c) => c.lines.length)).toEqual([100, 100, 50]);
    expect(json.failed_indices).toHaveLength(100);
  });
});

// 줄 단위 경로(일·영·중·한 밖 언어 — 프랑스어 등, analyzeLineByLineGemini)도 같은 표지(createServiceStop)로 멈춘다.
// /api/gemini는 서비스 설정을 402로 돌려준다(route.js) — 클라 callGemini는 재시도하지 않고, 줄 재시도(최대 5회)도 하지 않는다.
const FRENCH = Array.from({ length: 20 }, (_, k) => `Ligne ${k}.`).join('\n');
const tokenized = (line) => {
  const words = line.match(/[A-Za-z0-9]+|\S/g) || [];
  return JSON.stringify({ sequence: words.map((_, k) => `w${k}`), dictionary: Object.fromEntries(words.map((text, k) => [`w${k}`, { text, pos: '명사', meaning: text }])) });
};
function geminiRoute(calls, fail) {
  return vi.fn(async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const failure = fail(calls.length);
    if (failure) return { ok: false, status: failure.status, text: async () => JSON.stringify(failure.body), json: async () => failure.body };
    const line = /Ligne \d+\./.exec(JSON.stringify(body))?.[0] || 'Ligne';
    const data = { candidates: [{ content: { parts: [{ text: tokenized(line) }] } }] };
    return { ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data };
  });
}

describe('줄 단위 경로 — 서비스 설정 실패 → 남은 줄 멈춤', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('첫 묶음에서 402가 오면 다음 묶음 줄은 보내지 않고, 재시도도 없이 전부 실패(failed_indices · 복구 가능)로 남는다', async () => {
    const calls = [];
    vi.stubGlobal('fetch', geminiRoute(calls, () => ({ status: 402, body: { error: { message: 'Your prepayment credits are depleted.' } } })));
    const json = await analyzeText(FRENCH, signal(), { metadata: { language: 'French' }, concurrency: 6 });
    expect(calls).toHaveLength(6); // 첫 묶음 6줄만(동시에 이미 떠난 요청) — 재시도 0 · 다음 묶음 0
    expect(json.failed_indices).toHaveLength(20);
    expect(json.status).toBe('failed');
    // 멈춤은 그 분석에만 — 다음 분석(이어서 분석)은 처음부터 보낸다.
    const again = [];
    vi.stubGlobal('fetch', geminiRoute(again, () => null));
    const retried = await analyzeText(FRENCH, signal(), { metadata: { language: 'French' }, existingJson: json, concurrency: 6 });
    expect(again).toHaveLength(20);
    expect(retried.failed_indices).toHaveLength(0);
  });

  it('표식 없는 실패(일시 502)는 지금처럼 그 줄을 다시 보내고 나머지도 계속 보낸다', async () => {
    const calls = [];
    vi.stubGlobal('fetch', geminiRoute(calls, (n) => (n === 1 ? { status: 502, body: { error: { message: 'Bad Gateway' } } } : null)));
    const json = await analyzeText(FRENCH, signal(), { metadata: { language: 'French' }, concurrency: 6 });
    expect(calls).toHaveLength(21); // 20줄 + 실패한 한 줄의 재시도 1
    expect(json.failed_indices).toHaveLength(0);
  });
});
