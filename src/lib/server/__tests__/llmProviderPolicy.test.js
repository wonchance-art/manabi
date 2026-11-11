import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_PROVIDERS, CLAUDE_ONLY, GEMINI_FALLBACK_ROUTES, USER_CONTENT_ROUTES, providersFor,
} from '../llmProviderPolicy.js';

// LLM-PROVIDER-POLICY-001(오너 승인 2026-11-07 11:35 KST 「권장안대로」, 오케스트레이터 경유) 계약.
// 사용자 내용 경로(작문 · 회화 · 손글씨 · 붙여넣은 글)는 Claude만 — Claude가 실패해도 Gemini · Groq로 넘기지 않는다.
// 단어 뜻(분석 사전)만 Gemini · Groq 대체가 남는다. TTS는 callLLM 밖의 Gemini 전용 경로(그대로).

const ROOT = process.cwd();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
const claudeOk = (text) => json({ id: 'msg', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
const claudeFail = (status) => json({ type: 'error', error: { type: status === 529 ? 'overloaded_error' : 'api_error', message: 'x' } }, status);
const geminiOk = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const groqOk = (text) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) });
const isClaude = (url) => String(url).includes('/v1/messages');
const isGemini = (url) => String(url).includes('generativelanguage.googleapis.com');
const isGroq = (url) => String(url).includes('api.groq.com');

async function fresh() {
  vi.resetModules();
  return import('../llm.js');
}

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-test-key');
  vi.stubEnv('ANTHROPIC_BASE_URL', '');
  vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key');
  vi.stubEnv('GROQ_API_KEY', 'groq-test-key');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('허용 목록', () => {
  it('단어 뜻(분석 사전) 경로만 모든 제공자, 사용자 내용 경로 · 처음 보는 라벨은 Claude만', () => {
    expect(GEMINI_FALLBACK_ROUTES).toEqual(['fetchMeanings', 'verifyMeanings', 'backfill-ipa']);
    for (const route of GEMINI_FALLBACK_ROUTES) expect(providersFor(route)).toEqual(ALL_PROVIDERS);
    for (const route of USER_CONTENT_ROUTES) {
      expect(providersFor(route), route).toEqual(CLAUDE_ONLY);
      expect(providersFor(route), route).not.toContain('gemini');
    }
    expect(providersFor('some-new-route')).toEqual(CLAUDE_ONLY); // 닫힌 쪽이 기본
    expect(USER_CONTENT_ROUTES.some((r) => GEMINI_FALLBACK_ROUTES.includes(r))).toBe(false);
  });

  it('작문 · 회화 · 손글씨 · 붙여넣은 글의 실제 라벨이 모두 사용자 내용 목록에 있다', () => {
    for (const route of ['writing-feedback', 'conversation-turn', 'note-recognize', 'class-ink-recognize', 'study-paragraph', 'explain',
      'analyze/korean', 'disambiguateEnPos', 'disambiguateZhPos', 'gemini-proxy', 'gemini-proxy:viewer-sentence']) {
      expect(USER_CONTENT_ROUTES, route).toContain(route);
    }
  });
});

describe('callLLM — 사용자 내용 경로는 Claude가 실패해도 Gemini · Groq를 부르지 않는다', () => {
  it.each(USER_CONTENT_ROUTES)('%s — Claude 실패 → Gemini · Groq 요청 0, 오류는 Claude 쪽', async (route) => {
    const spy = vi.fn(async (url) => (isClaude(url) ? claudeFail(500) : isGroq(url) ? groqOk('g') : geminiOk('g')));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    const err = await callLLM('standard', '학습자가 쓴 글', { route }).catch((e) => e);
    expect(err?.name).toBe('LLMError');
    expect(err.provider).toBe('anthropic');
    expect(spy.mock.calls.filter((c) => isGemini(c[0]) || isGroq(c[0]))).toHaveLength(0);
    expect(spy.mock.calls.filter((c) => isClaude(c[0])).length).toBeGreaterThan(0);
  });

  it('Claude 키가 없으면 사용자 내용 경로는 요청 없이 no_key — Gemini로 새지 않는다', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const spy = vi.fn(async () => geminiOk('g'));
    vi.stubGlobal('fetch', spy);
    const { callLLM } = await fresh();
    const err = await callLLM('standard', '학습자가 쓴 글', { route: 'writing-feedback' }).catch((e) => e);
    expect(err).toMatchObject({ code: 'no_key' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('Claude가 답하면 그대로 — 사용자 내용 경로도 동작은 같다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (isClaude(url) ? claudeOk('{"ok":true}') : geminiOk('x'))));
    const { callLLM } = await fresh();
    const { text, meta } = await callLLM('light', '문장', { route: 'explain' });
    expect([text, meta.provider]).toEqual(['{"ok":true}', 'anthropic']);
  });

  it('단어 뜻 경로는 Claude 실패 → Gemini 대체가 남는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (isClaude(url) ? claudeFail(500) : geminiOk('[]'))));
    const { callLLM } = await fresh();
    const { meta } = await callLLM('light', '표제어 목록', { route: 'fetchMeanings' });
    expect(meta.provider).toBe('gemini');
  });
});

describe('소스 — 모든 callLLM 호출부가 분류된 route 라벨을 단다', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : walk(p);
    return /\.(js|jsx|mjs)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
  const files = walk(path.join(ROOT, 'src'));
  const sites = files.flatMap((file) => {
    const src = fs.readFileSync(file, 'utf8');
    if (/server\/llm\.js$/.test(file)) return [];
    const out = [];
    const re = /\bcallLLM\(/g;
    let m;
    while ((m = re.exec(src))) {
      const lineStart = src.lastIndexOf('\n', m.index) + 1;
      if (/\/\/|^\s*\*/.test(src.slice(lineStart, m.index))) continue; // 주석 속 언급은 호출이 아니다
      out.push({ file: path.relative(ROOT, file), at: m.index, window: src.slice(m.index, m.index + 900) });
    }
    return out;
  });
  const known = new Set([...USER_CONTENT_ROUTES, ...GEMINI_FALLBACK_ROUTES]);

  it('호출부가 있고, 각 호출의 route가 허용 목록 표 안이다', () => {
    expect(sites.length).toBeGreaterThan(8);
    for (const site of sites) {
      const literal = site.window.match(/route\s*:\s*'([^']+)'/);
      const viaVar = /route\s*[,}:]|route:\s*proxyRoute|route,/.test(site.window);
      expect(literal || viaVar, `${site.file} — callLLM에 route 라벨이 없다`).toBeTruthy();
      if (literal) expect(known.has(literal[1]), `${site.file} — 분류되지 않은 route '${literal[1]}'`).toBe(true);
    }
  });

  it('변수로 넘기는 route(손글씨 · 프록시 · 회화/작문 품질 작업)도 표의 라벨이다', () => {
    const ink = fs.readFileSync(path.join(ROOT, 'src/lib/server/selectedInkRecognition.js'), 'utf8');
    expect(ink).toMatch(/route='note-recognize'/);
    expect(fs.readFileSync(path.join(ROOT, 'src/app/api/classroom/recognize/route.js'), 'utf8')).toContain("'class-ink-recognize'");
    const proxy = fs.readFileSync(path.join(ROOT, 'src/app/api/gemini/route.js'), 'utf8');
    expect(proxy).toMatch(/`gemini-proxy:\$\{purpose\}` : 'gemini-proxy'/);
    for (const p of proxy.match(/new Set\(\[([^\]]+)\]\)/)[1].match(/'([^']+)'/g).map((q) => q.slice(1, -1))) {
      expect(USER_CONTENT_ROUTES).toContain(`gemini-proxy:${p}`);
    }
  });

  // IPA-CRON-FIX(2026-11-12 KST): backfill-ipa 크론이 클라이언트용 callGemini(상대 경로 fetch('/api/gemini') + 브라우저 세션)를 써서
  // 서버에서 매번 예외 → catch가 삼켜 실행 3회가 「ok · 0」으로만 남았다. 서버 코드(라우트 · lib/server)는 callLLM만 쓴다.
  it('서버 코드(src/app/**/route.js · src/lib/server)는 클라이언트용 callGemini를 가져오지 않는다', () => {
    const server = files.filter((f) => /[/\\]route\.jsx?$/.test(f) || /src[/\\]lib[/\\]server[/\\]/.test(f));
    expect(server.length).toBeGreaterThan(50);
    const hits = server.filter((f) => /import\s*\{[^}]*\bcallGemini\b[^}]*\}\s*from\s*['"][^'"]*gemini(\.js)?['"]/.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it('Gemini를 직접 부르는 서버 코드는 TTS · llm.js · 사전 경로(관리자 사전 · IPA 채우기)뿐이다', () => {
    const direct = files.filter((f) => /generativelanguage\.googleapis\.com/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f)).sort();
    expect(direct).toEqual(['src/app/api/tts/route.js', 'src/lib/server/llm.js'].sort());
  });
});
