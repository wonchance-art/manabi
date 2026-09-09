import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// AA R1 계약 — #1077 코멘트 5551860999 §R1 「계약(심을 것)」.
// 호출부는 티어만 말한다. 모델 식별자·Gemini 엔드포인트·Groq 변환·용량 재시도는 llm.js 한 곳.

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
function walk(dir, out = []) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, name);
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(js|jsx)$/.test(name) && !/\.test\.jsx?$/.test(name) && !rel.includes('__tests__')) out.push(rel);
  }
  return out;
}
const LLM = 'src/lib/server/llm.js';
const TTS = 'src/app/api/tts/route.js'; // 별 라인(SPEC 비범위) — 유일한 예외
const SERVER_FILES = [...walk('src/app/api'), ...walk('src/lib/server'), 'src/lib/gemini.js'];
const filesMatching = (re) => SERVER_FILES.filter((f) => re.test(read(f))).sort();

const CALL_SITES = [
  ['src/app/api/explain/route.js', [
    "callLLM('light', promptText, { temperature: 0, route: 'explain' })",
    "callLLM('light', promptText, { temperature: 0.3, route: 'explain' })",
  ]],
  ['src/app/api/study-paragraph/route.js', [
    "callLLM('standard', promptText, {", 'temperature: 0.6,', "responseMimeType: 'application/json',", 'responseSchema: PARAGRAPH_SCHEMA,',
  ]],
  ['src/app/api/writing-feedback/route.js', [
    "callLLM('standard', promptText, {", 'temperature: 0.2,', "responseMimeType: 'application/json',", 'responseSchema: FEEDBACK_SCHEMA,',
  ]],
  ['src/lib/server/fetchMeanings.js', [
    "callLLM('light', prompt, {", 'temperature: 0,', 'retry: { max: MAX_RETRIES - 1, delays: DELAYS },', 'deadlineMs,',
  ]],
  ['src/lib/server/disambiguateZhPos.js', [
    "callLLM('light', buildZhPosPrompt(lines, marks), {", 'temperature: 0, timeoutMs: 15_000, groq: false,',
  ]],
  ['src/lib/server/disambiguateEnPos.js', [
    "callLLM('light', buildEnPosPrompt(lines, marks), {", 'temperature: 0, timeoutMs: 15_000, groq: false,',
  ]],
  ['src/app/api/gemini/route.js', [
    'resolveTier({ tier: body.tier, model: body.model })', 'callLLM(resolved.tier, contents, {', 'generationConfig: safeGenConfig,',
  ]],
];

describe('AA R1 — 소스 계약: 모델·엔드포인트는 llm.js 한 곳', () => {
  it('Gemini 엔드포인트 문자열은 llm.js(+ 별 라인 tts)에만 있다', () => {
    expect(filesMatching(/generativelanguage\.googleapis\.com/)).toEqual([TTS, LLM].sort());
  });

  it('모델 식별자(gemini-N · qwen/)는 llm.js(+ tts)에만 있다', () => {
    expect(filesMatching(/gemini-\d|qwen\//)).toEqual([TTS, LLM].sort());
  });

  it('Groq 엔드포인트·모델 상수는 llm.js에만 있다', () => {
    expect(filesMatching(/api\.groq\.com|GROQ_MODEL\b/)).toEqual([LLM]);
  });

  it.each(CALL_SITES)('%s — 교체 전과 같은 generationConfig를 티어 호출에 그대로 넘긴다', (file, needles) => {
    const src = read(file);
    for (const n of needles) expect(src).toContain(n);
    expect(src).toMatch(/from '(@\/lib\/server\/llm|\.\/llm\.js)'/);
    // 자기 복사본 0 — Gemini/Groq를 직접 부르지 않는다
    expect(src).not.toMatch(/callGemini\(|callGroq|fetch\(`\$\{GEMINI_URL\}/);
  });

  it('프록시 — model allowlist 대신 티어를 받고, Groq 결과도 candidates 형식(_provider)으로 돌려준다', () => {
    const proxy = read('src/app/api/gemini/route.js');
    expect(proxy).not.toContain('ALLOWED_MODELS');
    expect(proxy).toContain("_provider: 'groq'");
    expect(proxy).toContain('usageMetadata');
    expect(proxy).toContain("'Bad Request: Unsupported model'");
    expect(proxy).toContain("'Bad Request: Unsupported tier'");
  });

  it('클라(lib/gemini.js)는 GEMINI_TIER만 알고 body.tier로 보낸다 — 호출부 3곳도 티어', () => {
    const client = read('src/lib/gemini.js');
    expect(client).toContain("export const GEMINI_TIER = 'standard'");
    expect(client).toMatch(/contents: \[\{ parts: \[\{ text: prompt \}\] \}\],\n\s+tier,/);
    expect(client).not.toContain('GEMINI_MODEL');
    for (const hook of ['src/lib/useGrammarDetail.js', 'src/lib/useEasierText.js', 'src/lib/useViewerQuiz.js']) {
      const src = read(hook);
      expect(src).toContain('{ tier: GEMINI_TIER }');
      expect(src).not.toContain('GEMINI_MODEL');
    }
  });
});

// ── 동작 계약 — fetch 스텁 위에서 llm.js를 새로 import(모델별 thinking 메모가 테스트 간 새지 않게) ──
const geminiOk = (text, usage) => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }], ...(usage ? { usageMetadata: usage } : {}) }),
});
const geminiFail = (status, body = { error: { message: `http ${status}` } }) => ({ ok: false, status, json: async () => body });
const groqOk = (text) => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 7, completion_tokens: 3 } }),
});
const isGemini = (url, model) => String(url).includes(`/models/${model}:generateContent`);
const isGroq = (url) => String(url).includes('api.groq.com');
const bodyOf = (call) => JSON.parse(call[1].body);

async function fresh() {
  vi.resetModules();
  return import('../llm.js');
}

describe('AA R1 — callLLM 동작 계약', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
    vi.stubEnv('GROQ_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('티어 표 — light/standard, 폴백은 본선보다 가벼운 모델만', async () => {
    const { TIERS, TIER_NAMES, LEGACY_MODEL_TIERS, GROQ_MODEL } = await fresh();
    expect(TIER_NAMES).toEqual(['light', 'standard']);
    expect(TIERS.light).toEqual({ primary: 'gemini-3.5-flash-lite', fallbacks: [] });
    expect(TIERS.standard).toEqual({ primary: 'gemini-3.6-flash', fallbacks: ['gemini-3.5-flash-lite'] });
    expect(GROQ_MODEL).toMatch(/^qwen\//);
    expect(Object.values(LEGACY_MODEL_TIERS).every((t) => TIER_NAMES.includes(t))).toBe(true);
  });

  it('resolveTier — tier 우선, 옛 model은 매핑, 목록 밖은 오류, 둘 다 없으면 standard', async () => {
    const { resolveTier } = await fresh();
    expect(resolveTier({ tier: 'light', model: 'models/gemini-3.6-flash' })).toEqual({ tier: 'light' });
    expect(resolveTier({ tier: 'pro' })).toEqual({ error: 'unsupported_tier' });
    expect(resolveTier({ model: 'models/gemini-3.6-flash' })).toEqual({ tier: 'standard' });
    expect(resolveTier({ model: 'models/gemini-2.5-flash' })).toEqual({ tier: 'standard' });
    expect(resolveTier({ model: 'models/gemini-3.5-flash-lite' })).toEqual({ tier: 'light' });
    expect(resolveTier({ model: 'models/gemini-2.5-flash-lite' })).toEqual({ tier: 'light' });
    expect(resolveTier({ model: 'models/gemini-3.6-pro' })).toEqual({ error: 'unsupported_model' });
    expect(resolveTier({})).toEqual({ tier: 'standard' });
  });

  it('키가 둘 다 없으면 호출 없이 { ok:false, code:no_key }를 던진다(.env.local 없는 vitest 관례)', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM, LLMError } = await fresh();
    const err = await callLLM('light', 'p').catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.ok).toBe(false);
    expect(err.code).toBe('no_key');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('모르는 티어는 요청 전에 거부한다', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const err = await callLLM('pro', 'p').catch((e) => e);
    expect(err.code).toBe('unknown_tier');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('standard — 본선 실패 시 폴백 모델로 넘어가고 meta가 어느 모델이 답했는지 말한다', async () => {
    const fetchSpy = vi.fn(async (url) => (isGemini(url, 'gemini-3.6-flash') ? geminiFail(503) : geminiOk('답')));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const { text, meta } = await callLLM('standard', '질문', { route: 'x' });
    expect(text).toBe('답');
    expect(meta).toMatchObject({ tier: 'standard', model: 'gemini-3.5-flash-lite', provider: 'gemini', fallbackDepth: 1, route: 'x' });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(isGemini(fetchSpy.mock.calls[0][0], 'gemini-3.6-flash')).toBe(true);
    expect(isGemini(fetchSpy.mock.calls[1][0], 'gemini-3.5-flash-lite')).toBe(true);
  });

  it('요청 본문 — contents 형식·generationConfig 그대로·thinking 기본 off(최소 설정 동봉)', async () => {
    const fetchSpy = vi.fn(async () => geminiOk('ok'));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM, THINKING_OFF_CONFIG } = await fresh();
    const schema = { type: 'object', properties: { a: { type: 'string' } } };
    await callLLM('standard', '프롬프트', {
      temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 512,
      generationConfig: { topP: 0.9 },
    });
    const body = bodyOf(fetchSpy.mock.calls[0]);
    expect(body.contents).toEqual([{ parts: [{ text: '프롬프트' }] }]);
    expect(body.generationConfig).toEqual({
      topP: 0.9, temperature: 0.2, responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 512,
      thinkingConfig: THINKING_OFF_CONFIG,
    });
    expect(fetchSpy.mock.calls[0][1].method).toBe('POST');
    expect(fetchSpy.mock.calls[0][0]).toContain('key=gemini-test-key');
  });

  it("thinking:'on'이면 thinking 설정을 싣지 않는다(호출부 명시 때만)", async () => {
    const fetchSpy = vi.fn(async () => geminiOk('ok'));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    await callLLM('standard', 'p', { thinking: 'on', temperature: 0 });
    expect(bodyOf(fetchSpy.mock.calls[0]).generationConfig).toEqual({ temperature: 0 });
  });

  it('모델이 thinking 설정을 거부(400)하면 같은 모델을 설정 없이 즉시 재요청하고 이후엔 싣지 않는다 — 폴백 강등 0', async () => {
    const fetchSpy = vi.fn(async (url, opts) => {
      const cfg = JSON.parse(opts.body).generationConfig;
      if (cfg.thinkingConfig) return geminiFail(400, { error: { message: 'Unknown name "thinkingConfig"' } });
      return geminiOk('ok');
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const first = await callLLM('light', 'p');
    expect(first.meta).toMatchObject({ model: 'gemini-3.5-flash-lite', fallbackDepth: 0 });
    expect(fetchSpy).toHaveBeenCalledTimes(2); // 거부 1 + 재요청 1, 같은 모델
    expect(isGemini(fetchSpy.mock.calls[1][0], 'gemini-3.5-flash-lite')).toBe(true);
    expect(bodyOf(fetchSpy.mock.calls[1]).generationConfig.thinkingConfig).toBeUndefined();
    await callLLM('light', 'p2');
    expect(fetchSpy).toHaveBeenCalledTimes(3); // 메모 — 두 번째 호출은 처음부터 설정 없이 1회
    expect(bodyOf(fetchSpy.mock.calls[2]).generationConfig.thinkingConfig).toBeUndefined();
  });

  it('thinking과 무관한 400은 재요청 없이 다음 후보로 넘어간다', async () => {
    const fetchSpy = vi.fn(async (url) => (isGemini(url, 'gemini-3.6-flash')
      ? geminiFail(400, { error: { message: 'Invalid JSON payload' } }) : geminiOk('ok')));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const { meta } = await callLLM('standard', 'p');
    expect(meta.model).toBe('gemini-3.5-flash-lite');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('Groq 최종 폴백 — Gemini 전량 실패 시 messages로 변환, JSON 모드는 response_format+안내문, 응답은 text·usage로 정규화', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const fetchSpy = vi.fn(async (url) => (isGroq(url) ? groqOk('{"a":1}') : geminiFail(503)));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM, GROQ_MODEL } = await fresh();
    const { text, meta } = await callLLM('standard', '문단을 만들어', { temperature: 0.6, responseMimeType: 'application/json', responseSchema: { type: 'object' } });
    expect(text).toBe('{"a":1}');
    expect(meta).toMatchObject({ model: GROQ_MODEL, provider: 'groq', fallbackDepth: 2, usage: { in: 7, out: 3, thinking: 0 } });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    const groqCall = fetchSpy.mock.calls[2];
    expect(groqCall[1].headers.Authorization).toBe('Bearer groq-test-key');
    const body = bodyOf(groqCall);
    expect(body).toMatchObject({ model: GROQ_MODEL, temperature: 0.6, stream: false, reasoning_effort: 'none', response_format: { type: 'json_object' } });
    expect(body.messages).toEqual([{ role: 'user', content: '문단을 만들어\n\nJSON 객체 하나로만 응답하세요.' }]);
  });

  it('Groq 평문 모드 — JSON 요청이 아니면 response_format·안내문 없이, temperature 기본 0', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const fetchSpy = vi.fn(async (url) => (isGroq(url) ? groqOk('평문') : geminiFail(503)));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const { text } = await callLLM('light', '해설');
    expect(text).toBe('평문');
    const body = bodyOf(fetchSpy.mock.calls[1]);
    expect(body.response_format).toBeUndefined();
    expect(body.temperature).toBe(0);
    expect(body.messages[0].content).toBe('해설');
  });

  it('Gemini 키가 없고 Groq 키만 있으면 Gemini 체인을 건너뛰고 바로 Groq', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const fetchSpy = vi.fn(async () => groqOk('g'));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const { meta } = await callLLM('standard', 'p');
    expect(meta).toMatchObject({ provider: 'groq', fallbackDepth: 0 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(isGroq(fetchSpy.mock.calls[0][0])).toBe(true);
  });

  it('groq:false — 판별기 관례: Groq 키가 있어도 Gemini만, 실패는 Gemini 상태로 던진다', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const fetchSpy = vi.fn(async () => geminiFail(503));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const err = await callLLM('light', 'p', { groq: false }).catch((e) => e);
    expect(err).toMatchObject({ ok: false, code: 'http', status: 503, provider: 'gemini', model: 'gemini-3.5-flash-lite' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('실패 상태·본문은 Gemini 쪽을 우선한다(Groq도 실패해도 클라 재시도 판정이 현행과 같게)', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const fetchSpy = vi.fn(async (url) => (isGroq(url) ? geminiFail(500, { error: 'groq down' }) : geminiFail(429, { error: { message: 'RESOURCE_EXHAUSTED' } })));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const err = await callLLM('light', 'p').catch((e) => e);
    expect(err).toMatchObject({ status: 429, provider: 'gemini', detail: { error: { message: 'RESOURCE_EXHAUSTED' } } });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('용량 재시도 — retry를 준 호출만, 용량 오류(429·503·네트워크)만, 그 밖(400)은 즉시 다음 후보', async () => {
    const { callLLM } = await fresh();
    const rate = vi.fn(async () => geminiFail(429));
    vi.stubGlobal('fetch', rate);
    let err = await callLLM('light', 'p', { retry: { max: 2, delays: [1, 1] } }).catch((e) => e);
    expect(err.status).toBe(429);
    expect(rate).toHaveBeenCalledTimes(3); // 1 + 재시도 2

    const bad = vi.fn(async () => geminiFail(400, { error: { message: 'bad schema' } }));
    vi.stubGlobal('fetch', bad);
    err = await callLLM('light', 'p', { retry: { max: 2, delays: [1, 1] } }).catch((e) => e);
    expect(err.status).toBe(400);
    expect(bad).toHaveBeenCalledTimes(1);

    const net = vi.fn(async () => { throw new Error('socket hang up'); });
    vi.stubGlobal('fetch', net);
    err = await callLLM('light', 'p', { retry: { max: 1, delays: [1] } }).catch((e) => e);
    expect(err).toMatchObject({ code: 'network', status: 0 });
    expect(net).toHaveBeenCalledTimes(2);

    const none = vi.fn(async () => geminiFail(503));
    vi.stubGlobal('fetch', none);
    await callLLM('light', 'p').catch(() => null); // 기본 retry 0
    expect(none).toHaveBeenCalledTimes(1);
  });

  it('deadline — 넘길 대기는 하지 않고, 지났으면 Groq 폴백도 생략한다', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const fetchSpy = vi.fn(async () => geminiFail(429));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const err = await callLLM('light', 'p', { retry: { max: 3, delays: [5000] }, deadlineMs: Date.now() + 100 }).catch((e) => e);
    expect(err.status).toBe(429);
    expect(fetchSpy).toHaveBeenCalledTimes(2); // Gemini 1(대기 포기) + Groq 1(아직 deadline 전)
    fetchSpy.mockClear();
    await callLLM('light', 'p', { deadlineMs: Date.now() - 1 }).catch(() => null);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Gemini 1, Groq 생략
    expect(isGroq(fetchSpy.mock.calls[0][0])).toBe(false);
  });

  it('contents 배열 입력(프록시) — Gemini엔 inline_data까지 그대로, Groq엔 텍스트 파트만 이어 붙인다', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    const fetchSpy = vi.fn(async (url) => (isGroq(url) ? groqOk('g') : geminiFail(503)));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const contents = [{ parts: [{ text: '이 이미지를 읽어' }, { inline_data: { mime_type: 'image/png', data: 'AAAA' } }, { text: '한국어로' }] }];
    await callLLM('light', contents);
    expect(bodyOf(fetchSpy.mock.calls[0]).contents).toEqual(contents);
    expect(bodyOf(fetchSpy.mock.calls[1]).messages[0].content).toBe('이 이미지를 읽어\n한국어로');
  });

  it('빈 candidates는 실패로 보고 다음 후보로 — 전량 비면 code empty', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) }));
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const err = await callLLM('standard', 'p').catch((e) => e);
    expect(err.code).toBe('empty');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('usage — Gemini usageMetadata를 in/out/thinking으로 정규화하고 ms를 잰다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => geminiOk('ok', { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 })));
    const { callLLM } = await fresh();
    const { meta } = await callLLM('light', 'p');
    expect(meta.usage).toEqual({ in: 10, out: 5, thinking: 2 });
    expect(typeof meta.ms).toBe('number');
  });

  it('signal이 취소됐으면 재시도·폴백 없이 aborted로 던진다', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchSpy = vi.fn(async () => { throw new Error('This operation was aborted'); });
    vi.stubGlobal('fetch', fetchSpy);
    const { callLLM } = await fresh();
    const err = await callLLM('standard', 'p', { signal: controller.signal, retry: { max: 3, delays: [1] } }).catch((e) => e);
    expect(err.code).toBe('aborted');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('isCapacityError — 5곳 관용구의 합집합', async () => {
    const { isCapacityError } = await fresh();
    expect(isCapacityError(429, {})).toBe(true);
    expect(isCapacityError(503, {})).toBe(true);
    expect(isCapacityError(0, {})).toBe(true);
    expect(isCapacityError(500, { error: { message: 'The model is overloaded' } })).toBe(true);
    expect(isCapacityError(500, { error: { message: 'High demand' } })).toBe(true);
    expect(isCapacityError(400, { error: { message: 'Invalid argument' } })).toBe(false);
  });
});

// ── R2 텔레메트리(스키마 0) — 로그 1줄/호출 · 인메모리 집계 · 프롬프트 본문 무기록 ──
describe('AA R2 — 텔레메트리', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('LLM_LOG', 'on');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  const usage = { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 };
  const llmLines = (spy) => spy.mock.calls.filter((c) => c[0] === '[llm]').map((c) => c[1]);

  it('호출마다 성공·실패 무관 [llm] 로그 1줄 — 필수 키 11개(순서 고정), 프롬프트 본문은 싣지 않는다', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (url) => (isGemini(url, 'gemini-3.6-flash') ? geminiFail(503) : geminiOk('ok', usage))));
    const { callLLM, LLM_LOG_KEYS } = await fresh();
    await callLLM('standard', '비밀 프롬프트 본문', { route: 'explain' });
    expect(llmLines(info)).toHaveLength(1);
    const rec = JSON.parse(llmLines(info)[0]);
    expect(Object.keys(rec)).toEqual([...LLM_LOG_KEYS]);
    expect(rec).toMatchObject({
      route: 'explain', tier: 'standard', model: 'gemini-3.5-flash-lite', provider: 'gemini', fallbackDepth: 1,
      in: 10, out: 5, thinking: 2, ok: true, status: 200,
    });
    expect(typeof rec.ms).toBe('number');
    expect(llmLines(info)[0]).not.toContain('비밀 프롬프트 본문');

    vi.stubGlobal('fetch', vi.fn(async () => geminiFail(429)));
    await callLLM('light', '비밀 프롬프트 본문', { route: 'fetchMeanings' }).catch(() => null);
    expect(llmLines(info)).toHaveLength(2);
    const fail = JSON.parse(llmLines(info)[1]);
    expect(Object.keys(fail)).toEqual([...LLM_LOG_KEYS]);
    expect(fail).toMatchObject({
      route: 'fetchMeanings', tier: 'light', model: 'gemini-3.5-flash-lite', provider: 'gemini', fallbackDepth: 0,
      in: 0, out: 0, thinking: 0, ok: false, status: 429,
    });
    expect(llmLines(info)[1]).not.toContain('비밀 프롬프트 본문');
  });

  it('테스트 러너에서는 LLM_LOG=on일 때만 로그를 낸다(스위트 소음 0) — 집계는 그래도 쌓인다', async () => {
    vi.stubEnv('LLM_LOG', '');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => geminiOk('ok')));
    const { callLLM, getLLMStats, resetLLMStats } = await fresh();
    resetLLMStats();
    await callLLM('light', 'p');
    expect(llmLines(info)).toHaveLength(0);
    expect(getLLMStats().tiers.light['gemini-3.5-flash-lite'].calls).toBe(1);
  });

  it('인메모리 집계 — 티어·모델별 calls/ok/in/out/thinking/ms/fallbackUsed, 실패도 calls에 들어가고 ok는 아니다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (url) => (isGemini(url, 'gemini-3.6-flash') ? geminiFail(503) : geminiOk('ok', usage))));
    const { callLLM, getLLMStats, resetLLMStats } = await fresh();
    resetLLMStats();
    await callLLM('standard', 'p');
    await callLLM('light', 'p');
    vi.stubGlobal('fetch', vi.fn(async () => geminiFail(429)));
    await callLLM('light', 'p').catch(() => null);
    const snap = getLLMStats();
    expect(typeof snap.since).toBe('string');
    expect(snap.tiers.standard['gemini-3.5-flash-lite']).toMatchObject({ calls: 1, ok: 1, in: 10, out: 5, thinking: 2, fallbackUsed: 1 });
    expect(snap.tiers.light['gemini-3.5-flash-lite']).toMatchObject({ calls: 2, ok: 1, in: 10, out: 5, thinking: 2, fallbackUsed: 0 });
    expect(snap.tiers.standard['gemini-3.6-flash']).toBeUndefined(); // 답하지 않은 본선은 버킷을 만들지 않는다(fallbackUsed가 그 자리)
    expect(snap.tiers.light['gemini-3.5-flash-lite'].ms).toBeGreaterThanOrEqual(0);
  });

  it('스냅샷은 복사본이고 reset은 창을 새로 연다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => geminiOk('ok')));
    const { callLLM, getLLMStats, resetLLMStats } = await fresh();
    resetLLMStats();
    const before = getLLMStats().since;
    await callLLM('light', 'p');
    const snap = getLLMStats();
    snap.tiers.light['gemini-3.5-flash-lite'].calls = 999;
    expect(getLLMStats().tiers.light['gemini-3.5-flash-lite'].calls).toBe(1);
    resetLLMStats();
    expect(getLLMStats().tiers).toEqual({});
    expect(getLLMStats().since >= before).toBe(true);
  });

  it('Groq 사용량이 Gemini와 같은 키(in/out/thinking)로 로그·집계된다', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
    vi.stubGlobal('fetch', vi.fn(async (url) => (isGroq(url) ? groqOk('g') : geminiFail(503))));
    const { callLLM, getLLMStats, resetLLMStats, GROQ_MODEL } = await fresh();
    resetLLMStats();
    await callLLM('light', 'p', { route: 'x' });
    expect(JSON.parse(llmLines(info)[0])).toMatchObject({ provider: 'groq', model: GROQ_MODEL, in: 7, out: 3, thinking: 0, ok: true, fallbackDepth: 1 });
    expect(getLLMStats().tiers.light[GROQ_MODEL]).toMatchObject({ calls: 1, ok: 1, in: 7, out: 3, thinking: 0, fallbackUsed: 1 });
  });

  it('관리자 라우트 — requireAdmin 게이트 위에서 getLLMStats를 그대로 돌려준다(소스 계약)', () => {
    const src = read('src/app/api/admin/llm-stats/route.js');
    expect(src).toContain("import { requireAdmin } from '../../../../lib/server/auth.js'");
    expect(src).toContain('const auth = await requireAdmin(request);');
    expect(src).toContain('if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });');
    expect(src).toContain('getLLMStats()');
    expect(src).not.toContain('SUPABASE_SERVICE_ROLE_KEY'); // 게이트는 auth.js 관용구 하나 — 자기 복사본 0
  });
});
