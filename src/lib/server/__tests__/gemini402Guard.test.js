import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../__tests__/helpers/sliceBetween.js';

// GEMINI-402-GUARD(2026-10-17 KST) — 운영 Gemini 402 「Your prepayment credits are depleted」 실측 후속.
// ① 결제 · 크레딧은 「서비스 설정」 오류다: 혼잡(재시도 · 「잠시 붐비고 있어요」)으로 보지 않는다.
// ② 뜻 조회가 그 오류로 막히면 분석을 뜻 빈 완료본으로 끝내지 않는다(/api/analyze 실패 응답 → 기존 실패 경로).
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const BILLING = { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.' } };
const geminiFail = (status, body = { error: { message: `http ${status}` } }) => ({ ok: false, status, json: async () => body });
// 음성 사례(리뷰 차단 1, 2026-10-17 KST) — 보통 쿼터 초과 429도 「billing」을 싣는다. 기다리면 풀리는 혼잡이라 서비스 설정이 아니다.
const GEMINI_QUOTA = { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.' } };
const GROQ_QUOTA = { error: { message: 'Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` service tier `on_demand` on tokens per day (TPD): Limit 200000. Please try again in 7m. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing', type: 'tokens', code: 'rate_limit_exceeded' } };
const geminiOk = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const groqOk = (text) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) });
const isGroq = (url) => String(url).includes('api.groq.com');

async function freshLlm() { vi.resetModules(); return import('../llm.js'); }

describe('① 서버 분류 — 서비스 설정은 용량이 아니다', () => {
  beforeEach(() => { vi.stubEnv('GEMINI_API_KEY', 'k'); vi.stubEnv('GROQ_API_KEY', ''); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('판정 — 402, 그리고 결제 문구가 실린 429는 서비스 설정 · 용량 아님. 보통 429 · 503은 그대로 용량', async () => {
    const { isServiceConfigError, isCapacityError } = await freshLlm();
    expect(isServiceConfigError(402, null)).toBe(true);
    expect(isServiceConfigError(429, BILLING)).toBe(true);
    expect(isServiceConfigError(429, { error: { message: 'Resource has been exhausted (e.g. check quota).' } })).toBe(false);
    expect(isCapacityError(429, BILLING)).toBe(false);
    expect(isCapacityError(402, {})).toBe(false);
    expect(isCapacityError(429, {})).toBe(true);
    expect(isCapacityError(503, {})).toBe(true);
  });

  it('음성 — 「billing」이 든 보통 쿼터 429(Gemini · Groq)는 서비스 설정이 아니라 용량이다', async () => {
    const { isServiceConfigError, isCapacityError } = await freshLlm();
    for (const body of [GEMINI_QUOTA, GROQ_QUOTA]) {
      expect(isServiceConfigError(429, body)).toBe(false);
      expect(isCapacityError(429, body)).toBe(true);
      expect(isServiceConfigError(429, JSON.stringify(body))).toBe(false);
    }
  });

  it('음성 — 쿼터 429는 지금처럼 용량 재시도 · 폴백 모델을 탄다(서비스 설정으로 끊지 않는다)', async () => {
    const fetchSpy = vi.fn(async () => geminiFail(429, GEMINI_QUOTA));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await freshLlm();
    const err = await callLLM('standard', 'p', { retry: { max: 1, delays: [0] } }).catch((e) => e);
    expect(err.code).not.toBe('service_config');
    expect(fetchSpy).toHaveBeenCalledTimes(4); // 본선 2(1 + 재시도 1) + 폴백 모델 2
  });

  it('결제로 막히면 같은 키의 다른 Gemini 모델 · 용량 재시도를 건너뛰고 code service_config로 던진다', async () => {
    const fetchSpy = vi.fn(async () => geminiFail(429, BILLING));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await freshLlm();
    const err = await callLLM('standard', 'p', { retry: { max: 3, delays: [0, 0, 0] } }).catch((e) => e);
    expect(err.code).toBe('service_config');
    expect(err.status).toBe(429);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 본선 1회 — 재시도 0 · 폴백 모델(gemini-3.5-flash-lite) 0
  });

  it('Groq(다른 제공자)는 여전히 최종 폴백으로 본다', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g');
    const fetchSpy = vi.fn(async (url) => (isGroq(url) ? groqOk('groq 답') : geminiFail(402, BILLING)));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await freshLlm();
    const { text, meta } = await callLLM('standard', 'p');
    expect([text, meta.provider]).toEqual(['groq 답', 'groq']);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // Gemini 본선 1 + Groq 1
  });

  it('보통 용량 오류(503)는 지금처럼 폴백 모델로 넘어간다(회귀)', async () => {
    const fetchSpy = vi.fn(async (url) => (String(url).includes('gemini-3.6-flash') ? geminiFail(503) : geminiOk('답')));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await freshLlm();
    expect((await callLLM('standard', 'p')).text).toBe('답');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('프록시 /api/gemini는 서비스 설정을 402로 돌려준다 — 클라 용량 재시도(429)를 타지 않게', () => {
    const route = sliceBetween(read('src/app/api/gemini/route.js'), 'if (err instanceof LLMError) {', 'return Response.json(data, { status });');
    expect(route).toContain("const status = err.code === 'service_config' ? 402 : (err.status >= 400 ? err.status : 502);");
  });
});

describe('② 분석 데이터 보호 — 뜻 빈 완료본을 만들지 않는다', () => {
  beforeEach(() => { vi.stubEnv('GEMINI_API_KEY', 'k'); vi.stubEnv('GROQ_API_KEY', ''); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.doUnmock('@/lib/server/analyzeCore'); vi.doUnmock('@supabase/supabase-js'); });

  it('fetchMeanings — 서비스 설정 실패는 errors에 code service_config로 남는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiFail(402, BILLING)));
    vi.resetModules();
    const { fetchMeaningsForMissing } = await import('../fetchMeanings.js');
    const supabase = { from: () => ({ upsert: async () => ({ error: null }) }) };
    const { result, errors } = await fetchMeaningsForMissing([{ base_form: '駅', pos: '명사' }], 'Japanese', supabase);
    expect(result.size).toBe(0);
    expect(errors.some((e) => e.stage === 'http' && e.code === 'service_config')).toBe(true);
  });

  it('analyzeCore — 그 표식을 meaningFailure로 돌려주고, 결과(results)는 그대로라 대화 턴은 바뀌지 않는다', () => {
    const core = read('src/lib/server/analyzeCore.js');
    expect(core).toContain("if ((meaningErrors || []).some((e) => e?.code === 'service_config')) meaningFailure = 'service_config';");
    expect(sliceBetween(core, '  return {\n    results,', 'stats: {')).toContain('...(meaningFailure ? { meaningFailure } : {}),');
    // 대화 턴은 results만 읽는다(analyzeWithinBudget) — 표식을 보지 않는다.
    expect(read('src/lib/server/conversationTurn.js')).not.toContain('meaningFailure');
  });

  async function postAnalyze(meaningFailure) {
    vi.resetModules();
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u-402' } }, error: null }) } }) }));
    vi.doMock('@/lib/server/analyzeCore', () => ({
      analyzeLines: async () => ({ results: [{ sequence: ['w'], dictionary: { w: { text: '駅', meaning: '' } } }], stats: {}, ...(meaningFailure ? { meaningFailure } : {}) }),
    }));
    const { POST } = await import('../../../app/api/analyze/route.js');
    const res = await POST(new Request('http://x/api/analyze', { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: JSON.stringify({ lines: ['駅'], language: 'Japanese' }) }));
    return { status: res.status, body: await res.json() };
  }

  it('/api/analyze — 서비스 설정이면 뜻 빈 토큰 대신 502 실패(재시도 없는 상태) · 아니면 지금 그대로 200', async () => {
    const failed = await postAnalyze('service_config');
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ error: 'meaning service unavailable', code: 'service_config' });
    expect(failed.body.results).toBeUndefined();
    const ok = await postAnalyze(null);
    expect(ok.status).toBe(200);
    expect(ok.body.results).toHaveLength(1);
  });

  it('클라 분석은 429만 자동 재시도하고, 실패 응답의 줄은 기존 실패(failed_indices)로 남긴다 — 재분석은 완료 검사에서 멈춘다', () => {
    const text = read('src/lib/analyzeText.js');
    expect(text).toContain('if (res?.status !== 429 || attempt >= RATE_LIMIT_RETRIES) return res;');
    expect(text).toContain("if (data?.code === 'service_config') serviceStopped = true;");
    expect(text).toContain('throw new Error(data?.error || `HTTP ${res.status}`);');
    const preserve = read('src/lib/reanalysisPreservation.js');
    expect(preserve).toContain("if (!completeAnalysis(result, rawText)) throw new Error('새 분석을 완료하지 못했어요. 기존 원문과 분석은 그대로 있어요.');");
  });
});
