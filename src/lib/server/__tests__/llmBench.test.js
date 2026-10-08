// LLM-BENCH-001 계약 — 모델 비교 측정은 운영과 같은 입력·같은 응답 처리로 재고, 운영 경로·데이터에는 손대지 않는다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import fixture from '../llmBenchFixture.json';
import { BENCH_MODELS, TIERS, GROQ_MODEL, benchOnce } from '../llm.js';
import { runBenchModel, zhOutcome, zhPicksFromText } from '../llmBench.js';
import { disambiguateZhPos } from '../disambiguateZhPos.js';
import { buildZhPosPrompt } from '../zhSenseReview.js';

const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class Anthropic { constructor(opts) { this.opts = opts; this.messages = { create: sdk.create }; } }
  Anthropic.APIError = APIError;
  return { default: Anthropic };
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); sdk.create.mockReset(); });

/** 세트 지정대로 답하는 응답 — 대상 단어는 허용 번호(없으면 sense 0 + 허용 ctx), 나머지는 1번. */
function goldText(p) {
  const target = new Map(p.cases.map((c) => [c.markKey, c]));
  return JSON.stringify(p.marks.map((m) => {
    const c = target.get(m.key);
    const n = c?.accept?.sense?.[0];
    const cand = m.candidates?.[(n || 1) - 1];
    const pos = cand?.pos || '명사';
    if (!m.candidates?.length) return { pos, all: [pos] };
    if (c && !n) return { pos, all: [pos], sense: 0, ctx: c.accept?.ctx?.[0] || '' };
    return { pos, all: [pos], sense: n || 1 };
  }));
}

describe('고정 입력 — 제품 함수 결과 그대로', () => {
  it('판별 프롬프트는 문단의 줄·마크로 만든 buildZhPosPrompt와 같다', () => {
    expect(fixture.zhSense.length).toBeGreaterThan(10);
    for (const p of fixture.zhSense) expect(p.prompt).toBe(buildZhPosPrompt(p.lines, p.marks));
  });
  it('생성기를 다시 돌려도 같은 파일이다(세트·제품 함수가 바뀌면 다시 생성)', () => {
    const out = execFileSync(process.execPath, ['scripts/eval/build-llm-bench-fixture.mjs', '--check'], { encoding: 'utf8' });
    expect(out).toContain('최신');
  }, 60_000);
  it('측정 입력에 개인 자료가 없다 — 세트 문장·뜻 생성 표제어·검수 문장만', () => {
    const ids = new Set(JSON.parse(fs.readFileSync('docs/verification/zh-sense-holdout-20261008.json', 'utf8')).cases.map((c) => c.id));
    for (const p of fixture.zhSense) for (const id of p.ids) expect(ids.has(id)).toBe(true);
    expect(fixture.translate.map((t) => t.sentence)).toEqual(['他坐汽车去参观博物馆。', '今天的比赛很壮观，体育场里人很多。', '今日は図書館で新聞を読みました。']);
  });
});

describe('응답 처리 — 운영 disambiguateZhPos와 같은 pick', () => {
  it('같은 응답에서 채점 대상 단어의 pick이 운영 함수와 같다', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    for (const p of fixture.zhSense.slice(0, 4)) {
      const text = goldText(p);
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) })));
      const prod = await disambiguateZhPos(p.lines, p.marks);
      const { picks, lengthOk } = zhPicksFromText(text, p.marks);
      expect(lengthOk).toBe(true);
      for (const c of p.cases) expect(picks.get(c.markKey)).toEqual(prod.get(c.markKey));
    }
  });
  it('길이가 다른 응답은 운영처럼 전부 버린다', () => {
    const p = fixture.zhSense[0];
    expect(zhPicksFromText('[]', p.marks)).toMatchObject({ lengthOk: false });
    expect(zhPicksFromText('[]', p.marks).picks.size).toBe(0);
  });
});

describe('runBenchModel — 채점·집계', () => {
  const callWith = (zh) => vi.fn(async (_id, prompt) => {
    const p = fixture.zhSense.find((x) => x.prompt === prompt);
    const text = p ? zh(p) : prompt.includes('**번역**') ? '**번역**\n그는 차를 타고 박물관을 참관하러 간다.\n\n**맥락**\n…'
      : JSON.stringify(Array.from({ length: fixture.meanings.find((m) => m.prompt === prompt).forms.length }, () => ({ pos: '명사', meanings: [{ meaning: '뜻' }] })));
    return { ok: true, text, ms: 100, usage: { in: 1000, out: 100, thinking: 0 }, status: 200 };
  });

  it('세트 지정대로 답하면 후보가 실린 사례는 대부분 PASS, 빈 응답이면 폴백만 남는다', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'k');
    const gold = await runBenchModel('claude-haiku-5-5', { call: callWith(goldText) });
    const total = fixture.zhSense.reduce((n, p) => n + p.cases.length, 0);
    expect(Object.values(gold.zhSense.verdicts.all).reduce((a, b) => a + b, 0)).toBe(total);
    const offered = gold.zhSense.verdicts.offered;
    const offeredTotal = Object.values(offered).reduce((a, b) => a + b, 0);
    expect(offered.PASS / offeredTotal).toBeGreaterThan(0.9);
    expect(gold.zhSense.lengthOk).toBe(fixture.zhSense.length);
    const empty = await runBenchModel('claude-haiku-5-5', { call: callWith(() => '[]') });
    expect(empty.zhSense.lengthOk).toBe(0);
    expect(empty.zhSense.verdicts.offered.PASS || 0).toBeLessThan(offered.PASS);
    expect(gold.meanings).toMatchObject({ valid: fixture.meanings.length, total: fixture.meanings.length });
    expect(gold.translate.items[0]).toMatchObject({ valid: true, translation: '그는 차를 타고 박물관을 참관하러 간다.' });
    const calls = fixture.zhSense.length + fixture.meanings.length + fixture.translate.length;
    expect(gold.calls).toMatchObject({ total: calls, ok: calls, p50: 100, p95: 100 });
    expect(gold.costUsd).toBeCloseTo((calls * 1000 * 0.10 + calls * 100 * 0.50) / 1e6, 6);
  });

  it('호출 실패는 던지지 않고 ERROR·errors로 남는다 · 키가 없으면 호출 0', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'k');
    const failing = vi.fn(async () => ({ ok: false, code: 'http', status: 429, detail: { error: 'rate' }, ms: 5 }));
    const r = await runBenchModel('gpt-6-luna', { call: failing });
    expect(r.zhSense.verdicts.all.ERROR).toBe(fixture.zhSense.reduce((n, p) => n + p.cases.length, 0));
    expect(r.errors[0]).toMatchObject({ code: 'http', status: 429 });
    vi.stubEnv('GROQ_API_KEY', '');
    const none = vi.fn();
    expect(await runBenchModel('gpt-oss-120b', { call: none })).toMatchObject({ error: 'no_key:GROQ_API_KEY' });
    expect(none).not.toHaveBeenCalled();
  });

  it('대상 토큰이 없으면 BLOCKED(채점에서 숨기지 않는다)', () => {
    expect(zhOutcome({ token: null }, new Map())).toEqual({ blocked: '현행 토큰화가 대상과 다름' });
  });
});

describe('benchOnce — 공급자별 요청 모양(운영과 같은 설정)', () => {
  it('측정 표는 현행 티어 모델·Groq 폴백을 그대로 쓰고, 새 모델 둘을 더한다', () => {
    expect(BENCH_MODELS['gemini-3.6-flash'].model).toBe(TIERS.standard.primary);
    expect(BENCH_MODELS['gemini-3.5-flash-lite'].model).toBe(TIERS.light.primary);
    expect(BENCH_MODELS['gpt-oss-120b'].model).toBe(GROQ_MODEL);
    expect(BENCH_MODELS['claude-haiku-5-5']).toMatchObject({ provider: 'anthropic', model: 'claude-haiku-5-5', env: 'ANTHROPIC_API_KEY' });
    expect(BENCH_MODELS['gpt-6-luna']).toMatchObject({ provider: 'openai', model: 'gpt-6-luna', env: 'OPENAI_API_KEY' });
  });

  it('Haiku 5.5 — thinking 끔·effort low, 샘플링 인자 없음, 재시도 0', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'k');
    sdk.create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '[1]' }], usage: { input_tokens: 10, output_tokens: 3 } });
    const r = await benchOnce('claude-haiku-5-5', '프롬프트', { json: true });
    expect(r).toMatchObject({ ok: true, text: '[1]', usage: { in: 10, out: 3, thinking: 0 } });
    const [body] = sdk.create.mock.calls[0];
    expect(body).toMatchObject({ model: 'claude-haiku-5-5', thinking: { type: 'disabled' }, output_config: { effort: 'low' } });
    expect(body).not.toHaveProperty('temperature');
    expect(body.messages[0].content).toBe('프롬프트\n\nJSON만 출력하세요(설명·코드 블록 없이).');
  });

  it('Haiku 5.5 거절(refusal)은 실패로 센다', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'k');
    sdk.create.mockResolvedValue({ stop_reason: 'refusal', content: [], usage: {} });
    expect(await benchOnce('claude-haiku-5-5', 'x')).toMatchObject({ ok: false, code: 'refusal' });
  });

  it('Luna — reasoning none, temperature 없음, JSON 강제 모드 없음 · Groq — reasoning low', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'ok');
    vi.stubEnv('GROQ_API_KEY', 'gk');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '[]' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }) }));
    vi.stubGlobal('fetch', fetchMock);
    await benchOnce('gpt-6-luna', 'p', { json: true });
    await benchOnce('gpt-oss-120b', 'p', { json: true });
    const [lunaUrl, luna] = fetchMock.mock.calls[0];
    expect(lunaUrl).toBe('https://api.openai.com/v1/chat/completions');
    const lb = JSON.parse(luna.body);
    expect(lb).toMatchObject({ model: 'gpt-6-luna', reasoning_effort: 'none' });
    expect(lb).not.toHaveProperty('temperature');
    expect(lb).not.toHaveProperty('response_format');
    expect(luna.headers.Authorization).toBe('Bearer ok');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ model: GROQ_MODEL, reasoning_effort: 'low', temperature: 0 });
  });

  it('Gemini — 운영과 같은 최소 thinking·temperature 0·JSON MIME', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gk');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    await benchOnce('gemini-3.5-flash-lite', 'p', { json: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig).toEqual({ temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'minimal' } });
    expect(body.contents[0].parts[0].text).toBe('p'); // Gemini는 JSON 꼬리를 붙이지 않는다(운영 프롬프트 그대로)
  });

  it('키가 없으면 호출하지 않는다', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await benchOnce('gpt-6-luna', 'p')).toMatchObject({ ok: false, code: 'no_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
