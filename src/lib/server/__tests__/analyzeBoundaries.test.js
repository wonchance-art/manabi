import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// 뷰어 v2 AD-R3 PR② — /api/analyze의 `boundaries`(이 자료의 단어 경계 기록) 서버 적용 계약.
// 정본: docs/manabi-viewer-v2-ad-r3.md §3.4(적용 위치·표식·조각 필드·pending) · §0.4(사용자가 묶은 토큰은 AI가 다시 쪼개지 않는다)
// · §8.1 「서버 적용」. 토크나이저(jieba·kuromoji·lemmatizer)는 실물이고 모델·사전만 가짜다(helpers/boundaryRouteHarness.js).

vi.mock('../llm.js', async () => ({ callLLM: (await import('./helpers/boundaryRouteHarness.js')).callLLM }));
vi.mock('@supabase/supabase-js', async () => (await import('./helpers/boundaryRouteHarness.js')).supabaseModule);
vi.mock('../rateLimit.js', async () => (await import('./helpers/boundaryRouteHarness.js')).rateLimitModule);

import { POST } from '../../../app/api/analyze/route.js';
import { LINES, reset, runRoute } from './helpers/boundaryRouteHarness.js';
import { collectZhPosMarks } from '../disambiguateZhPos';
import { applyBoundaryEdits, applyBoundaryLayers } from '../../boundaryEdits';

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

const tokensOf = (result) => result.sequence.map((id) => result.dictionary[id]);
const texts = (result) => tokensOf(result).map((t) => t.text).join('|');
const zhPrompt = (run) => run.calls.find((c) => c.route === 'disambiguateZhPos')?.prompt || '';
const meaningPrompts = (run) => run.calls.filter((c) => c.route === 'fetchMeanings').map((c) => c.prompt).join('\n');
const lookedUp = (run) => run.ops.filter((op) => op.table === 'morpheme_dictionary' && op.op === 'select')
  .flatMap((op) => op.filters.filter(([kind, key]) => kind === 'in' && key === 'base_form').flatMap(([, , forms]) => forms));
const analyze = (language, boundaries, lines = LINES[language]) => runRoute(POST, { lines, language, boundaries });

describe('중국어 — 묶기 기록이 토큰화 직후 적용되고 기존 분석 경로를 그대로 탄다', () => {
  const merge = { id: 'b_0_4_8', line: 0, start: 4, end: 8, text: '身体素质', cuts: [] };

  it('묶은 조각이 기본형 수집·사전 조회·뜻 조회에 들어가고 boundary 표식이 응답 토큰에 남는다', async () => {
    const run = await analyze('Chinese', [merge]);
    expect(run.status).toBe(200);
    const [line0, line1] = run.body.results;
    expect(texts(line0)).toBe('运动员|的|身体素质|非常|好|。');
    const merged = tokensOf(line0)[2];
    expect(merged).toMatchObject({ text: '身体素质', base_form: '身体素质', furigana: 'shēn tǐ sù zhì', boundary: 'user', meaning: '身体素质의 뜻' });
    expect(lookedUp(run)).toContain('身体素质');
    expect(meaningPrompts(run)).toContain('"身体素质"');
    // 기록이 없는 다른 줄의 토큰에는 표식이 없다.
    expect(tokensOf(line1).some((t) => 'boundary' in t)).toBe(false);
  });

  it('boundaryApplied가 기록마다 status와 새 base(분석기 원래 토큰, 뜻까지 조립)를 돌려준다', async () => {
    const run = await analyze('Chinese', [merge]);
    const [applied] = run.body.results[0].boundaryApplied;
    expect(applied).toMatchObject({ id: 'b_0_4_8', status: 'applied', start: 4, end: 8, cuts: [] });
    expect(applied.base.map((t) => t.text)).toEqual(['身体', '素质']);
    expect(applied.base[0]).toMatchObject({ text: '身体', base_form: '身体', furigana: 'shēn tǐ', pos: '명사', meaning: '身体의 뜻' });
    expect(applied.base.some((t) => 'boundary' in t)).toBe(false);
    expect('boundaryApplied' in run.body.results[1]).toBe(false);
  });

  it('기록 없는 줄은 기록 없는 요청과 같은 토큰을 낸다', async () => {
    const plain = await analyze('Chinese', undefined);
    reset();
    const withEdit = await analyze('Chinese', [merge]);
    expect(withEdit.body.results[1]).toEqual(plain.body.results[1]);
  });

  it('§0.4 사용자가 묶은 토큰은 단어성(OOV) 판정에 넣지 않고, 판별기가 분리를 답해도 쪼개지 않는다', async () => {
    // 社|恐(jieba) → 社恐으로 묶는다. 사전에 없고 품사 단서가 없어 표식이 없으면 [단어성 판정] 대상이다.
    const run = await analyze('Chinese', [{ id: 'b_1_4_6', line: 1, start: 4, end: 6, text: '社恐', cuts: [] }]);
    expect(zhPrompt(run)).toContain('"社恐" (문장 2)');
    expect(zhPrompt(run)).not.toContain('"社恐" (문장 2) [단어성 판정]');
    expect(texts(run.body.results[1])).toBe('他|是|我|的|社恐|朋友|。');
    expect(tokensOf(run.body.results[1])[4]).toMatchObject({ text: '社恐', boundary: 'user' });
  });

  it('분석기가 이미 같은 칼선을 내도(redundant) 기록 구간 토큰에 표식을 단다 — 다음 분석에서 AI가 가르지 못하게', async () => {
    const run = await analyze('Chinese', [{ id: 'b_r', line: 1, start: 6, end: 8, text: '朋友', cuts: [] }]);
    expect(run.body.results[1].boundaryApplied[0]).toMatchObject({ id: 'b_r', status: 'applied', redundant: true });
    expect(run.body.results[1].boundaryApplied[0].base.map((t) => t.text)).toEqual(['朋友']);
    expect(texts(run.body.results[1])).toBe('他|是|我|的|社|恐|朋友|。');
    expect(tokensOf(run.body.results[1])[6]).toMatchObject({ text: '朋友', boundary: 'user' });
  });

  it('라우트 조립부: 표식 있는 토큰에는 OOV 분리(splitZhToken)를 적용하지 않는다(배선 계약)', () => {
    const src = readFileSync(path.join(process.cwd(), 'src/app/api/analyze/route.js'), 'utf8');
    expect(src).toContain('const parts = t.boundary ? null : posPicks.get(zhPosMarkKey(lineIdx, t.text))?.parts;');
    expect(src).toContain('splitZhToken(t, parts)');
  });

  it('구간 글자가 다르면 pending으로 남기고(base 없음) 토큰은 기록 없는 분석과 같다', async () => {
    const plain = await analyze('Chinese', undefined);
    reset();
    const run = await analyze('Chinese', [{ id: 'b_x', line: 0, start: 4, end: 8, text: '身体条件', cuts: [] }]);
    expect(run.body.results[0].boundaryApplied).toEqual([{ id: 'b_x', status: 'pending', reason: 'text_mismatch', base: [] }]);
    expect(run.body.results[0].sequence).toEqual(plain.body.results[0].sequence);
    expect(run.body.results[0].dictionary).toEqual(plain.body.results[0].dictionary);
  });

  it('원문 줄에서 글자가 옮겨졌으면 한 번만 나올 때 옮겨 적용한다(moved)', async () => {
    const run = await analyze('Chinese', [{ id: 'b_m', line: 0, start: 0, end: 4, text: '身体素质', cuts: [] }]);
    expect(run.body.results[0].boundaryApplied[0]).toMatchObject({ status: 'applied', start: 4, end: 8, moved: true });
    expect(texts(run.body.results[0])).toBe('运动员|的|身体素质|非常|好|。');
  });

  it('재절단(칼선 바꾸기)도 같은 한 번의 적용으로 된다 — 运动员 → 运动|员', async () => {
    const run = await analyze('Chinese', [{ id: 'b_s', line: 0, start: 0, end: 3, text: '运动员', cuts: [2] }]);
    expect(texts(run.body.results[0])).toBe('运动|员|的|身体|素质|非常|好|。');
    const [a, b] = tokensOf(run.body.results[0]);
    expect(a).toMatchObject({ text: '运动', furigana: 'yùn dòng', boundary: 'user' });
    expect(b).toMatchObject({ text: '员', furigana: 'yuán', boundary: 'user' });
  });
});

describe('일본어·영어', () => {
  it('일본어 나누기: 映画館 → 映画|館, 조각 읽기는 사전 reading 우선', async () => {
    const run = await analyze('Japanese', [{ id: 'b_j', line: 0, start: 8, end: 11, text: '映画館', cuts: [10] }]);
    expect(texts(run.body.results[0])).toBe('明日|は|申し込ん|だ|映画|館|に|行き|ます|。');
    const t = tokensOf(run.body.results[0]);
    expect(t[4]).toMatchObject({ text: '映画', base_form: '映画', furigana: 'えいが', meaning: '영화', boundary: 'user' });
    expect(t[5]).toMatchObject({ text: '館', base_form: '館', boundary: 'user' });
    expect(run.body.results[0].boundaryApplied[0].base.map((x) => [x.text, x.furigana, x.meaning])).toEqual([['映画館', 'えいがかん', '영화관']]);
  });

  it('영어 묶기: picked|up → picked up(사이 공백 원문 그대로), 기본형 pick up으로 사전·뜻 조회', async () => {
    const run = await analyze('English', [{ id: 'b_e', line: 0, start: 1, end: 9, text: 'pickedup', cuts: [] }]);
    expect(texts(run.body.results[0])).toBe('I|picked up|the|book|.');
    expect(tokensOf(run.body.results[0])[1]).toMatchObject({ text: 'picked up', base_form: 'pick up', boundary: 'user', meaning: 'pick up의 뜻' });
    expect(lookedUp(run)).toContain('pick up');
    expect(run.body.results[0].boundaryApplied[0].base.map((x) => x.text)).toEqual(['picked', 'up']);
  });
});

describe('입력 검증', () => {
  it('boundaries가 배열이 아니거나 줄 번호가 요청 줄 밖이면 400', async () => {
    expect((await analyze('Chinese', { line: 0 })).status).toBe(400);
    reset();
    expect((await analyze('Chinese', [{ id: 'b', line: 5, start: 0, end: 2, text: '运动', cuts: [] }])).status).toBe(400);
    reset();
    expect((await analyze('Chinese', [null])).status).toBe(400);
  });

  it('기록 모양이 틀리면 그 기록만 pending(invalid_edit) — 조용히 버리지 않는다', async () => {
    const run = await analyze('Chinese', [{ id: 'b_bad', line: 0, start: 4, end: 8, text: '身体素质', cuts: 'x' }]);
    expect(run.status).toBe(200);
    expect(run.body.results[0].boundaryApplied).toEqual([{ id: 'b_bad', status: 'pending', reason: 'invalid_edit', base: [] }]);
  });
});

// PR① 「PR②에서 정할 것」 3 — 기록 구간 안에서 분석기 토큰과 같은 조각(그대로 쓴 토큰)과, 분석기가 이미 같은 칼선을 낸
// redundant 기록의 토큰에도 표식이 붙어 단어성(OOV) 판정에서 빠진다(서버 적용은 markRedundant).
describe('같은 조각·redundant 기록의 표식 → OOV 판정 제외', () => {
  const tok = (text, extra = {}) => ({ text, base_form: text, furigana: '', pos: null, ...extra });
  const entries = (list) => list.map((token, k) => ({ id: `t${k}`, token }));
  const line = () => entries([tok('我', { pos: '대명사' }), tok('笔在'), tok('桌'), tok('子')]);
  const oovWords = (tokens) => collectZhPosMarks([{ tokens: tokens.map((e) => e.token) }], new Map()).filter((m) => m.oov).map((m) => m.word);

  it('기록이 없으면 笔在는 단어성 판정 대상이다(기준)', () => {
    expect(oovWords(line())).toEqual(['笔在']);
  });

  it('구간 안 같은 조각(笔在)은 표식을 받아 OOV에서 빠진다', () => {
    const r = applyBoundaryEdits(line(), [{ id: 'b', line: 0, start: 1, end: 5, text: '笔在桌子', cuts: [3] }], { language: 'Chinese' });
    expect(r.tokens.map((e) => e.token.text)).toEqual(['我', '笔在', '桌子']);
    expect(r.tokens[1].token.boundary).toBe('user');
    expect(oovWords(r.tokens)).toEqual([]);
  });

  it('redundant 기록: 표식 없이 같은 참조(PR① 계약) / 서버 적용(markRedundant)은 표식을 단다', () => {
    const tokens = line();
    const record = { id: 'b', line: 0, start: 1, end: 3, text: '笔在', cuts: [] };
    expect(applyBoundaryEdits(tokens, [record], { language: 'Chinese' }).tokens).toBe(tokens);
    const marked = applyBoundaryEdits(tokens, [record], { language: 'Chinese', markRedundant: true });
    expect(marked.results[0]).toMatchObject({ status: 'applied', redundant: true, base: [tokens[1]] });
    expect(marked.tokens[1].token).toMatchObject({ text: '笔在', boundary: 'user' });
    expect(marked.tokens[0]).toBe(tokens[0]);
    expect(oovWords(marked.tokens)).toEqual([]);
  });
});

// PR① 「PR②에서 정할 것」 2 — 범위 간 적용 순서(§3.4): 공유 규칙 → 사용자 규칙 → 이 자료 기록, 뒤가 이긴다.
// 지금은 「이 자료」 기록만 있으므로 호출 순서 계약만 고정한다(규칙 표는 PR④).
describe('applyBoundaryLayers — 공유 → 사용자 → 이 자료, 뒤가 이긴다', () => {
  const zh = (text, furigana) => ({ text, base_form: text, furigana, pos: '명사' });
  const line = () => [zh('运动员', 'yùn dòng yuán'), zh('的', 'de'), zh('身体', 'shēn tǐ'), zh('素质', 'sù zhì'), zh('非常', 'fēi cháng')]
    .map((token, k) => ({ id: `t${k}`, token }));
  const shared = { id: 's', line: 0, start: 3, end: 6, text: '的身体', cuts: [] };
  const material = { id: 'm', line: 0, start: 4, end: 8, text: '身体素质', cuts: [] };
  const user = { id: 'u', line: 0, start: 8, end: 10, text: '非常', cuts: [9] };

  it('겹치면 뒤 층(이 자료)이 적용되고 앞 층(공유)은 pending(overlap). 결과는 층마다 입력 순서', () => {
    const r = applyBoundaryLayers(line(), [
      { marker: 'shared_rule', edits: [shared] },
      { marker: 'user_rule', edits: [user] },
      { marker: 'user', edits: [material] },
    ], { language: 'Chinese' });
    expect(r.tokens.map((e) => e.token.text)).toEqual(['运动员', '的', '身体素质', '非', '常']);
    expect(r.tokens[2].token.boundary).toBe('user');
    expect(r.tokens[3].token.boundary).toBe('user_rule');
    expect(r.layers.map((layer) => layer.map((x) => [x.id, x.status, x.reason]))).toEqual([
      [['s', 'pending', 'overlap']],
      [['u', 'applied', undefined]],
      [['m', 'applied', undefined]],
    ]);
  });

  it('이 자료 층만 있으면 applyBoundaryEdits 한 번과 같다', () => {
    const tokens = line();
    const layered = applyBoundaryLayers(tokens, [{ marker: 'user', edits: [material] }], { language: 'Chinese' });
    const single = applyBoundaryEdits(tokens, [material], { language: 'Chinese' });
    expect(layered.tokens).toEqual(single.tokens);
    expect(layered.layers[0]).toEqual(single.results);
    expect(applyBoundaryLayers(tokens, [], { language: 'Chinese' }).tokens).toBe(tokens);
  });
});
