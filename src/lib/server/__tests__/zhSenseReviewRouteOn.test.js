import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// AD-R4 PR② 계약 — 상수를 켠 상태의 /api/analyze(중국어). 제품 상수는 false로 출시되므로 이 파일만
// 모듈 목으로 ZH_SENSE_REVIEW를 true로 바꿔 켜짐 경로를 고정한다(설계서 §4.1~§4.4·§7·§8).
// 같은 입력·같은 가짜 모델 응답을 쓰는 꺼짐 스냅숏(zhSenseReviewRoute.test.js)과 대조한다.

vi.mock('../llm.js', async () => ({ callLLM: (await import('./helpers/zhAnalyzeRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('./helpers/zhAnalyzeRouteHarness.js')).supabaseModule);
vi.mock('../rateLimit.js', async () => (await import('./helpers/zhAnalyzeRouteHarness.js')).rateLimitModule);
vi.mock('../disambiguateZhPos.js', async (importOriginal) => ({ ...(await importOriginal()), ZH_SENSE_REVIEW: true }));

import { POST } from '../../../app/api/analyze/route.js';
import { reset, runRoute } from './helpers/zhAnalyzeRouteHarness.js';

const NOW = Date.UTC(2026, 9, 7, 11, 0, 0);
const offSnapshot = JSON.parse(readFileSync(new URL('./__snapshots__/zhSenseReviewRoute.off.json', import.meta.url), 'utf8'));

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
const zhPrompt = (run) => run.calls.find((c) => c.route === 'disambiguateZhPos').prompt;

describe('켜짐 — 후보 붙이기(§4.1)', () => {
  it('뜻 2개 이상인 사전 행에만 「뜻 후보」를 싣는다 — user_verified·미싱·재조회·뜻 1개는 빠진다', async () => {
    const prompt = zhPrompt(await runRoute(POST));
    expect(prompt).toContain('"打" (문장 1) 뜻 후보: ①때리다, 치다(동사) ②(전화를) 걸다(동사) ③(운동을) 하다(동사)\n');
    expect(prompt).toContain('"给" (문장 1) 뜻 후보: ①~에게(전치사) ②주다(동사)\n');
    expect(prompt).toContain('"吃醋" (문장 4) 뜻 후보: ①식초를 먹다(동사) ②시샘하다(동사)\n');
    expect(prompt).toContain('"计划" (문장 2)\n');   // user_verified — 오너 확정 첫 뜻 그대로
    expect(prompt).toContain('"篮球" (문장 3)\n');   // ja 미판정 재조회 대상 — 뜻이 바뀌는 중
    expect(prompt).toContain('"妈妈" (문장 1)\n');   // 사전에 없음(병렬 뜻 조회)
    expect(prompt).toContain('"电话" (문장 1)\n');   // 뜻 1개 — 고를 것이 없다
    expect(prompt).toContain('- sense: 「뜻 후보」가 있는 단어만');
    expect(prompt).not.toContain('[묶음 판정');     // 경계 쌍은 PR④
  });

  it('요청당 모델 호출 수는 꺼짐과 같다(판별 1 + 뜻 조회 배치)', async () => {
    const run = await runRoute(POST);
    expect(run.calls.map((c) => c.route)).toEqual(offSnapshot.calls.map((c) => c.route));
    expect(run.calls.find((c) => c.route === 'disambiguateZhPos').opts).toEqual(offSnapshot.calls.find((c) => c.route === 'disambiguateZhPos').opts);
  });
});

describe('켜짐 — 응답 검증·표식(§4.3·§4.4)', () => {
  it('번호 선택은 후보 문구 그대로, 문맥 뜻은 ctx 표식, 품사 어긋남은 doubt, 비정수 번호는 버리고 현행 뜻', async () => {
    const [l0, l1, l2, l3] = tokensOf((await runRoute(POST)).body);
    const at = (line, text) => line.find((t) => t.text === text);
    expect(at(l0, '打')).toMatchObject({ meaning: '(전화를) 걸다' });
    expect(at(l0, '打')).not.toHaveProperty('meaningCheck');
    expect(at(l1, '工作')).toMatchObject({ meaning: '일하다', pos: '명사', meaningCheck: 'doubt' });
    expect(at(l1, '计划')).toMatchObject({ meaning: '계획하다' });      // user_verified — pickZhMeaning 그대로
    expect(at(l1, '计划')).not.toHaveProperty('meaningCheck');
    expect(at(l2, '打')).toMatchObject({ meaning: '때리다, 치다' });     // sense '3'(문자열) → 버림 → 현행
    expect(at(l2, '打')).not.toHaveProperty('meaningCheck');
    expect(at(l3, '吃醋')).toMatchObject({ meaning: '질투하다', meaningCheck: 'ctx' });
  });

  it('표식은 바뀐 토큰에만 붙고, 나머지 토큰은 꺼짐 스냅숏과 같다', async () => {
    const on = tokensOf((await runRoute(POST)).body);
    const off = tokensOf(offSnapshot.body);
    const changed = [];
    on.forEach((line, li) => line.forEach((t, ti) => {
      if (JSON.stringify(t) !== JSON.stringify(off[li][ti])) changed.push(`${li}:${t.text}`);
    }));
    expect(changed).toEqual(['0:打', '1:工作', '3:吃醋']);
  });

  it('stats.zhSense가 붙는다(학습 이벤트 아님)', async () => {
    const { body } = await runRoute(POST);
    expect(body.stats.zhSense).toEqual({
      offered: 6, picked: 2, ctx: 1, doubt: 1, discarded: 1, joinAsked: 0, joinApplied: 0, joinSuggested: 0,
    });
    const { zhSense, ...rest } = body.stats;
    expect(rest).toEqual(offSnapshot.body.stats);
  });
});

describe('켜짐 — 쓰기 경로 보존(§7·§13)', () => {
  it('DB 연산(조회·뜻 upsert·자가 치유 update·touch)이 꺼짐과 바이트 단위로 같다 — 문맥 뜻은 사전에 쓰지 않는다', async () => {
    const run = await runRoute(POST);
    expect(run.ops).toEqual(offSnapshot.ops);
    expect(JSON.stringify(run.ops)).not.toContain('질투하다');
  });
});

describe('켜짐 — 중국어만(§8)', () => {
  it('영어 요청에는 후보·표식·zhSense가 없다', async () => {
    reset([]);
    const run = await runRoute(POST, ['I run every day.'], 'English');
    expect(run.status).toBe(200);
    expect(run.body.stats).not.toHaveProperty('zhSense');
    expect(JSON.stringify(run.body)).not.toContain('meaningCheck');
    expect(run.calls.some((c) => c.prompt.includes('뜻 후보'))).toBe(false);
  });
});
