// 서버 전용 — LLM 프로바이더 레이어 (v2-AA R1, #1077 코멘트 5551860999).
//
// 왜: Gemini 호출이 5곳(api/gemini 프록시 · explain · study-paragraph · writing-feedback ·
// fetchMeanings, 거기에 disambiguateZhPos/EnPos의 URL 직접 호출)에 각자 복사돼 모델 문자열·
// 폴백 순서·Groq 응답 변환·용량 재시도가 다섯 번 반복됐다. 호출부는 **티어**(light/standard)만
// 말하고, 모델·폴백·프로바이더는 이 파일의 표 한 곳이 정한다. 모델 식별자(`gemini-…`·`qwen/…`)와
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
//  - 텔레메트리(구조화 로그·집계)는 R2. R1은 meta(모델·프로바이더·폴백 깊이·ms·usage)만 돌려준다.

/** 티어 표 — 호출부는 이 이름만 안다. 폴백 모델 출력 단가는 본선 이하여야 한다(R3에서 확정). */
export const TIERS = Object.freeze({
  light: Object.freeze({ primary: 'gemini-3.5-flash-lite', fallbacks: Object.freeze([]) }),
  standard: Object.freeze({ primary: 'gemini-3.6-flash', fallbacks: Object.freeze(['gemini-3.5-flash-lite']) }),
});
export const TIER_NAMES = Object.freeze(Object.keys(TIERS));

/** Groq 최종 폴백 — preview 모델. R3에서 GA·저가 모델로 교체(#1077 5551860999 §R3). */
export const GROQ_MODEL = 'qwen/qwen3.6-27b';

/**
 * 구버전 클라 번들 하위호환 — 배포 직후 캐시된 클라가 보내는 body.model(옛 이름)을 티어로 매핑한다.
 * 목록 밖은 400(현행 allowlist 의미 유지). 한 릴리스 유지 뒤 제거. 2.5-flash는 2026-10-16 퇴역(R3에서 삭제).
 */
export const LEGACY_MODEL_TIERS = Object.freeze({
  'models/gemini-3.6-flash': 'standard',
  'models/gemini-2.5-flash': 'standard',
  'models/gemini-3.5-flash-lite': 'light',
  'models/gemini-2.5-flash-lite': 'light',
});

/** thinking off의 최소 설정 — 한 곳에서만 바꾼다. */
export const THINKING_OFF_CONFIG = Object.freeze({ thinkingBudget: 0 });
export const DEFAULT_RETRY_DELAYS = Object.freeze([5000, 10000, 20000, 40000]);

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const CAPACITY_WORDS = ['high demand', 'overloaded', 'unavailable', 'resource_exhausted'];
const GENERATION_KEYS = ['temperature', 'responseMimeType', 'responseSchema', 'maxOutputTokens'];

/** thinking 설정을 거부한 모델(인스턴스 로컬) — 같은 모델에 두 번 부딪히지 않는다. */
const thinkingUnsupported = new Set();

export class LLMError extends Error {
  constructor(message, { code = 'failed', status = 0, detail = null, model = null, provider = null } = {}) {
    super(message);
    this.name = 'LLMError';
    this.ok = false;
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.model = model;
    this.provider = provider;
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
const normalizeGroqUsage = (u) => ({
  in: Number(u?.prompt_tokens) || 0,
  out: Number(u?.completion_tokens) || 0,
  thinking: 0,
});
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
        // Qwen thinking 모드 비활성화(불필요한 추론 토큰 낭비 방지) — 기존 5곳 공통
        reasoning_effort: 'none',
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
  const spec = TIERS[tier];
  if (!spec) throw new LLMError(`unknown tier: ${tier}`, { code: 'unknown_tier', status: 400 });
  const started = Date.now();
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
        throw new LLMError('aborted', { code: 'aborted', status: 0, model, provider: 'gemini' });
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
    },
  );
}
