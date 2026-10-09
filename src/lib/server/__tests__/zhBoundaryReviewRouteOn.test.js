import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// AD-R4 PR④ 계약 — 경계 검수 상수를 켠 /api/analyze(중국어). 제품 상수는 false로 출시되므로 이 파일만 모듈 목으로
// ZH_BOUNDARY_REVIEW를 true로 바꿔 켜짐 경로를 고정한다(설계서 §4.2 · §5.2 · §7 · §8). 같은 입력·같은 가짜 응답의
// 꺼짐 스냅숏(zhBoundaryReviewRoute.test.js)과 대조한다.

vi.mock('../llm.js', async () => ({ callLLM: (await import('./helpers/zhBoundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('./helpers/zhBoundaryRouteHarness.js')).supabaseModule);
vi.mock('../rateLimit.js', async () => (await import('./helpers/zhBoundaryRouteHarness.js')).rateLimitModule);
vi.mock('../zhBoundaryReview.js', async (importOriginal) => ({ ...(await importOriginal()), ZH_BOUNDARY_REVIEW: true }));

import { POST } from '../../../app/api/analyze/route.js';
import { ZB_ROWS, ZB_USER_BOUNDARIES, reset, runRoute, state } from './helpers/zhBoundaryRouteHarness.js';

const NOW = Date.UTC(2026, 9, 8, 3, 0, 0);
const off = JSON.parse(readFileSync(new URL('./__snapshots__/zhBoundaryReviewRoute.off.json', import.meta.url), 'utf8'));

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  reset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const tokensOf = (body) => body.results.map((r) => r.sequence.map((id) => r.dictionary[id]));
const textsOf = (body) => tokensOf(body).map((line) => line.map((t) => t.text));
const zhPrompt = (run) => run.calls.find((c) => c.route === 'disambiguateZhPos').prompt;
const routes = (run) => run.calls.map((c) => c.route);

describe('켜짐 — [묶음 판정]은 같은 판별 호출에(§4.2)', () => {
  it('등재 쌍(个人·不客气·得了)과 사전 행이 있는 미등재 쌍(身体素质)을 앞 토큰 줄에 싣는다 — 현행 오병합 人才는 묻지 않는다', async () => {
    const prompt = zhPrompt(await runRoute(POST));
    expect(prompt).toContain('"身体" (문장 3) [묶음 판정: 身体+素质]\n');
    expect(prompt).toContain('"得" (문장 4) [묶음 판정: 得+了]\n');
    // 앞 토큰이 마크 밖(个 양사 · 不 부사)이면 그 쌍만을 위한 마크를 뒤에 더한다
    expect(prompt).toContain('"个" (문장 1) [묶음 판정: 个+人]\n');
    expect(prompt).toContain('"不" (문장 2) [묶음 판정: 不+客气]\n');
    expect(prompt).toContain('- join: [묶음 판정] 표시 항목만.');
    expect(prompt).not.toMatch(/묶음 판정: [^\]]*人才|묶음 판정: 人\+才/);
    expect((prompt.match(/\[묶음 판정: /g) || []).length).toBe(4);
    // 꺼짐 프롬프트의 마크는 순서·내용 그대로 앞에 있다(응답 길이 계약)
    const offWords = zhPrompt(off.plain).split('## 단어\n')[1].split('\n\n')[0].split('\n');
    const onWords = prompt.split('## 단어\n')[1].split('\n\n')[0].split('\n');
    expect(onWords.slice(0, offWords.length).map((l) => l.replace(/ \[묶음 판정: [^\]]+\]$/, ''))).toEqual(offWords);
  });

  it('판별 호출 수는 꺼짐과 같다(1) — 늘어나는 것은 등재·행 없는 꼴(不客气)의 같은 병렬 뜻 조회뿐', async () => {
    const run = await runRoute(POST);
    expect(routes(run).filter((r) => r === 'disambiguateZhPos')).toHaveLength(routes(off.plain).filter((r) => r === 'disambiguateZhPos').length);
    expect(run.calls.find((c) => c.route === 'disambiguateZhPos').opts).toEqual(off.plain.calls.find((c) => c.route === 'disambiguateZhPos').opts);
    const fetch = run.calls.filter((c) => c.route === 'fetchMeanings');
    expect(fetch).toHaveLength(1);
    expect(fetch[0].prompt).toContain('1. "不客气"');
    expect(fetch[0].prompt).not.toMatch(/"(个人|得了|身体素质)"/); // 행이 있는 꼴은 묻지 않는다
  });

  it('다른 마크가 하나도 없으면 쌍을 싣지 않는다 — 쌍 때문에 판별 호출이 새로 생기지 않는다', async () => {
    // 得了。 — jieba 得(조사)·了(조사)이고 사전 행도 조사뿐이면 판별 마크가 0이다. 得+了는 등재 쌍이지만 싣지 않는다.
    reset(ZB_ROWS.map((r) => (r.base_form === '得' ? { ...r, pos: '조사' } : r)));
    const run = await runRoute(POST, { lines: ['得了。'] });
    expect(routes(run)).toEqual([]);
    expect(textsOf(run.body)).toEqual([['得', '了', '。']]);
  });
});

describe('켜짐 — 경계 결과(§5.2 표)', () => {
  it('등재 + join:true만 자동으로 묶고(표식 ai_registered · 뜻·병음), 미등재 + join:true는 앞 토큰 후보 표식, join:false는 그대로', async () => {
    const { body } = await runRoute(POST);
    expect(textsOf(body)).toEqual([
      ['他', '一', '个', '人', '去', '旅行', '。'],           // 个+人 join:false — 一个人 오병합 0
      ['不客气', '。'],                                        // 등재 + join:true → 자동
      ['运动员', '的', '身体', '素质', '非常', '好', '。'],     // 미등재 → 경계 그대로, 후보만
      ['得了', '，', '别', '再说', '了', '。'],                 // 등재 + join:true → 자동
      ['这个', '人才', '来', '了', '三天', '。'],               // 현행 오병합은 묻지 않는다(그대로)
    ]);
    const [, l1, l2, l3] = tokensOf(body);
    expect(l1[0]).toEqual({ text: '不客气', furigana: 'bú kè qi', pos: '명사', meaning: '不客气의 뜻', base_form: '不客气', boundary: 'ai_registered' });
    expect(l3[0]).toMatchObject({ text: '得了', furigana: 'dé le', pos: '동사', meaning: '됐어, 그만해', base_form: '得了', boundary: 'ai_registered' });
    expect(l2[2]).toMatchObject({ text: '身体', boundarySuggest: '身体素质' });
    expect(l2.filter((t) => t.boundarySuggest)).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/\bAI\b/);
  });

  it('바뀐 토큰은 묶인 줄과 후보 토큰뿐 — 나머지는 꺼짐 스냅숏과 바이트 단위로 같다', async () => {
    const on = tokensOf((await runRoute(POST)).body);
    const offTokens = tokensOf(off.plain.body);
    expect(JSON.stringify(on[0])).toBe(JSON.stringify(offTokens[0]));
    expect(JSON.stringify(on[4])).toBe(JSON.stringify(offTokens[4]));
    const { boundarySuggest, ...rest } = on[2][2];
    expect(boundarySuggest).toBe('身体素质');
    expect(JSON.stringify([...on[2].slice(0, 2), rest, ...on[2].slice(3)])).toBe(JSON.stringify(offTokens[2]));
    expect(JSON.stringify(on[1].slice(1))).toBe(JSON.stringify(offTokens[1].slice(2)));
    expect(JSON.stringify(on[3].slice(1))).toBe(JSON.stringify(offTokens[3].slice(2)));
  });

  it('stats.zhSense에 joinAsked·joinApplied·joinSuggested가 찬다 — 나머지 stats는 뜻 조회 1건 외 꺼짐과 같다', async () => {
    const { body } = await runRoute(POST);
    expect(body.stats.zhSense).toEqual({ offered: 0, picked: 0, ctx: 0, doubt: 0, discarded: 0, joinAsked: 4, joinApplied: 2, joinSuggested: 1 });
    const { zhSense, geminiCalls, ...rest } = body.stats;
    const { geminiCalls: offCalls, ...offRest } = off.plain.body.stats;
    expect(rest).toEqual(offRest);
    expect([offCalls, geminiCalls]).toEqual([0, 1]);
  });

  it('DB: 이은 꼴은 같은 조회 한 번의 .in() 목록에만 더해지고, 경계·후보는 사전에 쓰지 않는다(뜻 조회 upsert는 기존 경로)', async () => {
    const run = await runRoute(POST);
    const selects = run.ops.filter((o) => o.table === 'morpheme_dictionary' && o.op === 'select');
    expect(selects).toHaveLength(1);
    const forms = selects[0].filters.find(([op, k]) => op === 'in' && k === 'base_form')[2];
    const offForms = off.plain.ops.find((o) => o.op === 'select').filters.find(([op, k]) => op === 'in' && k === 'base_form')[2];
    expect(forms.slice(0, offForms.length)).toEqual(offForms);
    expect(forms).toEqual(expect.arrayContaining(['个人', '不客气', '身体素质', '得了']));
    const writes = run.ops.filter((o) => o.op !== 'select');
    expect(JSON.stringify(writes)).not.toMatch(/boundarySuggest|ai_registered|身体素质/);
    const upserts = writes.filter((o) => o.op === 'upsert');
    expect(upserts.flatMap((o) => o.payload.map((r) => r.base_form))).toEqual(['不客气']);
  });
});

describe('켜짐 — 사용자/이 자료 경계 기록이 이긴다(AD-R3 기록 우선)', () => {
  it('기록 구간(적용 · redundant · 적용 못 한 pending)에는 쌍·자동 묶기·후보가 0 — 기록 밖 得了만 묶인다', async () => {
    const run = await runRoute(POST, { extra: { boundaries: ZB_USER_BOUNDARIES } });
    const prompt = zhPrompt(run);
    expect(prompt).not.toContain('个+人');
    expect(prompt).not.toContain('不+客气');
    expect(prompt).not.toContain('身体+素质');
    expect(prompt).toContain('[묶음 판정: 得+了]');
    expect(textsOf(run.body)).toEqual([
      ['他', '一', '个', '人', '去', '旅行', '。'],
      ['不', '客气', '。'],
      ['运动员', '的', '身体', '素质', '非常', '好', '。'],
      ['得了', '，', '别', '再说', '了', '。'],
      ['这个', '人才', '来', '了', '三天', '。'],
    ]);
    const tokens = tokensOf(run.body).flat();
    expect(tokens.filter((t) => t.boundarySuggest)).toEqual([]);
    expect(tokens.filter((t) => t.boundary === 'user').map((t) => t.text)).toEqual(['不', '客气', '身体', '素质']);
    // 기록 결과(boundaryApplied)는 꺼짐 스냅숏과 같다
    expect(JSON.stringify(run.body.results.map((r) => r.boundaryApplied ?? null)))
      .toBe(JSON.stringify(off.withRecords.body.results.map((r) => r.boundaryApplied ?? null)));
    expect(run.calls.filter((c) => c.route === 'fetchMeanings')).toEqual([]);
  });
});

describe('켜짐 — 실패·중국어만(§7 · §8)', () => {
  it('판별 응답이 깨지면(항목이 객체가 아님) 경계·후보 0 — 토큰 경계는 꺼짐과 같다', async () => {
    state.picks = new Proxy({}, { get: () => 'not-an-object' });
    const run = await runRoute(POST);
    const offRun = off.plain;
    expect(JSON.stringify(tokensOf(run.body).map((l) => l.map((t) => [t.text, t.boundary ?? null, t.boundarySuggest ?? null]))))
      .toBe(JSON.stringify(tokensOf(offRun.body).map((l) => l.map((t) => [t.text, null, null]))));
  });

  it('일본어·영어 요청에는 쌍·표식·zhSense가 없다', async () => {
    for (const [language, lines] of [['English', ['I picked up the book.']], ['Japanese', ['天気予報を見た。']]]) {
      reset([]);
      const run = await runRoute(POST, { lines, language });
      expect(run.status).toBe(200);
      expect(run.body.stats).not.toHaveProperty('zhSense');
      expect(JSON.stringify(run.body)).not.toMatch(/boundarySuggest|ai_registered/);
      expect(run.calls.some((c) => c.prompt.includes('묶음 판정'))).toBe(false);
    }
  });
});
