import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// AD-R4 PR④ 계약 — 경계 검수 상수가 꺼져 있으면(ZH_BOUNDARY_REVIEW = false) /api/analyze(중국어)가 현행과 바이트 단위로 같다.
// 스냅숏(__snapshots__/zhBoundaryReviewRoute.off.json)은 이 PR의 제품 코드를 넣기 **전** 기준(#1383 d217833b)에서 떴다.
// 입력은 측정 세트 D 범주 문장(묶여야 할 不客气·得了 / 나뉘어야 할 一个人 / 현행 오병합 人才) + 미등재 후보 身体素质이고,
// 경계 기록 없음·있음(이 자료 기록 redundant 2 + pending 1) 두 번을 돈다. 프롬프트 · 모델 응답 처리(모르는 join 키 무시) ·
// DB 쓰기(조회 .in() 목록·upsert·자가 치유 update·touch) · 응답 JSON 모양을 한 번에 고정한다.
// 설계: docs/manabi-viewer-v2-ad-r4.md §5 · §7(상수 꺼짐 = 현행).

vi.mock('../llm.js', async () => ({ callLLM: (await import('./helpers/zhBoundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('./helpers/zhBoundaryRouteHarness.js')).supabaseModule);
vi.mock('../rateLimit.js', async () => (await import('./helpers/zhBoundaryRouteHarness.js')).rateLimitModule);

import { POST } from '../../../app/api/analyze/route.js';
import { ZB_USER_BOUNDARIES, reset, runRoute } from './helpers/zhBoundaryRouteHarness.js';

const NOW = Date.UTC(2026, 9, 8, 3, 0, 0);

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  reset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('경계 검수 상수 꺼짐 = 현행 스냅숏', () => {
  it('기록 없음·있음 두 요청의 프롬프트·응답 처리·DB 쓰기·응답 JSON이 기준 커밋과 같다', async () => {
    const plain = await runRoute(POST);
    reset();
    const withRecords = await runRoute(POST, { extra: { boundaries: ZB_USER_BOUNDARIES } });
    expect(plain.status).toBe(200);
    expect(withRecords.status).toBe(200);
    await expect(`${JSON.stringify({ plain, withRecords }, null, 2)}\n`).toMatchFileSnapshot('./__snapshots__/zhBoundaryReviewRoute.off.json');
  });

  it('꺼짐에서는 [묶음 판정]·자동 묶기 표식·묶음 후보가 없다', async () => {
    const run = await runRoute(POST);
    expect(run.calls.some((c) => c.prompt.includes('묶음 판정'))).toBe(false);
    const tokens = run.body.results.flatMap((r) => Object.values(r.dictionary));
    expect(tokens.some((t) => 'boundarySuggest' in t || t.boundary)).toBe(false);
  });
});
