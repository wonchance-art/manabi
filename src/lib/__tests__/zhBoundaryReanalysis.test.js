import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 뷰어 v2 AD-R4 PR④ — 경계 검수 켜짐에서 「재분석 뒤 유지」와 「사용자/이 자료 경계 기록이 이긴다」(설계서 §5.2 · §7, AD-R3 기록 우선).
// 실제 analyzeText(analyzeHybrid) → fetch → /api/analyze(가짜 모델·사전, 상수만 목으로 켬) → runPreservedReanalysis → RPC 저장 인자로 확인한다.
// 사용자 묶기·나누기는 AD-R3 순수 함수(editBoundaries·assignBoundaryPieceIds·replaceBoundaryLine)로 흉내 낸다(화면은 boundaryEditFlow).

vi.mock('../server/llm.js', async () => ({ callLLM: (await import('../server/__tests__/helpers/zhBoundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('../server/__tests__/helpers/zhBoundaryRouteHarness.js')).supabaseModule);
vi.mock('../server/rateLimit.js', async () => (await import('../server/__tests__/helpers/zhBoundaryRouteHarness.js')).rateLimitModule);
vi.mock('../server/zhBoundaryReview.js', async (importOriginal) => ({ ...(await importOriginal()), ZH_BOUNDARY_REVIEW: true }));
vi.mock('../supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } } }));

import { POST } from '../../app/api/analyze/route.js';
import { ZB_LINES, reset, routeFetch, state } from '../server/__tests__/helpers/zhBoundaryRouteHarness.js';
import { analyzeText } from '../analyzeText';
import { runPreservedReanalysis } from '../reanalysisPreservation';
import {
  assignBoundaryPieceIds, boundaryLineEntries, editBoundaries, readBoundaryEdits, replaceBoundaryLine, withBoundarySuggestionDismissed,
} from '../boundaryEdits';
import { senseReviewItems } from '../viewerSenseReview';

const T0 = Date.UTC(2026, 9, 8, 3, 0, 0);
const RAW = ZB_LINES.join('\n');
let bodies, rpcs, uuid, at;

const client = () => ({
  from: () => {
    const chain = { select: () => chain, eq: () => chain, order: () => chain, range: async () => ({ data: [], error: null }) };
    return chain;
  },
  rpc: async (name, args) => {
    rpcs.push({ name, args: JSON.parse(JSON.stringify(args)) });
    return { data: { material: { id: args.p_id, raw_text: args.p_raw, processed_json: args.p_json } }, error: null };
  },
});

beforeEach(() => {
  at = T0;
  vi.useFakeTimers({ now: T0, toFake: ['Date'] });
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
const lineTexts = (json, line) => boundaryLineEntries(json, line).map((e) => e.token.text);
const lineTokens = (json, line) => boundaryLineEntries(json, line).map((e) => e.token);
const boundaryItems = (json) => senseReviewItems(json, 'Chinese').filter((item) => item.kind === 'boundary');
const prompts = () => state.calls.filter((c) => c.route === 'disambiguateZhPos').map((c) => c.prompt);

async function material() {
  const json = await analyzeText(RAW, signal(), { metadata: { language: 'Chinese' } });
  bodies.splice(0);
  state.calls = [];
  return { id: 9, raw_text: RAW, processed_json: json };
}

async function reanalyze(mat) {
  vi.setSystemTime((at += 60_000));
  state.calls = [];
  await runPreservedReanalysis(client(), mat, signal(), analyzeText, { fullReset: true });
  const [{ args }] = rpcs.splice(0);
  return { ...mat, processed_json: args.p_json };
}

/** 화면(boundaryEditFlow)이 할 일을 순수 함수로 — 묶기/나누기 한 번 → processed_json. 새 조각은 분석 없이 잠정 필드. */
function edit(json, line, request, rev) {
  const r = editBoundaries(boundaryLineEntries(json, line), readBoundaryEdits(json), { line, ...request },
    { language: 'Chinese', lineText: RAW.split('\n')[line] });
  expect(r.ok && r.changed).toBe(true);
  const entries = r.restored ? r.tokens : assignBoundaryPieceIds(r.tokens, line, rev);
  return replaceBoundaryLine(json, line, entries, r.edits);
}

describe('켜짐 — 분석 결과가 자료에 남는 모양', () => {
  it('등재 자동 묶기는 토큰 표식 ai_registered(기록 없음), 미등재 후보는 「뜻 확인 필요」 목록의 경계 항목 하나', async () => {
    const { processed_json: json } = await material();
    expect(lineTexts(json, 1)).toEqual(['不客气', '。']);
    expect(lineTokens(json, 1)[0]).toMatchObject({ boundary: 'ai_registered', meaning: '不客气의 뜻' });
    expect(lineTexts(json, 3)[0]).toBe('得了');
    expect(readBoundaryEdits(json)).toEqual([]); // 자동 묶기는 이 자료 기록이 아니다 — 사용자가 나누면 기록이 생긴다
    expect(boundaryItems(json)).toEqual([expect.objectContaining({ form: '身体素质', parts: ['身体', '素质'], tokenId: `id_2_2_${T0}`, nextId: `id_2_3_${T0}` })]);
  });
});

describe('재분석 뒤 유지', () => {
  it('자동 묶기는 재분석 뒤에도 같은 자리에 다시 묶이고(OOV 분리 제외 표식), id는 같은 위치·표면 규칙으로 이어진다', async () => {
    const mat = await material();
    const id = boundaryLineEntries(mat.processed_json, 1)[0].id;
    const next = await reanalyze(mat);
    expect(lineTexts(next.processed_json, 1)).toEqual(['不客气', '。']);
    expect(boundaryLineEntries(next.processed_json, 1)[0]).toMatchObject({ id, token: { boundary: 'ai_registered' } });
  });

  it('[아니요]로 접은 꼴은 재분석 뒤에도 접힌 채다 — 서버가 후보 표식을 다시 달아도 목록 항목 0, 접은 목록은 metadata에 남는다', async () => {
    const mat = await material();
    const dismissed = { ...mat, processed_json: withBoundarySuggestionDismissed(mat.processed_json, '身体素质') };
    expect(boundaryItems(dismissed.processed_json)).toEqual([]);
    const next = await reanalyze(dismissed);
    expect(lineTokens(next.processed_json, 2)[2]).toMatchObject({ text: '身体', boundarySuggest: '身体素质' });
    expect(next.processed_json.metadata.viewerBoundaryDismissed).toEqual(['身体素质']);
    expect(boundaryItems(next.processed_json)).toEqual([]);
    // 다른 줄은 그대로
    expect(lineTexts(next.processed_json, 1)).toEqual(['不客气', '。']);
  });
});

describe('사용자/이 자료 경계 기록이 이긴다(AD-R3)', () => {
  it('자동으로 묶인 得了를 사용자가 나누면 기록이 생기고, 재분석은 그 구간을 묻지도 묶지도 않는다', async () => {
    const mat = await material();
    const split = { ...mat, processed_json: edit(mat.processed_json, 3, { start: 0, end: 2, cuts: [1] }, 'rev1aaaa') };
    expect(lineTexts(split.processed_json, 3).slice(0, 2)).toEqual(['得', '了']);
    const next = await reanalyze(split);
    expect(prompts().join('\n')).not.toContain('得+了');
    expect(lineTexts(next.processed_json, 3).slice(0, 2)).toEqual(['得', '了']);
    expect(lineTokens(next.processed_json, 3).slice(0, 2).map((t) => t.boundary)).toEqual(['user', 'user']);
    expect(readBoundaryEdits(next.processed_json)).toEqual([expect.objectContaining({ line: 3, start: 0, end: 2, cuts: [1], status: 'applied' })]);
    // 다른 줄의 자동 묶기는 그대로
    expect(lineTexts(next.processed_json, 1)).toEqual(['不客气', '。']);
  });

  it('후보를 사용자가 묶으면(AD-R3 묶기) 재분석 뒤 그 묶음이 기록으로 유지되고 후보 항목은 사라진다', async () => {
    const mat = await material();
    const merged = { ...mat, processed_json: edit(mat.processed_json, 2, { start: 4, end: 8, cuts: [] }, 'rev2bbbb') };
    expect(boundaryItems(merged.processed_json)).toEqual([]);
    const next = await reanalyze(merged);
    expect(prompts().join('\n')).not.toContain('身体+素质');
    expect(lineTexts(next.processed_json, 2)).toEqual(['运动员', '的', '身体素质', '非常', '好', '。']);
    expect(lineTokens(next.processed_json, 2)[2]).toMatchObject({ boundary: 'user', meaning: '신체 조건' });
    expect(boundaryItems(next.processed_json)).toEqual([]);
  });
});
