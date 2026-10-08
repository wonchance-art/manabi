import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 뷰어 v2 AD-R3 PR② 회귀 계약 — 경계 기록이 없는 자료의 분석·재분석은 기준 커밋과 바이트 단위로 같다.
// 실제 analyzeText(analyzeHybrid) → fetch → /api/analyze 라우트(가짜 모델·가짜 사전) → runPreservedReanalysis → RPC 인자까지
// 한 줄로 잇는다. 스냅숏(__snapshots__/boundaryReanalysis.none.json)은 PR② 제품 코드를 넣기 **전** 기준 커밋(PR① 15e9500a)에서 떴다.
// 장면: 새 분석 · 전체 재분석 · 선택 줄 재분석 · 원문 수정(줄 삽입 + 줄 수정, buildEditPlan) — 중·일·영.

vi.mock('../server/llm.js', async () => ({ callLLM: (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).supabaseModule);
vi.mock('../server/rateLimit.js', async () => (await import('../server/__tests__/helpers/boundaryRouteHarness.js')).rateLimitModule);
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));

import { POST } from '../../app/api/analyze/route.js';
import { reset, routeFetch } from '../server/__tests__/helpers/boundaryRouteHarness.js';
import { analyzeText } from '../analyzeText';
import { runPreservedReanalysis } from '../reanalysisPreservation';
import { buildEditPlan } from '../sourceEdit';

const NOW = Date.UTC(2026, 9, 7, 12, 0, 0);
export const RAW = {
  Chinese: '运动员的身体素质非常好。\n他是我的社恐朋友。\n\n身体好。',
  Japanese: '明日は申し込んだ映画館に行きます。\n天気予報を見た。\n\n映画館は近い。',
  English: 'I picked up the book.\nShe looked after them.\n\nPick up the pen.',
};
export const EDITED = {
  Chinese: '新的一行。\n运动员的身体素质非常好。\n他是我的好朋友。\n\n身体好。',
  Japanese: '新しい行。\n明日は申し込んだ映画館に行きます。\n天気予報を聞いた。\n\n映画館は近い。',
  English: 'A new line.\nI picked up the book.\nShe looked after us.\n\nPick up the pen.',
};

let bodies, rpcs, uuid;
export function harnessClient(rows = []) {
  return {
    from: () => {
      const chain = { select: () => chain, eq: () => chain, order: () => chain, range: async () => ({ data: rows, error: null }) };
      return chain;
    },
    rpc: async (name, args) => {
      rpcs.push({ name, args: JSON.parse(JSON.stringify(args)) });
      return { data: { material: { id: args.p_id, raw_text: args.p_raw, processed_json: args.p_json } }, error: null };
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  uuid = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`);
  bodies = [];
  rpcs = [];
  vi.stubGlobal('fetch', routeFetch(POST, bodies));
  reset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const signal = () => new AbortController().signal;
const take = () => ({ bodies: bodies.splice(0), rpcs: rpcs.splice(0) });

async function scenes(language) {
  const raw = RAW[language];
  const json0 = await analyzeText(raw, signal(), { metadata: { language } });
  const created = { ...take(), json0 };
  const material = { id: 7, raw_text: raw, processed_json: json0 };
  await runPreservedReanalysis(harnessClient(), material, signal(), analyzeText, { fullReset: true });
  const full = take();
  await runPreservedReanalysis(harnessClient(), material, signal(), analyzeText, { selectedLineIndices: [1] });
  const selective = take();
  const plan = buildEditPlan(raw, EDITED[language], json0);
  await runPreservedReanalysis(harnessClient(), material, signal(), analyzeText, {
    selectedLineIndices: plan.selected, rawTextOverride: plan.newText, baseJsonOverride: plan.remapped,
  });
  const edited = take();
  return { created, full, selective, edited };
}

describe('경계 기록 없음 = 기준 커밋과 같은 분석·재분석(중·일·영)', () => {
  it('요청 본문 · 새 분석 결과 · 재분석 저장 인자가 스냅숏과 같다', async () => {
    const out = {};
    for (const language of ['Chinese', 'Japanese', 'English']) out[language] = await scenes(language);
    // 요청 본문에 boundaries 키가 생기지 않는다(원문 문자열 그대로 비교).
    for (const language of Object.keys(out)) {
      for (const scene of Object.values(out[language])) for (const { body } of scene.bodies) expect(body).not.toContain('boundaries');
    }
    await expect(`${JSON.stringify(out, null, 2)}\n`).toMatchFileSnapshot('./__snapshots__/boundaryReanalysis.none.json');
  });
});
