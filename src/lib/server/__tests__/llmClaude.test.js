import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FEEDBACK_SCHEMA } from '../../writingPrompts.js';
import { CONVERSATION_RESPONSE_SCHEMA } from '../../conversation/turnModel.js';
import { PARAGRAPH_SCHEMA } from '../../studyParagraph.js';
import { KOREAN_ANALYSIS_SCHEMA } from '../koreanAnalysis.js';

// LLM-CLAUDE-001(오너 결정 2026-10-17 KST — Gemini 선불 크레딧 소진 402 후속) 계약.
// ANTHROPIC_API_KEY가 있으면 Claude가 본선, 없으면 현행(Gemini → Groq) 그대로. 실제 SDK(@anthropic-ai/sdk)를 쓰고
// 전역 fetch만 바꿔 끼운다 — SDK가 실제로 보내는 요청 본문 · 오류 분류를 그대로 검사한다(SDK 목이 아니라).

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
const claudeOk = (text, { model = 'claude-haiku-5-5', usage = { input_tokens: 11, output_tokens: 4 }, stop = 'end_turn' } = {}) => json({
  id: 'msg_test', type: 'message', role: 'assistant', model, content: [{ type: 'text', text }], stop_reason: stop, usage,
});
const claudeFail = (status, type, message) => json({ type: 'error', error: { type, message } }, status);
const CREDIT = 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.';
const geminiOk = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const geminiFail = (status, body = { error: { message: `http ${status}` } }) => ({ ok: false, status, json: async () => body });
const groqOk = (text) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) });
const isClaude = (url) => String(url).includes('/v1/messages');
const isGroq = (url) => String(url).includes('api.groq.com');
const isGemini = (url) => String(url).includes('generativelanguage.googleapis.com');
const bodyOf = (call) => JSON.parse(call[1].body);
const claudeCalls = (spy) => spy.mock.calls.filter((c) => isClaude(c[0]));

async function fresh() {
  vi.resetModules();
  return import('../llm.js');
}

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-test-key');
  vi.stubEnv('ANTHROPIC_BASE_URL', ''); // 컨테이너 프록시 설정이 새지 않게 — SDK 기본 주소
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('GROQ_API_KEY', '');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('키 유무 — Claude 본선 / 현행 그대로', () => {
  it('키 있음 — light는 Haiku 5.5 한 번: thinking 끔 · effort low · 샘플링 인자 없음 · SDK 재시도 0', async () => {
    const spy = vi.fn(async () => claudeOk('도서관'));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    const { text, meta } = await callLLM('light', '图书馆', { temperature: 0, route: 'fetchMeanings' });
    expect(text).toBe('도서관');
    expect(meta).toMatchObject({ tier: 'light', model: 'claude-haiku-5-5', provider: 'anthropic', fallbackDepth: 0, usage: { in: 11, out: 4, thinking: 0 } });
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages');
    expect(new Headers(init.headers).get('x-api-key')).toBe('anthropic-test-key');
    expect(bodyOf(spy.mock.calls[0])).toEqual({
      model: 'claude-haiku-5-5', max_tokens: 16000, thinking: { type: 'disabled' }, output_config: { effort: 'low' },
      messages: [{ role: 'user', content: '图书馆' }],
    });
  });

  it('키 없음 — Claude 요청 0, Gemini 요청 본문은 현행과 바이트 동일', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
    const spy = vi.fn(async () => geminiOk('ok'));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    const { meta } = await callLLM('standard', '프롬프트', { temperature: 0.2, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' }, route: 'writing-feedback' });
    expect(meta).toMatchObject({ provider: 'gemini', model: 'gemini-3.6-flash', fallbackDepth: 0 }); // Claude가 후보에 끼면 깊이 1
    expect(claudeCalls(spy)).toHaveLength(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=gemini-test-key');
    expect(spy.mock.calls[0][1].body).toBe(JSON.stringify({
      contents: [{ parts: [{ text: '프롬프트' }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' }, thinkingConfig: { thinkingLevel: 'minimal' } },
    }));
  });

  it('키가 셋 다 없으면 no_key — Claude 키만 있어도 no_key가 아니다', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubGlobal('fetch', vi.fn());
    let llm = await fresh();
    expect((await llm.callLLM('light', 'p').catch((e) => e)).code).toBe('no_key');
    expect(llm.hasPrimaryLLMKey()).toBe(false);
    vi.stubEnv('ANTHROPIC_API_KEY', 'k');
    vi.stubGlobal('fetch', vi.fn(async () => claudeOk('a')));
    llm = await fresh();
    expect((await llm.callLLM('light', 'p')).meta.provider).toBe('anthropic');
    expect(llm.hasPrimaryLLMKey()).toBe(true);
  });
});

describe('티어 · 품질 경로 — 모델 이름은 llm.js 표 한 곳', () => {
  it('품질 경로(standard + 회화 · 작문 첨삭 · 문단 · 뜻 검증)는 Sonnet 5.5(between_tools · effort medium), 그 밖 standard는 Haiku', async () => {
    const spy = vi.fn(async (_url, init) => claudeOk('{}', { model: JSON.parse(init.body).model }));
    vi.stubGlobal('fetch', spy);
    const { callLLM, ANTHROPIC_QUALITY_ROUTES } = await fresh();
    for (const route of ANTHROPIC_QUALITY_ROUTES) {
      const { meta } = await callLLM('standard', 'p', { route });
      expect(meta.model).toBe('claude-sonnet-5-5');
    }
    const sonnetBody = bodyOf(spy.mock.calls[0]);
    expect(sonnetBody).toMatchObject({ model: 'claude-sonnet-5-5', thinking: { type: 'between_tools' }, output_config: { effort: 'medium' } });
    expect(sonnetBody).not.toHaveProperty('temperature');
    for (const route of ['gemini-proxy', 'note-recognize', null]) {
      expect((await callLLM('standard', 'p', { route })).meta.model).toBe('claude-haiku-5-5');
    }
    // light는 라벨과 무관하게 Haiku
    expect((await callLLM('light', 'p', { route: 'writing-feedback' })).meta.model).toBe('claude-haiku-5-5');
  });

  it('품질 경로 라벨은 실제 호출부의 route 라벨이다(라벨이 바뀌면 조용히 Haiku로 떨어지지 않게)', async () => {
    const { ANTHROPIC_QUALITY_ROUTES } = await fresh();
    const sites = {
      'conversation-turn': 'src/lib/server/conversationTurn.js',
      'writing-feedback': 'src/app/api/writing-feedback/route.js',
      'study-paragraph': 'src/app/api/study-paragraph/route.js',
      verifyMeanings: 'src/lib/server/fetchMeanings.js',
    };
    expect([...ANTHROPIC_QUALITY_ROUTES].sort()).toEqual(Object.keys(sites).sort());
    for (const [route, file] of Object.entries(sites)) {
      const src = read(file);
      expect(src).toContain(`route: '${route}'`);
      expect(src).toMatch(/callLLM\('standard'/);
    }
  });

  it('뜻 검증은 생성기(light = Haiku)와 다른 모델이 답한다 — Sonnet이 막혀 Haiku가 답하면 자기 승인(self)으로 남는다', async () => {
    const { ANTHROPIC_TIERS, ANTHROPIC_QUALITY } = await fresh();
    expect(ANTHROPIC_QUALITY.primary).not.toBe(ANTHROPIC_TIERS.light.primary);
    expect(read('src/lib/server/fetchMeanings.js')).toContain("if (generatorModel && meta?.model && meta.model === generatorModel) {");
  });

  it('Claude 모델 식별자(claude-…)는 서버 · 클라 소스에서 llm.js에만 있다', () => {
    const out = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(path.join(ROOT, dir))) {
        const rel = path.join(dir, name);
        if (fs.statSync(path.join(ROOT, rel)).isDirectory()) { if (name !== '__tests__') walk(rel); } else if (/\.(js|jsx|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(rel);
      }
    };
    walk('src');
    const hits = out.filter((f) => /claude-(haiku|sonnet|opus|fable)-\d/.test(read(f)));
    expect(hits).toEqual(['src/lib/server/llm.js']);
  });

  it('「키 없음」 관문은 본선 키(Gemini 또는 Claude)를 본다 — Gemini 키만 보는 관문이 남지 않는다', () => {
    const gates = ['src/app/api/gemini/route.js', 'src/app/api/explain/route.js', 'src/app/api/study-paragraph/route.js',
      'src/app/api/writing-feedback/route.js', 'src/lib/server/disambiguateZhPos.js', 'src/lib/server/disambiguateEnPos.js', 'src/lib/server/fetchMeanings.js'];
    for (const f of gates) {
      const src = read(f);
      expect(src).toContain('hasPrimaryLLMKey()');
      expect(src).not.toContain('process.env.GEMINI_API_KEY');
    }
    expect(read('src/lib/server/llmKeys.js')).toContain('process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY');
  });
});

describe('오류 분류 — isServiceConfigError와 같은 축', () => {
  it('크레딧 부족(400 invalid_request_error)은 서비스 설정 — 재시도 · 다음 Claude 모델 없이 service_config', async () => {
    const spy = vi.fn(async () => claudeFail(400, 'invalid_request_error', CREDIT));
    vi.stubGlobal('fetch', spy);
    const { callLLM, isServiceConfigError, isCapacityError } = await fresh();
    const err = await callLLM('standard', 'p', { route: 'writing-feedback', retry: { max: 3, delays: [0, 0, 0] } }).catch((e) => e);
    expect(err).toMatchObject({ code: 'service_config', status: 400, provider: 'anthropic', model: 'claude-sonnet-5-5' });
    expect(spy).toHaveBeenCalledTimes(1); // Sonnet 1회 — 재시도 0 · Haiku 폴백 0(같은 키)
    expect(isServiceConfigError(400, { type: 'error', error: { type: 'invalid_request_error', message: CREDIT } })).toBe(true);
    expect(isCapacityError(400, { error: { message: CREDIT } })).toBe(false);
    // 음성 — 보통 400은 서비스 설정이 아니다
    expect(isServiceConfigError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens: Field required' } })).toBe(false);
  });

  it('402(결제) · 401(키) · 403(권한)도 서비스 설정 — 재시도 없음, 다른 제공자(Groq)는 여전히 본다', async () => {
    const { callLLM } = await fresh();
    for (const [status, type] of [[402, 'billing_error'], [401, 'authentication_error'], [403, 'permission_error']]) {
      const spy = vi.fn(async () => claudeFail(status, type, 'x'));
      vi.stubGlobal('fetch', spy);
      const err = await callLLM('light', 'p', { retry: { max: 2, delays: [0, 0] } }).catch((e) => e);
      expect(err).toMatchObject({ code: 'service_config', status, provider: 'anthropic' });
      expect(spy).toHaveBeenCalledTimes(1);
    }
    vi.stubEnv('GROQ_API_KEY', 'g');
    const spy = vi.fn(async (url) => (isGroq(url) ? groqOk('groq 답') : claudeFail(400, 'invalid_request_error', CREDIT)));
    vi.stubGlobal('fetch', spy);
    const { text, meta } = await callLLM('standard', 'p', { route: 'conversation-turn' });
    expect([text, meta.provider, meta.fallbackDepth]).toEqual(['groq 답', 'groq', 2]);
    expect(spy).toHaveBeenCalledTimes(2); // Sonnet 1 + Groq 1 — Haiku는 건너뜀
  });

  it('401은 Claude 안에서만 설정 오류다 — 공통 판정(로그인 401을 보는 클라)은 바꾸지 않는다', async () => {
    const { isServiceConfigError } = await fresh();
    expect(isServiceConfigError(401, { error: { message: 'Unauthorized' } })).toBe(false);
  });

  it('529 overloaded · 429는 혼잡 — retry를 준 호출은 같은 모델을 다시 부른다', async () => {
    for (const [status, type] of [[529, 'overloaded_error'], [429, 'rate_limit_error']]) {
      let n = 0;
      const spy = vi.fn(async () => (++n === 1 ? claudeFail(status, type, 'Overloaded') : claudeOk('답')));
      vi.stubGlobal('fetch', spy);
      const { callLLM, isCapacityError } = await fresh();
      const { text, meta } = await callLLM('light', 'p', { retry: { max: 2, delays: [0, 0] } });
      expect([text, meta.model, meta.fallbackDepth]).toEqual(['답', 'claude-haiku-5-5', 0]);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(isCapacityError(status, {})).toBe(true);
    }
  });

  it('retry가 없으면 혼잡은 다음 후보로 — Sonnet 529 → Haiku', async () => {
    const spy = vi.fn(async (_url, init) => (JSON.parse(init.body).model === 'claude-sonnet-5-5' ? claudeFail(529, 'overloaded_error', 'Overloaded') : claudeOk('h')));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    const { meta } = await callLLM('standard', 'p', { route: 'writing-feedback' });
    expect(meta).toMatchObject({ model: 'claude-haiku-5-5', provider: 'anthropic', fallbackDepth: 1 });
  });

  it('Claude가 전부 실패하면 Gemini(키가 있을 때) → 실패 상태는 본선(Claude) 쪽을 우선한다', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gk');
    const spy = vi.fn(async (url) => (isClaude(url) ? claudeFail(529, 'overloaded_error', 'Overloaded') : geminiFail(402, { error: { message: 'Your prepayment credits are depleted.' } })));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    const err = await callLLM('light', 'p').catch((e) => e);
    expect(err).toMatchObject({ provider: 'anthropic', status: 529, code: 'http', fallbackDepth: 0, detail: { error: { type: 'overloaded_error' } } });
    expect(spy.mock.calls.map((c) => (isClaude(c[0]) ? 'claude' : 'gemini'))).toEqual(['claude', 'gemini']);
    // Gemini가 살아 있으면 Gemini가 답한다(fallbackDepth 1)
    spy.mockImplementation(async (url) => (isClaude(url) ? claudeFail(529, 'overloaded_error', 'Overloaded') : geminiOk('g')));
    expect((await callLLM('light', 'p')).meta).toMatchObject({ provider: 'gemini', model: 'gemini-3.5-flash-lite', fallbackDepth: 1 });
  });

  it('거절(refusal)은 다음 후보로 · 취소는 재시도 · 폴백 없이 aborted', async () => {
    const spy = vi.fn(async (_url, init) => (JSON.parse(init.body).model === 'claude-sonnet-5-5' ? claudeOk('', { stop: 'refusal' }) : claudeOk('h')));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    expect((await callLLM('standard', 'p', { route: 'study-paragraph' })).meta.model).toBe('claude-haiku-5-5');
    const controller = new AbortController();
    controller.abort();
    const abortSpy = vi.fn(async () => { throw new DOMException('aborted', 'AbortError'); });
    vi.stubGlobal('fetch', abortSpy);
    const err = await callLLM('standard', 'p', { route: 'writing-feedback', signal: controller.signal, retry: { max: 3, delays: [0] } }).catch((e) => e);
    expect(err).toMatchObject({ code: 'aborted', provider: 'anthropic' });
    expect(abortSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('형식 변환 — 프롬프트 의미는 그대로', () => {
  it('responseSchema → structured output(json_schema): 소문자 type · 모든 객체 additionalProperties:false · nullable → anyOf null', async () => {
    const { toClaudeSchema } = await fresh();
    const walk = (s, visit) => { visit(s); for (const v of Object.values(s.properties || {})) walk(v, visit); if (s.items) walk(s.items, visit); for (const a of s.anyOf || []) walk(a, visit); };
    for (const schema of [FEEDBACK_SCHEMA, CONVERSATION_RESPONSE_SCHEMA, PARAGRAPH_SCHEMA, KOREAN_ANALYSIS_SCHEMA]) {
      const out = toClaudeSchema(schema);
      walk(out, (s) => {
        if (s.type) expect(s.type).toBe(String(s.type).toLowerCase());
        if (s.type === 'object') expect(s.additionalProperties).toBe(false);
        expect(s).not.toHaveProperty('nullable');
        for (const k of s.required || []) expect(s.properties).toHaveProperty(k);
      });
      expect(out.required).toEqual(schema.required);
    }
    const conv = toClaudeSchema(CONVERSATION_RESPONSE_SCHEMA);
    expect(conv.properties.repair).toEqual({ anyOf: [{ type: 'string', enum: ['ok', 'avoided', 'no'] }, { type: 'null' }] });
    expect(conv.properties.focus.anyOf[1]).toEqual({ type: 'null' });
    expect(conv.properties.focus.anyOf[0].required).toEqual(['from', 'to', 'level', 'kind']);
    expect(conv.properties.lines.items.properties.t.description).toBe('tutor sentence in the target language only');
  });

  it('스키마 과제 — 요청에 output_config.format이 실리고 응답 JSON이 그대로 파싱된다(꼬리 없음)', async () => {
    const answer = { score: 4, summary: '좋아요', levelFit: 'fit', sentences: [], naturalness: [] };
    const spy = vi.fn(async () => claudeOk(JSON.stringify(answer), { model: 'claude-sonnet-5-5' }));
    vi.stubGlobal('fetch', spy);
    const { callLLM, toClaudeSchema } = await fresh();
    const { text } = await callLLM('standard', '첨삭해 주세요', { temperature: 0.2, responseMimeType: 'application/json', responseSchema: FEEDBACK_SCHEMA, route: 'writing-feedback' });
    expect(JSON.parse(text)).toEqual(answer);
    const body = bodyOf(spy.mock.calls[0]);
    expect(body.output_config).toEqual({ effort: 'medium', format: { type: 'json_schema', schema: toClaudeSchema(FEEDBACK_SCHEMA) } });
    expect(body.messages).toEqual([{ role: 'user', content: '첨삭해 주세요' }]);
  });

  it('JSON MIME만 있는 과제 — 꼬리 한 줄을 붙이고, 코드 블록 · 앞뒤 설명을 걷어 JSON만 돌려준다', async () => {
    const spy = vi.fn(async () => claudeOk('결과입니다.\n```json\n{"expressions":[]}\n```'));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    const { text } = await callLLM('light', '조회', { responseMimeType: 'application/json', maxOutputTokens: 1600, route: 'classroom-lookup' });
    expect(JSON.parse(text)).toEqual({ expressions: [] });
    const body = bodyOf(spy.mock.calls[0]);
    expect(body.messages[0].content).toBe('조회\n\nJSON만 출력하세요(설명·코드 블록 없이).');
    expect(body.max_tokens).toBe(1600);
    expect(body.output_config).toEqual({ effort: 'low' });
  });

  it('스키마를 거부(400)하면 같은 모델을 꼬리 방식으로 즉시 1회 — 폴백 모델로 강등되지 않는다', async () => {
    const spy = vi.fn(async (_url, init) => (JSON.parse(init.body).output_config?.format
      ? claudeFail(400, 'invalid_request_error', 'output_config.format.schema: unsupported keyword')
      : claudeOk('[1,2]', { model: 'claude-sonnet-5-5' })));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    const { text, meta } = await callLLM('standard', 'p', { responseMimeType: 'application/json', responseSchema: { type: 'ARRAY', items: { type: 'INTEGER' } }, route: 'study-paragraph' });
    expect([text, meta.model, meta.fallbackDepth]).toEqual(['[1,2]', 'claude-sonnet-5-5', 0]);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(bodyOf(spy.mock.calls[1]).messages[0].content).toBe('p\n\nJSON만 출력하세요(설명·코드 블록 없이).');
  });

  it('thinking 설정을 거부(400)하면 같은 모델을 그 필드 없이 재요청하고 이후엔 싣지 않는다', async () => {
    const spy = vi.fn(async (_url, init) => (JSON.parse(init.body).thinking ? claudeFail(400, 'invalid_request_error', 'thinking.type: disabled is not supported') : claudeOk('ok')));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    expect((await callLLM('light', 'p')).meta.fallbackDepth).toBe(0);
    expect(spy).toHaveBeenCalledTimes(2);
    await callLLM('light', 'p2');
    expect(spy).toHaveBeenCalledTimes(3);
    expect(bodyOf(spy.mock.calls[2])).not.toHaveProperty('thinking');
  });

  it('contents(parts) → messages: role model → assistant, 이미지 inline_data/inlineData → image 블록(순서 유지)', async () => {
    const spy = vi.fn(async () => claudeOk('{"expressions":[]}'));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    await callLLM('standard', [
      { role: 'user', parts: [{ text: '이 필기를 읽어' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }] },
    ], { responseMimeType: 'application/json', route: 'note-recognize', groq: false });
    await callLLM('standard', [{ parts: [{ text: 'OCR' }, { inline_data: { mime_type: 'image/jpeg', data: 'BBBB' } }] }, { role: 'model', parts: [{ text: '네' }] }, { role: 'user', parts: [{ text: '계속' }] }]);
    expect(bodyOf(spy.mock.calls[0]).messages).toEqual([{ role: 'user', content: [
      { type: 'text', text: '이 필기를 읽어\n\nJSON만 출력하세요(설명·코드 블록 없이).' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
    ] }]);
    expect(bodyOf(spy.mock.calls[1]).messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'OCR' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'BBBB' } }] },
      { role: 'assistant', content: [{ type: 'text', text: '네' }] },
      { role: 'user', content: [{ type: 'text', text: '계속' }] },
    ]);
  });

  it('옮길 수 없는 파트(오디오 등)는 Claude에 보내지 않고 다음 제공자로', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gk');
    const spy = vi.fn(async () => geminiOk('g'));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    const { meta } = await callLLM('light', [{ parts: [{ text: '듣고' }, { inline_data: { mime_type: 'audio/wav', data: 'CC' } }] }]);
    expect(meta).toMatchObject({ provider: 'gemini', fallbackDepth: 1 });
    expect(claudeCalls(spy)).toHaveLength(0);
  });

  it('extractJsonText — 이미 JSON이면 그대로, 못 찾으면 원문 그대로(호출부 파서가 판정)', async () => {
    const { extractJsonText } = await fresh();
    expect(extractJsonText('[{"a":1}]')).toBe('[{"a":1}]');
    expect(extractJsonText('앞말 {"a":[1]} 뒷말')).toBe('{"a":[1]}');
    expect(extractJsonText('JSON 없음')).toBe('JSON 없음');
  });
});

describe('텔레메트리 — provider anthropic · usage 정규화 · 키 11개 유지', () => {
  it('[llm] 1줄 — 필수 키 11개(순서 고정), out은 추론 제외 · in은 캐시 포함, 프롬프트 본문 없음', async () => {
    vi.stubEnv('LLM_LOG', 'on');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const usage = { input_tokens: 20, cache_creation_input_tokens: 3, cache_read_input_tokens: 2, output_tokens: 50, output_tokens_details: { thinking_tokens: 30 } };
    vi.stubGlobal('fetch', vi.fn(async () => claudeOk('ok', { usage })));
    const { callLLM, LLM_LOG_KEYS, getLLMStats, resetLLMStats } = await fresh();
    resetLLMStats();
    await callLLM('light', '비밀 프롬프트 본문', { route: 'explain' });
    const lines = info.mock.calls.filter((c) => c[0] === '[llm]').map((c) => c[1]);
    expect(LLM_LOG_KEYS).toHaveLength(11);
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0]);
    expect(Object.keys(rec)).toEqual([...LLM_LOG_KEYS]);
    expect(rec).toMatchObject({ route: 'explain', tier: 'light', model: 'claude-haiku-5-5', provider: 'anthropic', fallbackDepth: 0, in: 25, out: 20, thinking: 30, ok: true, status: 200 });
    expect(lines[0]).not.toContain('비밀 프롬프트 본문');
    expect(getLLMStats().tiers.light['claude-haiku-5-5']).toMatchObject({ calls: 1, ok: 1, in: 25, out: 20, thinking: 30 });

    vi.stubGlobal('fetch', vi.fn(async () => claudeFail(400, 'invalid_request_error', CREDIT)));
    await callLLM('light', '비밀 프롬프트 본문', { route: 'explain' }).catch(() => null);
    const fail = JSON.parse(info.mock.calls.filter((c) => c[0] === '[llm]').map((c) => c[1])[1]);
    expect(Object.keys(fail)).toEqual([...LLM_LOG_KEYS]);
    expect(fail).toMatchObject({ provider: 'anthropic', model: 'claude-haiku-5-5', ok: false, status: 400, in: 0, out: 0 });
  });
});

describe('설정 파일', () => {
  it('.env.example — ANTHROPIC_API_KEY 줄은 값 없이', () => {
    expect(read('.env.example')).toMatch(/^ANTHROPIC_API_KEY=$/m);
  });
  it('llm-stats — Claude 키 설정 여부(값은 읽지 않는다)를 보여 준다', () => {
    expect(read('src/app/api/admin/llm-stats/route.js')).toContain('anthropicConfigured: !!process.env.ANTHROPIC_API_KEY');
  });
});
