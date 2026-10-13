import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 뷰어 v2 AD-R3 PR④ — /api/analyze의 단어 경계 규칙(② user_segment_rules · ③ shared_segment_rules) 적용 계약.
// 정본: docs/manabi-viewer-v2-ad-r3.md §5.1 · §5.2 · §5.3 「표가 없으면 폴백」 · §3.4 순서(공유 → 사용자 → 이 자료, 뒤가 이긴다).
// 토크나이저는 실물, 모델 · 사전 · 규칙 표만 가짜다(helpers/boundaryRouteHarness.js).

vi.mock('../llm.js', async () => ({ callLLM: (await import('./helpers/boundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('./helpers/boundaryRouteHarness.js')).supabaseModule);
vi.mock('../rateLimit.js', async () => (await import('./helpers/boundaryRouteHarness.js')).rateLimitModule);

import { POST } from '../../../app/api/analyze/route.js';
import { LINES, ROWS, reset, runRoute, state } from './helpers/boundaryRouteHarness.js';

const NOW = Date.UTC(2026, 9, 7, 12, 0, 0);

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  reset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const LANGS = ['Chinese', 'Japanese', 'English'];
const tokensOf = (result) => result.sequence.map((id) => result.dictionary[id]);
const shown = (result) => tokensOf(result).map((t) => `${t.text}${t.boundary ? `:${t.boundary}` : ''}`).join('|');
const ruleReads = (run) => run.ops.filter((op) => op.table === 'user_segment_rules' || op.table === 'shared_segment_rules');
const analyze = (language, rules, extra = {}) => {
  reset(ROWS, rules);
  return runRoute(POST, { lines: LINES[language], language, segmentRules: true, ...extra });
};
const plain = (language, extra = {}) => {
  reset();
  return runRoute(POST, { lines: LINES[language], language, ...extra });
};
const rule = (language, surface, cuts = []) => ({ language, surface, cuts });

describe('규칙 없음 · 표 없음 = 기존 분석과 바이트 단위로 같다(§5.3 폴백 · 회귀 계약)', () => {
  it.each(LANGS)('%s: 빈 표 · 표 없음(PGRST205 · 42P01) · 읽기 오류 모두 응답 JSON이 플래그 없는 요청과 같다', async (language) => {
    const base = JSON.stringify((await plain(language)).body);
    const original = console.warn;
    console.warn = () => {};
    try {
      for (const tables of [
        {},
        { user_segment_rules: { error: { code: 'PGRST205' } }, shared_segment_rules: { error: { code: 'PGRST205' } } },
        { user_segment_rules: { error: { code: '42P01' } }, shared_segment_rules: { error: { code: '42P01' } } },
        { user_segment_rules: { error: { code: '42501', message: 'denied' } }, shared_segment_rules: [] },
        // 다른 언어 규칙 · 이 줄에 안 맞는 규칙 · 검증에 어긋난 행
        { user_segment_rules: [rule('Korean', '도서관'), rule(language, '없는꼴'), rule(language, 'x', [5])] },
      ]) {
        const run = await analyze(language, tables);
        expect(run.status).toBe(200);
        expect(JSON.stringify(run.body)).toBe(base);
      }
    } finally { console.warn = original; }
  });

  it('플래그가 없는 요청(드래그 · 빠른 분석 · 묶기 한 줄)은 규칙 표를 읽지 않는다', async () => {
    reset(ROWS, { user_segment_rules: [rule('Chinese', '身体素质')] });
    const run = await runRoute(POST, { lines: LINES.Chinese, language: 'Chinese' });
    expect(ruleReads(run)).toEqual([]);
    expect(shown(run.body.results[0])).toBe('运动员|的|身体|素质|非常|好|。');
  });
});

describe('규칙 적용 — 토큰화 직후 · 기존 분석 경로를 그대로 탄다', () => {
  it('읽기는 요청당 표마다 1회(사용자 JWT RLS · 본인 user_id · language) · 규칙 표 쓰기 0', async () => {
    const run = await analyze('Chinese', { user_segment_rules: [rule('Chinese', '身体素质')] });
    expect(ruleReads(run).map((op) => [op.table, op.op, op.filters, op.limit])).toEqual([
      ['shared_segment_rules', 'select', [['eq', 'language', 'Chinese']], 500],
      ['user_segment_rules', 'select', [['eq', 'user_id', 'reader'], ['eq', 'language', 'Chinese']], 500],
    ]);
  });

  it('중국어: 사용자 묶기 규칙 → user_rule 표식 · 묶은 꼴이 사전 조회 · 뜻 조회에 들어간다 · boundaryApplied 없음', async () => {
    const run = await analyze('Chinese', { user_segment_rules: [rule('Chinese', '身体素质')] });
    const [line0, line1] = run.body.results;
    expect(shown(line0)).toBe('运动员|的|身体素质:user_rule|非常|好|。');
    expect(tokensOf(line0)[2]).toMatchObject({ base_form: '身体素质', furigana: 'shēn tǐ sù zhì', meaning: '身体素质의 뜻' });
    expect(line0).not.toHaveProperty('boundaryApplied');
    expect(tokensOf(line1).some((t) => 'boundary' in t)).toBe(false);
  });

  it('공유 규칙(나누기 · 묶기)은 shared_rule 표식 · 겹치면 사용자 규칙이 이긴다', async () => {
    const run = await analyze('Chinese', {
      shared_segment_rules: [rule('Chinese', '运动员', [2]), rule('Chinese', '素质非常')],
      user_segment_rules: [rule('Chinese', '身体素质')],
    });
    expect(shown(run.body.results[0])).toBe('运动:shared_rule|员:shared_rule|的|身体素质:user_rule|非常|好|。');
  });

  it('이 자료 기록(boundaries)이 겹치는 규칙을 이기고, boundaryApplied에는 기록만 실린다', async () => {
    const record = { id: 'b_0_6_10', line: 0, start: 6, end: 10, text: '素质非常', cuts: [] };
    const run = await analyze('Chinese', { user_segment_rules: [rule('Chinese', '身体素质')] }, { boundaries: [record] });
    const [line0] = run.body.results;
    expect(shown(line0)).toBe('运动员|的|身体|素质非常:user|好|。');
    expect(line0.boundaryApplied).toHaveLength(1);
    expect(line0.boundaryApplied[0]).toMatchObject({ id: 'b_0_6_10', status: 'applied' });
    expect(line0.boundaryApplied[0].base.map((t) => t.text)).toEqual(['素质', '非常']);
  });

  it('사용자 규칙으로 묶은 토큰은 AI 단어성 판정(OOV 분리)에 넣지 않는다(§0.4)', async () => {
    const run = await analyze('Chinese', { user_segment_rules: [rule('Chinese', '社恐朋友')] });
    const prompt = run.calls.find((c) => c.route === 'disambiguateZhPos')?.prompt || '';
    expect(shown(run.body.results[1])).toBe('他|是|我|的|社恐朋友:user_rule|。');
    expect(prompt).not.toContain('"社恐朋友" (문장 2) [단어성 판정]');
  });

  it('일본어 나누기 · 영어 묶기: 정확한 꼴 · 경계에 맞는 자리에만', async () => {
    // 天気予報는 분석기가 이미 한 토큰이라 묶기 규칙이 바꿀 것이 없다(규칙 없을 때와 같다).
    const ja = await analyze('Japanese', { user_segment_rules: [rule('Japanese', '映画館', [2]), rule('Japanese', '天気予報')] });
    expect(shown(ja.body.results[0])).toContain('映画:user_rule|館:user_rule');
    expect(shown(ja.body.results[1])).not.toContain('user_rule');
    const en = await analyze('English', { user_segment_rules: [rule('English', 'picked up'), rule('English', 'look after')] });
    expect(shown(en.body.results[0])).toContain('picked up:user_rule');
    // 「look after」는 looked|after에 걸리지 않는다(정확한 꼴만).
    expect(shown(en.body.results[1])).not.toContain('user_rule');
  });

  it('규칙 경로의 DB 쓰기는 기존 분석과 같은 사전 쓰기뿐 — 단어장 · 문맥 · 평가 이력 · 규칙 표 쓰기 0', async () => {
    const run = await analyze('Chinese', { user_segment_rules: [rule('Chinese', '身体素质')], shared_segment_rules: [rule('Chinese', '运动员', [2])] });
    const writes = run.ops.filter((op) => op.rpc || op.op !== 'select');
    const tables = new Set(writes.map((op) => op.table || `rpc:${op.rpc}`));
    for (const t of tables) expect(['morpheme_dictionary', 'rpc:touch_morphemes']).toContain(t);
    expect(state.segmentRules.user_segment_rules).toHaveLength(1);
  });
});
