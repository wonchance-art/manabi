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
