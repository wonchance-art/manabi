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
//  - Claude 본선(LLM-CLAUDE-001, 오너 결정 2026-10-17 KST — Gemini 선불 크레딧 소진 402 후속): ANTHROPIC_API_KEY가 있으면
//    후보 순서가 Claude(ANTHROPIC_TIERS · 품질 경로는 ANTHROPIC_QUALITY) → Gemini(키가 있을 때) → Groq가 된다. 키가 없으면
//    후보 목록에 Claude가 없어 위 Gemini → Groq 경로와 요청·순서·오류가 그대로다. 형식 변환(contents/parts → messages,
//    responseSchema → structured output, JSON MIME만 있으면 꼬리 한 줄 + 추출)은 이 파일의 anthropic* 함수 한 곳이다.
//    샘플링 인자(temperature 등)는 Claude Haiku 5.5 · Sonnet 5.5가 거부(400)해 싣지 않는다.

// 「서비스 설정」 판정의 정본은 errorMessage.js 한 곳(서버 · 클라 · 안내 문구가 같이 쓴다 — GEMINI-402-GUARD).
import { isServiceConfigError } from '../errorMessage.js';
export { isServiceConfigError };

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
 * Claude 모델별 요청 설정 — 운영(callLLM)과 측정(benchOnce)이 같은 표를 쓴다.
 * thinkingOff: 운영 thinking 기본 off일 때 싣는 값. Haiku 5.5는 disabled(effort high 이하에서만 허용),
 * Sonnet 5.5는 disabled가 400이라 between_tools(도구 없는 요청에서는 추론 없음, effort high 이하에서만 허용).
 */
export const ANTHROPIC_MODELS = Object.freeze({
  'claude-haiku-5-5': Object.freeze({ thinkingOff: Object.freeze({ type: 'disabled' }), effort: 'low' }),
  'claude-sonnet-5-5': Object.freeze({ thinkingOff: Object.freeze({ type: 'between_tools' }), effort: 'medium' }),
});

/** Claude 티어 표 — ANTHROPIC_API_KEY가 있을 때만 쓰인다. 대량 · 반복 과제(뜻 조회 · 품사 판별 · 수업 조회 · 프록시)는 Haiku. */
export const ANTHROPIC_TIERS = Object.freeze({
  light: Object.freeze({ primary: 'claude-haiku-5-5', fallbacks: Object.freeze([]) }),
  standard: Object.freeze({ primary: 'claude-haiku-5-5', fallbacks: Object.freeze([]) }),
});

/**
 * 품질 경로 — standard 호출 중 품질 체감이 큰 과제(회화 · 작문 첨삭 · 오늘의 문단)와 뜻 검증(생성기 Haiku와 다른 모델이어야
 * 자기 승인이 아니다 — fetchMeanings verifyMeaningBatch의 'self' 규칙)은 Sonnet 5.5, 막히면 Haiku로. 호출부는 지금처럼
 * 티어 + route(텔레메트리 라벨)만 말한다 — 라벨이 바뀌면 llm.test가 잡는다(조용히 Haiku로 떨어지지 않게).
 */
export const ANTHROPIC_QUALITY = Object.freeze({ primary: 'claude-sonnet-5-5', fallbacks: Object.freeze(['claude-haiku-5-5']) });
export const ANTHROPIC_QUALITY_ROUTES = Object.freeze(['conversation-turn', 'writing-feedback', 'study-paragraph', 'verifyMeanings']);

/** 이 호출이 Claude로 갈 때의 모델 순서(키가 없으면 빈 배열). */
export function anthropicChain(tier, route) {
  if (!process.env.ANTHROPIC_API_KEY || !ANTHROPIC_TIERS[tier]) return [];
  const spec = tier === 'standard' && ANTHROPIC_QUALITY_ROUTES.includes(route) ? ANTHROPIC_QUALITY : ANTHROPIC_TIERS[tier];
  return [spec.primary, ...spec.fallbacks];
}

export { hasPrimaryLLMKey } from './llmKeys.js';

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

/** 용량 오류 판정 — 기존 5곳 관용구의 합집합(상태 0은 네트워크 실패). 「서비스 설정」(결제 · 크레딧)은 429로 와도 용량이 아니다. */
export function isCapacityError(status, detail) {
  if (isServiceConfigError(status, detail)) return false;
  if (status === 429 || status === 503 || status === 529 || status === 0) return true; // 529 = Anthropic overloaded_error
  const text = JSON.stringify(detail ?? '').toLowerCase();
  return CAPACITY_WORDS.some((w) => text.includes(w));
}

/** 제공자 단위 「서비스 설정」 — 공통 판정 + Anthropic 401(키) · 403(권한)은 기다려도 풀리지 않는 설정 문제다. */
function isProviderConfigError(provider, status, detail) {
  if (isServiceConfigError(status, detail)) return true;
  return provider === 'anthropic' && (status === 401 || status === 403);
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

// ───────────── Claude(Anthropic) — 운영 본선(LLM-CLAUDE-001) ─────────────
// SDK는 지연 로드한다(키가 없는 배포 · Gemini 경로에서는 불러오지 않는다). 재시도는 SDK가 아니라 위 체인이 한다(maxRetries 0).

/** JSON MIME만 있고 스키마가 없을 때 붙이는 꼬리 — Groq의 「JSON 객체」 꼬리와 달리 배열 응답도 허용한다(측정 꼬리와 같은 말). */
const ANTHROPIC_JSON_TAIL = '\n\nJSON만 출력하세요(설명·코드 블록 없이).';
const ANTHROPIC_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
// 비스트리밍 요청은 SDK가 max_tokens로 예상 시간을 재 10분을 넘으면 거부한다 — 그 아래(≈21K)에서 넉넉히.
const ANTHROPIC_DEFAULT_MAX_TOKENS = 16000;
const ANTHROPIC_MAX_TOKENS_CAP = 20000;
/** Claude가 거부한 선택 필드(인스턴스 로컬) — `${model}:thinking`. 같은 모델에 두 번 부딪히지 않는다(Gemini thinking 메모와 같은 관례). */
const anthropicRejected = new Set();

/**
 * Gemini responseSchema(OpenAPI 부분집합 — 대문자 type · nullable) → Claude structured output JSON Schema.
 * 모든 객체에 additionalProperties:false(필수), nullable은 anyOf[…, null], 지원 밖 키워드(propertyOrdering · min/max 등)는 버린다.
 * 의미(필드 · 필수 · enum · 설명)는 그대로 옮긴다.
 */
export function toClaudeSchema(schema) {
  if (!schema || typeof schema !== 'object') return {};
  const out = {};
  const type = typeof schema.type === 'string' ? schema.type.toLowerCase() : null;
  if (type) out.type = type;
  if (typeof schema.description === 'string' && schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = [...schema.enum];
  if (type === 'object' || (!type && schema.properties)) {
    out.type = 'object';
    out.properties = {};
    for (const [key, value] of Object.entries(schema.properties || {})) out.properties[key] = toClaudeSchema(value);
    const required = (schema.required || []).filter((key) => key in out.properties);
    if (required.length) out.required = required;
    out.additionalProperties = false;
  }
  if (type === 'array' && schema.items) out.items = toClaudeSchema(schema.items);
  if (Array.isArray(schema.anyOf)) out.anyOf = schema.anyOf.map(toClaudeSchema);
  return schema.nullable === true ? { anyOf: [out, { type: 'null' }] } : out;
}

/**
 * 입력 → Claude messages. 문자열은 user 한 턴(문자열 그대로). Gemini contents는 role model → assistant, 파트 순서 유지,
 * text → text 블록, inline_data/inlineData 이미지 → image 블록, PDF → document 블록. 그 밖의 파트(오디오 · fileData 등)는
 * 옮기지 않고 unsupported로 돌려준다 — 체인이 다음 제공자로 넘긴다.
 */
export function toAnthropicMessages(input, { jsonTail = false } = {}) {
  if (typeof input === 'string') return { messages: [{ role: 'user', content: jsonTail ? input + ANTHROPIC_JSON_TAIL : input }] };
  const messages = [];
  for (const c of toContents(input)) {
    const blocks = [];
    for (const p of c?.parts || []) {
      if (typeof p?.text === 'string') { if (p.text) blocks.push({ type: 'text', text: p.text }); continue; }
      const inline = p?.inline_data || p?.inlineData;
      const mime = inline?.mime_type || inline?.mimeType;
      if (inline?.data && ANTHROPIC_IMAGE_TYPES.has(mime)) {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: mime, data: inline.data } });
      } else if (inline?.data && mime === 'application/pdf') {
        blocks.push({ type: 'document', source: { type: 'base64', media_type: mime, data: inline.data } });
      } else {
        return { unsupported: mime || Object.keys(p || {})[0] || 'part' };
      }
    }
    if (blocks.length) messages.push({ role: c?.role === 'model' ? 'assistant' : 'user', content: blocks });
  }
  if (!messages.length) return { unsupported: 'empty' };
  if (jsonTail) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const lastText = lastUser && [...lastUser.content].reverse().find((b) => b.type === 'text');
    if (lastText) lastText.text += ANTHROPIC_JSON_TAIL;
    else if (lastUser) lastUser.content.push({ type: 'text', text: ANTHROPIC_JSON_TAIL.trim() });
  }
  return { messages };
}

/** 꼬리 방식 JSON 응답에서 JSON 본문만 — 코드 블록 · 앞뒤 설명을 걷어 낸다. 못 찾으면 원문 그대로(호출부 파서가 판정). */
export function extractJsonText(text) {
  const raw = String(text ?? '').trim();
  const tryParse = (s) => { try { JSON.parse(s); return true; } catch { return false; } };
  if (tryParse(raw)) return raw;
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  if (tryParse(unfenced)) return unfenced;
  const starts = [unfenced.indexOf('{'), unfenced.indexOf('[')].filter((i) => i >= 0);
  if (!starts.length) return raw;
  const start = Math.min(...starts);
  const end = Math.max(unfenced.lastIndexOf('}'), unfenced.lastIndexOf(']'));
  const slice = end > start ? unfenced.slice(start, end + 1) : '';
  return slice && tryParse(slice) ? slice : raw;
}

/** Claude usage → 공통 단위. out은 Gemini(candidatesTokenCount)처럼 추론 제외, 입력은 캐시 읽기 · 쓰기까지 합친다. */
export function normalizeAnthropicUsage(u) {
  const output = Number(u?.output_tokens) || 0;
  const thinking = Math.min(output, Number(u?.output_tokens_details?.thinking_tokens) || 0);
  return {
    in: (Number(u?.input_tokens) || 0) + (Number(u?.cache_creation_input_tokens) || 0) + (Number(u?.cache_read_input_tokens) || 0),
    out: output - thinking,
    thinking,
  };
}

async function loadAnthropic() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return Anthropic;
}

/** SDK 오류 → 체인 결과. 상태가 없는 것(연결 · 시간 초과 · 취소)은 Gemini fetch 실패와 같은 status 0 · network. */
function anthropicFailure(Anthropic, e) {
  if (e instanceof Anthropic.APIError && Number(e.status) > 0) {
    const body = e.error && typeof e.error === 'object' ? e.error : null;
    return { ok: false, status: e.status, code: 'http', detail: body?.error ? body : { error: { type: body?.type || null, message: e.message } } };
  }
  return { ok: false, status: 0, code: 'network', detail: { error: e?.message || 'failed' } };
}

/**
 * Claude 1회(+ 거부된 선택 필드를 뺀 즉시 재요청 1회). 던지지 않는다 — geminiOnce와 같은 결과 모양.
 * JSON: responseSchema가 있으면 output_config.format(json_schema), MIME만 있으면 꼬리 + extractJsonText.
 * 스키마를 거부(400)하면 같은 모델을 꼬리 방식으로 즉시 1회 다시 부른다(폴백 모델로 강등되지 않게).
 */
async function anthropicOnce(model, input, generationConfig, { key, signal, timeoutMs, thinkingOff }) {
  const spec = ANTHROPIC_MODELS[model] || {};
  const wantJson = generationConfig?.responseMimeType === 'application/json';
  const schema = wantJson && generationConfig?.responseSchema ? toClaudeSchema(generationConfig.responseSchema) : null;
  const requested = Number(generationConfig?.maxOutputTokens);
  const maxTokens = Math.min(ANTHROPIC_MAX_TOKENS_CAP, requested > 0 ? Math.floor(requested) : ANTHROPIC_DEFAULT_MAX_TOKENS);
  let Anthropic;
  try { Anthropic = await loadAnthropic(); } catch (e) {
    return { ok: false, status: 0, code: 'sdk_unavailable', detail: { error: e?.message || 'sdk load failed' } };
  }
  const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: Number(timeoutMs) > 0 ? Number(timeoutMs) : 10 * 60 * 1000 });

  const attempt = async ({ useSchema, useThinking }) => {
    const converted = toAnthropicMessages(input, { jsonTail: wantJson && !useSchema });
    if (converted.unsupported) return { ok: false, status: 400, code: 'unsupported_input', detail: { error: { message: `unsupported part: ${converted.unsupported}` } } };
    const outputConfig = {
      ...(thinkingOff && spec.effort ? { effort: spec.effort } : {}),
      ...(useSchema ? { format: { type: 'json_schema', schema } } : {}),
    };
    const body = {
      model,
      max_tokens: maxTokens,
      ...(useThinking ? { thinking: spec.thinkingOff } : {}),
      ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
      messages: converted.messages,
    };
    let msg;
    try {
      msg = await client.messages.create(body, { signal });
    } catch (e) {
      return anthropicFailure(Anthropic, e);
    }
    if (msg?.stop_reason === 'refusal') {
      return { ok: false, status: 200, code: 'refusal', detail: { stop_reason: 'refusal', category: msg?.stop_details?.category ?? null } };
    }
    const text = (msg?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('');
    if (!text) return { ok: false, status: 200, code: 'empty', detail: { stop_reason: msg?.stop_reason ?? null } };
    return {
      ok: true, status: 200, text: wantJson && !useSchema ? extractJsonText(text) : text,
      usage: normalizeAnthropicUsage(msg?.usage),
    };
  };

  const thinkingKey = `${model}:thinking`;
  const useThinking = !!(thinkingOff && spec.thinkingOff && !anthropicRejected.has(thinkingKey));
  let r = await attempt({ useSchema: !!schema, useThinking });
  if (!r.ok && r.status === 400 && !isServiceConfigError(r.status, r.detail)) {
    if (useThinking && mentionsThinking(r.detail)) {
      anthropicRejected.add(thinkingKey);
      r = await attempt({ useSchema: !!schema, useThinking: false });
    } else if (schema && r.code === 'http') {
      r = await attempt({ useSchema: false, useThinking });
    }
  }
  return r;
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
  'claude-sonnet-5-5': Object.freeze({ provider: 'anthropic', model: 'claude-sonnet-5-5', env: 'ANTHROPIC_API_KEY', label: 'Claude Sonnet 5.5 (품질 경로 · thinking 끔)', price: [2.00, 10.00] }),
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

async function anthropicBenchOnce(model, prompt, { key, signal, maxTokens }) {
  // 지연 로드 — 운영 본선(anthropicOnce)과 같은 SDK · 같은 모델 설정 표(ANTHROPIC_MODELS)를 쓴다.
  const Anthropic = await loadAnthropic();
  const client = new Anthropic({ apiKey: key, maxRetries: 0 });
  const spec = ANTHROPIC_MODELS[model] || ANTHROPIC_MODELS['claude-haiku-5-5'];
  try {
    // 샘플링 인자(temperature 등)는 400 — 보내지 않는다. thinking 끔은 effort high 이하에서만 허용(모델별 값은 표).
    const msg = await client.messages.create({
      model, max_tokens: maxTokens,
      thinking: spec.thinkingOff,
      output_config: { effort: spec.effort },
      messages: [{ role: 'user', content: prompt }],
    }, { signal });
    if (msg.stop_reason === 'refusal') return { ok: false, status: 200, code: 'refusal', detail: { stop_reason: 'refusal' } };
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!text) return { ok: false, status: 200, code: 'empty', detail: { stop_reason: msg.stop_reason } };
    return { ok: true, status: 200, text, usage: normalizeAnthropicUsage(msg.usage), stop: msg.stop_reason };
  } catch (e) {
    if (e instanceof Anthropic.APIError) return { ok: false, status: e.status || 0, code: 'http', detail: { type: e.error?.error?.type || null, message: e.message } };
    return { ok: false, status: 0, code: 'network', detail: { error: e?.message || 'failed' } };
  }
}

/**
 * 측정 1회 — 같은 프롬프트를 모델 하나에. 운영과 같게: Gemini는 THINKING_OFF_CONFIG(+ 호출부의 temperature 0·JSON MIME),
 * Groq는 reasoning low, Luna는 reasoning none, Claude는 ANTHROPIC_MODELS 표(Haiku disabled · Sonnet between_tools + effort).
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
    r = await anthropicBenchOnce(spec.model, tailed, { key, signal, maxTokens });
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
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const apiKey = process.env.GEMINI_API_KEY;
  const groqKey = opts.groq === false ? '' : process.env.GROQ_API_KEY;
  if (!anthropicKey && !apiKey && !groqKey) throw new LLMError('LLM API key missing', { code: 'no_key', status: 500 });

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

  // 후보 순서 — Claude(키가 있을 때만) → Gemini(키가 있을 때만). Claude 키가 없으면 Gemini 티어 표 그대로다.
  const chain = [
    ...anthropicChain(tier, route).map((model) => ({ provider: 'anthropic', model })),
    ...(apiKey ? [spec.primary, ...spec.fallbacks].map((model) => ({ provider: 'gemini', model })) : []),
  ];

  const geminiCall = async (model) => {
    const withThinking = thinkingOff && !thinkingUnsupported.has(model);
    const cfg = withThinking ? { ...generationConfig, thinkingConfig: THINKING_OFF_CONFIG } : generationConfig;
    let r = await geminiOnce(model, contents, cfg, { apiKey, signal: makeSignal(opts.signal, opts.timeoutMs) });
    if (!r.ok && r.status === 400 && withThinking && mentionsThinking(r.detail)) {
      thinkingUnsupported.add(model);
      r = await geminiOnce(model, contents, generationConfig, { apiKey, signal: makeSignal(opts.signal, opts.timeoutMs) });
    }
    return r;
  };
  const anthropicCall = (model) => anthropicOnce(model, input, generationConfig, {
    key: anthropicKey, signal: makeSignal(opts.signal, opts.timeoutMs), timeoutMs: opts.timeoutMs, thinkingOff,
  });

  const lastByProvider = {};
  const blocked = new Set(); // 「서비스 설정」으로 막힌 제공자 — 같은 키의 다른 모델도 같은 답이다
  let last = null;
  let giveUp = false;
  for (let depth = 0; depth < chain.length && !giveUp; depth++) {
    const { provider, model } = chain[depth];
    if (blocked.has(provider)) continue;
    for (let attempt = 0; attempt <= retryMax; attempt++) {
      const r = provider === 'anthropic' ? await anthropicCall(model) : await geminiCall(model);
      if (r.ok) return { text: r.text, meta: meta(model, provider, depth, r.usage) };
      last = lastByProvider[provider] = { ...r, model, provider, depth };
      if (opts.signal?.aborted) {
        throw new LLMError('aborted', { code: 'aborted', status: 0, model, provider, fallbackDepth: depth });
      }
      if (attempt === retryMax || !isCapacityError(r.status, r.detail)) break;
      const delay = delays[attempt] ?? delays[delays.length - 1] ?? 0;
      if (deadlineMs != null && Date.now() + delay >= deadlineMs) { giveUp = true; break; }
      console.warn(`[llm] capacity retry ${attempt + 1}/${retryMax} in ${delay}ms (${model} ${r.status})`);
      await sleep(delay);
    }
    // 결제 · 크레딧 · 키가 막히면 같은 제공자의 나머지 모델은 건너뛰고 다른 제공자(Gemini · Groq)만 본다.
    const failed = lastByProvider[provider];
    if (failed && isProviderConfigError(provider, failed.status, failed.detail)) blocked.add(provider);
  }

  if (groqKey && !pastDeadline()) {
    const r = await groqOnce(contents, generationConfig, {
      groqKey, signal: makeSignal(opts.signal, opts.groqTimeoutMs ?? opts.timeoutMs),
    });
    if (r.ok) return { text: r.text, meta: meta(GROQ_MODEL, 'groq', chain.length, r.usage) };
    last = { ...r, model: GROQ_MODEL, provider: 'groq', depth: chain.length };
  }

  // 실패 상태 · 본문은 본선 제공자(후보 첫 제공자 — Claude 키가 있으면 Claude, 없으면 Gemini) 쪽을 우선한다.
  const primary = (chain.length ? lastByProvider[chain[0].provider] : null) || lastByProvider.gemini || last;
  throw new LLMError(
    primary ? `LLM ${primary.provider} ${primary.model} failed (${primary.code} ${primary.status})` : 'LLM unavailable',
    {
      code: primary && isProviderConfigError(primary.provider, primary.status, primary.detail) ? 'service_config' : (primary?.code || 'exhausted'),
      status: primary?.status ?? 0,
      detail: primary?.detail ?? null,
      model: primary?.model ?? null,
      provider: primary?.provider ?? null,
      fallbackDepth: primary?.depth ?? 0,
    },
  );
}
