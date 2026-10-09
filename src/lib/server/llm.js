// 서버 전용 — LLM 프로바이더 레이어 (v2-AA R1, #1077 코멘트 5551860999).
//
// 왜: Gemini 호출이 5곳(api/gemini 프록시 · explain · study-paragraph · writing-feedback ·
// fetchMeanings, 거기에 disambiguateZhPos/EnPos의 URL 직접 호출)에 각자 복사돼 모델 문자열·
// 폴백 순서·Groq 응답 변환·용량 재시도가 다섯 번 반복됐다. 호출부는 **티어**(light/standard)만
// 말하고, 모델·폴백·프로바이더는 이 파일의 표 한 곳이 정한다. 모델 식별자(`gemini-…`·`openai/gpt-oss-…`)와
// Gemini 엔드포인트가 사는 곳은 리포에서 이 파일(+ 별 라인인 api/tts)뿐 — llm.test.js가 grep으로 잡는다.
//
// 동작 계약(R1 — 호출부 동작 무변경):
//  - 호출부의 generationConfig(temperature·responseSchema·responseMimeType·maxOutputTokens)는
//    인자로 받은 그대로 요청 본문에 실린다.
//  - thinking 기본 off: off일 때 요청 본문에 최소 thinking 설정(THINKING_OFF_CONFIG)을 싣는다.
//    모델이 그 필드를 거부(400, 메시지에 thinking)하면 같은 모델을 그 설정 없이 즉시 1회 재요청하고
//    이후 그 모델엔 싣지 않는다 — 설정 하나 때문에 폴백 모델로 강등되는 일이 없게.
//  - 폴백: 티어의 primary → fallbacks 순, 마지막에 Groq(키가 있고 groq:false가 아닐 때).
//    Groq 응답은 Gemini candidates 형식으로 정규화한다(기존 프록시의 변환 로직 이전).
//  - 재시도: 용량 오류(429·503·네트워크·high demand/overloaded/unavailable/resource_exhausted)만,
//    호출부가 retry를 줄 때만(기본 0). deadline을 넘길 대기는 하지 않는다(fetchMeanings 관례 이전).
//  - 실패는 LLMError(ok:false · code · status · detail)로 던진다. 키가 둘 다 없으면 code 'no_key'.
//    status·detail은 Gemini 쪽 마지막 응답을 우선한다(프록시가 클라에 그대로 되돌려 클라 재시도
//    판정(isCapacityError)이 현행과 같게).
//  - 텔레메트리(R2, 스키마 0): 성공·실패 무관 호출마다 `[llm]` 구조화 로그 1줄(필수 키 11 — route·tier·model·
//    provider·fallbackDepth·ms·in·out·thinking·ok·status, 프롬프트 본문은 절대 싣지 않는다) + 인메모리 티어·모델별
//    집계(getLLMStats — 인스턴스 재시작에 초기화되므로 로그가 정본, 집계는 창). 테스트 러너(VITEST)에서는
//    LLM_LOG=on일 때만 로그를 낸다.

/** 티어 표 — 호출부는 이 이름만 안다. 폴백 모델 출력 단가는 본선 이하여야 한다(R3에서 확정). */
export const TIERS = Object.freeze({
  light: Object.freeze({ primary: 'gemini-3.5-flash-lite', fallbacks: Object.freeze([]) }),
  standard: Object.freeze({ primary: 'gemini-3.6-flash', fallbacks: Object.freeze(['gemini-3.5-flash-lite']) }),
});
export const TIER_NAMES = Object.freeze(Object.keys(TIERS));

/**
 * Groq 최종 폴백 — production(GA) 모델. preview(qwen3-32b → qwen3.6-27b)는 두 번 퇴역해 폴백이 죽었다
 * (#1077 AA R3-a). 출력 단가가 본선 lite보다 낮다(폴백 단가 ≤ 본선 원칙).
 */
export const GROQ_MODEL = 'openai/gpt-oss-120b';

/**
 * 구버전 클라 번들 하위호환 — 배포 직후 캐시된 클라가 보내는 body.model(옛 이름)을 티어로 매핑한다.
 * 목록 밖은 400(현행 allowlist 의미 유지). 2.5 매핑 두 줄은 R1 뒤 한 릴리스 유지 조건이 차 R3-a에서
 * 삭제했다(2.5-flash 2026-10-16 퇴역, 2.5-Lite 승격 안 함) — 이제 2.5 이름은 400이다.
 */
export const LEGACY_MODEL_TIERS = Object.freeze({
  'models/gemini-3.6-flash': 'standard',
  'models/gemini-3.5-flash-lite': 'light',
});

/** 현재 Gemini 3 Flash/Lite의 최소 추론 설정. 완전 off는 지원하지 않는다.
 * https://ai.google.dev/gemini-api/docs/generate-content/thinking#thinking-levels
 * 2.5용 budget:0은 일반 INVALID_ARGUMENT(400)으로 거절될 수 있다.
 */
export const THINKING_OFF_CONFIG = Object.freeze({ thinkingLevel: 'minimal' });
export const DEFAULT_RETRY_DELAYS = Object.freeze([5000, 10000, 20000, 40000]);

/** 구조화 로그 1줄의 필수 키 — 순서 고정(로그 grep·집계 파서가 기댄다). */
export const LLM_LOG_KEYS = Object.freeze([
  'route', 'tier', 'model', 'provider', 'fallbackDepth', 'ms', 'in', 'out', 'thinking', 'ok', 'status',
]);

/** 인메모리 집계(인스턴스 로컬) — 로그가 정본, 이건 창. `since`가 창의 시작. */
let stats = { since: new Date().toISOString(), tiers: {} };

function bucket(tier, model) {
  const t = (stats.tiers[tier] ||= {});
  return (t[model || 'none'] ||= { calls: 0, ok: 0, in: 0, out: 0, thinking: 0, ms: 0, fallbackUsed: 0 });
}

/** 호출 1건 관측 — 로그 1줄 + 집계 갱신. 프롬프트 본문은 어디에도 싣지 않는다. */
function observe(record) {
  const line = {};
  for (const key of LLM_LOG_KEYS) line[key] = record[key] ?? null;
  if (!process.env.VITEST || process.env.LLM_LOG === 'on') console.info('[llm]', JSON.stringify(line));
  const b = bucket(record.tier, record.model);
  b.calls += 1;
  if (record.ok) b.ok += 1;
  b.in += Number(record.in) || 0;
  b.out += Number(record.out) || 0;
  b.thinking += Number(record.thinking) || 0;
  b.ms += Number(record.ms) || 0;
  if (record.ok && record.fallbackDepth > 0) b.fallbackUsed += 1;
}

/** 관리자 조회용 스냅샷(깊은 복사) — /api/admin/llm-stats. */
export function getLLMStats() {
  return JSON.parse(JSON.stringify(stats));
}

/** 테스트·운영 리셋 — 창을 새로 연다. */
export function resetLLMStats() {
  stats = { since: new Date().toISOString(), tiers: {} };
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const CAPACITY_WORDS = ['high demand', 'overloaded', 'unavailable', 'resource_exhausted'];
const GENERATION_KEYS = ['temperature', 'responseMimeType', 'responseSchema', 'maxOutputTokens'];

/** thinking 설정을 거부한 모델(인스턴스 로컬) — 같은 모델에 두 번 부딪히지 않는다. */
const thinkingUnsupported = new Set();

export class LLMError extends Error {
  constructor(message, { code = 'failed', status = 0, detail = null, model = null, provider = null, fallbackDepth = 0 } = {}) {
    super(message);
    this.name = 'LLMError';
    this.ok = false;
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.model = model;
    this.provider = provider;
    this.fallbackDepth = fallbackDepth;
  }
}

/**
 * 프록시용 — body.tier 우선, 없으면 body.model(하위호환 힌트)을 티어로. 둘 다 없으면 standard(현행 기본 모델).
 * @returns {{ tier: string } | { error: 'unsupported_tier' | 'unsupported_model' }}
 */
export function resolveTier({ tier, model } = {}) {
  if (tier != null) return TIERS[tier] ? { tier } : { error: 'unsupported_tier' };
  if (model != null) {
    const mapped = LEGACY_MODEL_TIERS[model];
    return mapped ? { tier: mapped } : { error: 'unsupported_model' };
  }
  return { tier: 'standard' };
}

/** 용량 오류 판정 — 기존 5곳 관용구의 합집합(상태 0은 네트워크 실패). */
export function isCapacityError(status, detail) {
  if (status === 429 || status === 503 || status === 0) return true;
  const text = JSON.stringify(detail ?? '').toLowerCase();
  return CAPACITY_WORDS.some((w) => text.includes(w));
}

function toContents(input) {
  if (typeof input === 'string') return [{ parts: [{ text: input }] }];
  return Array.isArray(input) ? input : [];
}

function flattenText(contents) {
  return contents
    .flatMap((c) => (c?.parts || []).map((p) => (typeof p?.text === 'string' ? p.text : '')))
    .filter(Boolean)
    .join('\n');
}

function buildGenerationConfig(opts) {
  const cfg = { ...(opts.generationConfig || {}) };
  for (const key of GENERATION_KEYS) if (opts[key] !== undefined) cfg[key] = opts[key];
  return cfg;
}

function makeSignal(signal, timeoutMs) {
  const parts = [];
  if (signal) parts.push(signal);
  if (Number(timeoutMs) > 0) parts.push(AbortSignal.timeout(Number(timeoutMs)));
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return typeof AbortSignal.any === 'function' ? AbortSignal.any(parts) : parts[0];
}

const normalizeGeminiUsage = (u) => ({
  in: Number(u?.promptTokenCount) || 0,
  out: Number(u?.candidatesTokenCount) || 0,
  thinking: Number(u?.thoughtsTokenCount) || 0,
});
// gpt-oss는 completion_tokens에 추론 토큰을 포함해 센다 — Gemini(candidatesTokenCount는 추론 제외)와
// 집계 단위를 맞추려고 reasoning_tokens를 thinking으로 떼어 내고 out에서 뺀다. 필드가 없으면 thinking 0.
const normalizeGroqUsage = (u) => {
  const completion = Number(u?.completion_tokens) || 0;
  const thinking = Number(u?.completion_tokens_details?.reasoning_tokens) || 0;
  return {
    in: Number(u?.prompt_tokens) || 0,
    out: Math.max(0, completion - thinking),
    thinking,
  };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mentionsThinking = (detail) => JSON.stringify(detail ?? '').toLowerCase().includes('thinking');

async function geminiOnce(model, contents, generationConfig, { apiKey, signal }) {
  let res;
  let data;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ contents, generationConfig }),
    });
    data = await res.json();
  } catch (e) {
    return { ok: false, status: 0, code: 'network', detail: { error: e?.message || 'fetch failed' } };
  }
  if (!res.ok) return { ok: false, status: res.status, code: 'http', detail: data };
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, status: res.status, code: 'empty', detail: data };
  return { ok: true, status: res.status, text, usage: normalizeGeminiUsage(data?.usageMetadata) };
}

async function groqOnce(contents, generationConfig, { groqKey, signal }) {
  const wantJson = generationConfig?.responseMimeType === 'application/json';
  const promptText = flattenText(contents) + (wantJson ? '\n\nJSON 객체 하나로만 응답하세요.' : '');
  let res;
  let data;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      signal,
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: promptText }],
        temperature: generationConfig?.temperature ?? 0,
        stream: false,
        // gpt-oss는 추론을 끌 수 없어 최소치 low(low|medium|high만 받는다 — 'none'은 qwen 전용이라 400)
        reasoning_effort: 'low',
        ...(wantJson ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    data = await res.json();
  } catch (e) {
    return { ok: false, status: 0, code: 'network', detail: { error: e?.message || 'fetch failed' } };
  }
  if (!res.ok) return { ok: false, status: res.status, code: 'http', detail: data };
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { ok: false, status: res.status, code: 'empty', detail: data };
  return { ok: true, status: res.status, text, usage: normalizeGroqUsage(data?.usage) };
}

// ───────────── 모델 비교 측정 전용(LLM-BENCH-001, #1077 AA R3-b) ─────────────
// 관리자 측정 API(/api/admin/llm-bench)만 부른다. callLLM(운영 경로)·티어·폴백·텔레메트리와 무관하다 —
// 여기 모델은 운영 요청에 쓰이지 않는다. 모델 식별자가 이 파일에만 산다는 계약(llm.test.js)을 따라 표를 여기에 둔다.
// 단가($/MTok, 입력·출력)는 2026-10-09 공개가 — 비교용 추정이며 청구액이 아니다.
export const BENCH_MODELS = Object.freeze({
  'gemini-3.6-flash': Object.freeze({ provider: 'gemini', model: 'gemini-3.6-flash', env: 'GEMINI_API_KEY', label: 'Gemini 3.6 Flash (standard 현행)', price: [0.75, 3.75] }),
  'gemini-3.5-flash-lite': Object.freeze({ provider: 'gemini', model: 'gemini-3.5-flash-lite', env: 'GEMINI_API_KEY', label: 'Gemini 3.5 Flash-Lite (light 현행)', price: [0.30, 2.50] }),
  'gpt-oss-120b': Object.freeze({ provider: 'groq', model: GROQ_MODEL, env: 'GROQ_API_KEY', label: 'Groq gpt-oss-120b (최종 폴백)', price: [0.15, 0.60] }),
  'claude-haiku-5-5': Object.freeze({ provider: 'anthropic', model: 'claude-haiku-5-5', env: 'ANTHROPIC_API_KEY', label: 'Claude Haiku 5.5 (thinking 끔)', price: [0.10, 0.50] }),
  'gpt-6-luna': Object.freeze({ provider: 'openai', model: 'gpt-6-luna', env: 'OPENAI_API_KEY', label: 'GPT-6 Luna (reasoning none)', price: [0.10, 0.50] }),
});
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
// Gemini 밖 모델에는 JSON 강제 모드를 쓰지 않는다 — 우리 프롬프트는 배열을 요구하는데 json_object는 객체만 허용한다.
// 대신 같은 꼬리 한 줄을 세 모델에 똑같이 붙인다(공정 비교).
const BENCH_JSON_TAIL = '\n\nJSON만 출력하세요(설명·코드 블록 없이).';

async function openAICompatOnce(endpoint, key, body, signal) {
  let res;
  let data;
  try {
    res = await fetch(endpoint, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    data = await res.json();
  } catch (e) {
    return { ok: false, status: 0, code: 'network', detail: { error: e?.message || 'fetch failed' } };
  }
  if (!res.ok) return { ok: false, status: res.status, code: 'http', detail: data };
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { ok: false, status: res.status, code: 'empty', detail: data };
  return { ok: true, status: res.status, text, usage: normalizeGroqUsage(data?.usage) };
}

async function anthropicOnce(model, prompt, { key, signal, maxTokens }) {
  // 지연 로드 — 이 SDK는 측정 경로에서만 쓰여 운영 함수 번들에 싣지 않는다.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: key, maxRetries: 0 });
  try {
    // Haiku 5.5: 샘플링 인자(temperature 등)는 400 — 보내지 않는다. thinking 끔은 effort high 이하에서만 허용.
    const msg = await client.messages.create({
      model, max_tokens: maxTokens,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: prompt }],
    }, { signal });
    if (msg.stop_reason === 'refusal') return { ok: false, status: 200, code: 'refusal', detail: { stop_reason: 'refusal' } };
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!text) return { ok: false, status: 200, code: 'empty', detail: { stop_reason: msg.stop_reason } };
    return { ok: true, status: 200, text, usage: { in: msg.usage?.input_tokens || 0, out: msg.usage?.output_tokens || 0, thinking: 0 }, stop: msg.stop_reason };
  } catch (e) {
    if (e instanceof Anthropic.APIError) return { ok: false, status: e.status || 0, code: 'http', detail: { type: e.error?.error?.type || null, message: e.message } };
    return { ok: false, status: 0, code: 'network', detail: { error: e?.message || 'failed' } };
  }
}

/**
 * 측정 1회 — 같은 프롬프트를 모델 하나에. 운영과 같게: Gemini는 THINKING_OFF_CONFIG(+ 호출부의 temperature 0·JSON MIME),
 * Groq는 reasoning low, Luna는 reasoning none, Haiku는 thinking 끔·effort low.
 * @returns {Promise<{ok, text?, ms, usage?, status, code?, detail?}>} — 던지지 않는다. 키 없음은 code 'no_key'.
 */
export async function benchOnce(id, prompt, { json = false, timeoutMs = 45_000, maxTokens = 4096 } = {}) {
  const spec = BENCH_MODELS[id];
  if (!spec) return { ok: false, code: 'unknown_model', status: 400, ms: 0 };
  const key = process.env[spec.env];
  if (!key) return { ok: false, code: 'no_key', status: 0, ms: 0 };
  const started = Date.now();
  const signal = makeSignal(null, timeoutMs);
  const tailed = json ? prompt + BENCH_JSON_TAIL : prompt;
  let r;
  if (spec.provider === 'gemini') {
    const cfg = { temperature: 0, ...(json ? { responseMimeType: 'application/json' } : {}), thinkingConfig: THINKING_OFF_CONFIG };
    r = await geminiOnce(spec.model, toContents(prompt), cfg, { apiKey: key, signal });
    if (!r.ok && r.status === 400 && mentionsThinking(r.detail)) {
      const { thinkingConfig: _drop, ...plain } = cfg;
      r = await geminiOnce(spec.model, toContents(prompt), plain, { apiKey: key, signal: makeSignal(null, timeoutMs) });
    }
  } else if (spec.provider === 'groq') {
    r = await openAICompatOnce(GROQ_ENDPOINT, key, { model: spec.model, messages: [{ role: 'user', content: tailed }], temperature: 0, stream: false, reasoning_effort: 'low' }, signal);
  } else if (spec.provider === 'openai') {
    // 추론 모델은 기본값 밖 temperature를 거부할 수 있어 보내지 않는다.
    r = await openAICompatOnce(OPENAI_ENDPOINT, key, { model: spec.model, messages: [{ role: 'user', content: tailed }], reasoning_effort: 'none' }, signal);
  } else {
    r = await anthropicOnce(spec.model, tailed, { key, signal, maxTokens });
  }
  return { ...r, ms: Date.now() - started };
}

/**
 * LLM 호출 — 티어만 말한다.
 * @param {'light'|'standard'} tier
 * @param {string|Array} input - 프롬프트 문자열 또는 Gemini contents 배열(프록시 — inline_data 포함 가능)
 * @param {object} [opts]
 * @param {number} [opts.temperature] · {string} [opts.responseMimeType] · {object} [opts.responseSchema] ·
 *   {number} [opts.maxOutputTokens] — generationConfig 필드(그대로 실린다)
 * @param {object} [opts.generationConfig] - 위 넷 밖의 필드까지 통째로 넘길 때(프록시 패스스루)
 * @param {'off'|'on'} [opts.thinking='off']
 * @param {AbortSignal} [opts.signal] · {number} [opts.timeoutMs] · {number} [opts.groqTimeoutMs]
 * @param {{max:number, delays?:number[]}} [opts.retry] - 용량 오류 재시도(기본 0회)
 * @param {number|null} [opts.deadlineMs] - 이 시각을 넘길 대기·폴백은 하지 않는다
 * @param {boolean} [opts.groq=true] - false면 Groq 최종 폴백을 쓰지 않는다(판별기 관례)
 * @param {string} [opts.route] - 텔레메트리 라벨(R2)
 * @returns {Promise<{ text: string, meta: { tier, model, provider, fallbackDepth, ms, usage, route } }>}
 * @throws {LLMError}
 */
export async function callLLM(tier, input, opts = {}) {
  const started = Date.now();
  const route = opts.route || null;
  try {
    const result = await callLLMInner(tier, input, opts, started);
    const { meta } = result;
    observe({
      route, tier, model: meta.model, provider: meta.provider, fallbackDepth: meta.fallbackDepth, ms: meta.ms,
      in: meta.usage.in, out: meta.usage.out, thinking: meta.usage.thinking, ok: true, status: 200,
    });
    return result;
  } catch (err) {
    observe({
      route, tier, model: err?.model ?? null, provider: err?.provider ?? null, fallbackDepth: err?.fallbackDepth ?? 0,
      ms: Date.now() - started, in: 0, out: 0, thinking: 0, ok: false, status: err?.status ?? 0,
    });
    throw err;
  }
}

async function callLLMInner(tier, input, opts, started) {
  const spec = TIERS[tier];
  if (!spec) throw new LLMError(`unknown tier: ${tier}`, { code: 'unknown_tier', status: 400 });
  const apiKey = process.env.GEMINI_API_KEY;
  const groqKey = opts.groq === false ? '' : process.env.GROQ_API_KEY;
  if (!apiKey && !groqKey) throw new LLMError('LLM API key missing', { code: 'no_key', status: 500 });

  const contents = toContents(input);
  const generationConfig = buildGenerationConfig(opts);
  const thinkingOff = opts.thinking !== 'on' && !generationConfig.thinkingConfig;
  const retryMax = Math.max(0, Number(opts.retry?.max) || 0);
  const delays = opts.retry?.delays || DEFAULT_RETRY_DELAYS;
  const deadlineMs = opts.deadlineMs ?? null;
  const pastDeadline = () => deadlineMs != null && Date.now() >= deadlineMs;
  const route = opts.route || null;
  const meta = (model, provider, depth, usage) => ({
    tier, model, provider, fallbackDepth: depth, ms: Date.now() - started, usage, route,
  });

  const chain = apiKey ? [spec.primary, ...spec.fallbacks] : [];
  let lastGemini = null;
  let last = null;
  let depth = 0;
  let giveUp = false;
  for (const model of chain) {
    for (let attempt = 0; attempt <= retryMax; attempt++) {
      const withThinking = thinkingOff && !thinkingUnsupported.has(model);
      const cfg = withThinking ? { ...generationConfig, thinkingConfig: THINKING_OFF_CONFIG } : generationConfig;
      const signal = makeSignal(opts.signal, opts.timeoutMs);
      let r = await geminiOnce(model, contents, cfg, { apiKey, signal });
      if (!r.ok && r.status === 400 && withThinking && mentionsThinking(r.detail)) {
        thinkingUnsupported.add(model);
        r = await geminiOnce(model, contents, generationConfig, { apiKey, signal: makeSignal(opts.signal, opts.timeoutMs) });
      }
      if (r.ok) return { text: r.text, meta: meta(model, 'gemini', depth, r.usage) };
      last = lastGemini = { ...r, model, provider: 'gemini' };
      if (opts.signal?.aborted) {
        throw new LLMError('aborted', { code: 'aborted', status: 0, model, provider: 'gemini', fallbackDepth: depth });
      }
      if (attempt === retryMax || !isCapacityError(r.status, r.detail)) break;
      const delay = delays[attempt] ?? delays[delays.length - 1] ?? 0;
      if (deadlineMs != null && Date.now() + delay >= deadlineMs) { giveUp = true; break; }
      console.warn(`[llm] capacity retry ${attempt + 1}/${retryMax} in ${delay}ms (${model} ${r.status})`);
      await sleep(delay);
    }
    depth++;
    if (giveUp) break;
  }

  if (groqKey && !pastDeadline()) {
    const r = await groqOnce(contents, generationConfig, {
      groqKey, signal: makeSignal(opts.signal, opts.groqTimeoutMs ?? opts.timeoutMs),
    });
    if (r.ok) return { text: r.text, meta: meta(GROQ_MODEL, 'groq', chain.length, r.usage) };
    last = { ...r, model: GROQ_MODEL, provider: 'groq' };
  }

  const primary = lastGemini || last;
  throw new LLMError(
    primary ? `LLM ${primary.provider} ${primary.model} failed (${primary.code} ${primary.status})` : 'LLM unavailable',
    {
      code: primary?.code || 'exhausted',
      status: primary?.status ?? 0,
      detail: primary?.detail ?? null,
      model: primary?.model ?? null,
      provider: primary?.provider ?? null,
      fallbackDepth: primary?.provider === 'groq' ? chain.length : Math.max(0, depth - 1),
    },
  );
}
