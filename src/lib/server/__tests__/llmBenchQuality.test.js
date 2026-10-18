// LLM-BENCH-QUALITY-001 계약 — 품질 세트(회화 턴 · 작문 첨삭 · 오늘의 문단)는 운영 프롬프트 · 운영 요청 설정 그대로 재고,
// 판정은 사람이 읽는 줄 + 기계 판정(스키마 · 필드 · 길이 · 금지 표현). 사례는 지은 문장(개인정보 0).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import quality from '../llmBenchQualityFixture.json';
import { BENCH_MODELS, benchOnce, toClaudeSchema } from '../llm.js';
import {
  QUALITY_FORBIDDEN, QUALITY_TASKS, parseModelObject, runQualityBench,
  scoreQualityConversation, scoreQualityParagraph, scoreQualityWriting,
} from '../llmBench.js';
import { CONVERSATION_RESPONSE_SCHEMA } from '../../conversation/turnModel.js';
import { FEEDBACK_SCHEMA } from '../../writingPrompts.js';
import { PARAGRAPH_SCHEMA } from '../../studyParagraph.js';
import { sliceBetween } from '../../__tests__/helpers/sliceBetween.js';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const byId = (list, id) => list.find((x) => x.id === id);
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('고정 입력 — 운영 프롬프트 빌더 그대로 · 지은 문장만', () => {
  it('생성기를 다시 돌려도 같은 파일이다(빌더 · 세트가 바뀌면 다시 생성)', () => {
    const out = execFileSync(process.execPath, ['scripts/eval/build-llm-bench-quality-fixture.mjs', '--check'], { encoding: 'utf8' });
    expect(out).toContain('최신');
  }, 60_000);

  it('구성 — 회화 5 · 첨삭 5(오류 아는 4 · 오류 없는 1) · 문단 3(일 · 중 · 영)', () => {
    expect(quality.conversation).toHaveLength(5);
    expect(quality.writing).toHaveLength(5);
    expect(quality.writing.filter((w) => w.expect.clean)).toHaveLength(1);
    expect(quality.paragraph.map((p) => p.language)).toEqual(['Japanese', 'Chinese', 'English']);
    expect(quality.source.personalData).toBe(false);
  });

  it('회화 사례는 대화 평가 세트(지은 문장)의 사례 그대로 — 정치 유도 묶음은 넣지 않는다', () => {
    const set = JSON.parse(read('docs/verification/conversation-eval-20261014.json'));
    for (const c of quality.conversation) {
      expect(set.cases.find((x) => x.id === c.id)).toEqual(c.case);
      expect(c.case.set).not.toBe('political');
    }
    expect(new Set(quality.conversation.map((c) => c.case.set))).toEqual(new Set(['correction', 'repair', 'voice']));
  });

  it('작문 사례 — 아는 오류 조각은 원문에 실제로 있다', () => {
    for (const w of quality.writing.filter((x) => !x.expect.clean)) {
      for (const frag of w.expect.errors) expect(w.text).toContain(frag);
      expect(w.prompt).toContain(w.text);
    }
  });
});

describe('요청 설정 — 운영 호출부와 같은 값', () => {
  const block = (file, start) => sliceBetween(read(file), start, '});');
  it('회화 · 첨삭 · 문단의 temperature · 응답 스키마 · route가 호출부 소스와 같다', () => {
    const conv = block('src/lib/server/conversationTurn.js', "const { text } = await callLLM('standard', prompt, {");
    expect(conv).toContain(`temperature: ${QUALITY_TASKS.conversation.generationConfig.temperature},`);
    expect(conv).toContain('responseSchema: CONVERSATION_RESPONSE_SCHEMA,');
    expect(conv).toContain(`route: '${QUALITY_TASKS.conversation.route}'`);
    expect(conv).toContain(`timeoutMs: ${QUALITY_TASKS.conversation.routeTimeoutMs.toLocaleString('en-US').replace(',', '_')},`);
    const wf = block('src/app/api/writing-feedback/route.js', "const raw = await callLLM('standard', promptText, {");
    expect(wf).toContain(`temperature: ${QUALITY_TASKS.writing.generationConfig.temperature},`);
    expect(wf).toContain('responseSchema: FEEDBACK_SCHEMA,');
    expect(wf).toContain(`route: '${QUALITY_TASKS.writing.route}'`);
    const sp = block('src/app/api/study-paragraph/route.js', "const raw = await callLLM('standard', promptText, {");
    expect(sp).toContain(`temperature: ${QUALITY_TASKS.paragraph.generationConfig.temperature},`);
    expect(sp).toContain('responseSchema: PARAGRAPH_SCHEMA,');
    expect(sp).toContain(`route: '${QUALITY_TASKS.paragraph.route}'`);
    expect(QUALITY_TASKS.conversation.generationConfig.responseSchema).toBe(CONVERSATION_RESPONSE_SCHEMA);
    expect(QUALITY_TASKS.writing.generationConfig.responseSchema).toBe(FEEDBACK_SCHEMA);
    expect(QUALITY_TASKS.paragraph.generationConfig.responseSchema).toBe(PARAGRAPH_SCHEMA);
  });

  it('응답 파서는 운영 라우트의 parseModelJson과 같은 규칙이다(본문 대조)', () => {
    const body = (src, head) => sliceBetween(src, head, '\n}\n').split('\n').slice(1).join('\n'); // 머리줄(이름) 뺀 본문
    const mine = body(read('src/lib/server/llmBench.js'), 'export function parseModelObject(text) {');
    expect(mine).toContain('JSON.parse(t.slice(start, end + 1))'); // 빈 본문끼리의 공허 통과 방지
    for (const f of ['src/app/api/writing-feedback/route.js', 'src/app/api/study-paragraph/route.js']) {
      expect(body(read(f), 'function parseModelJson(text) {')).toBe(mine);
    }
    expect(parseModelObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelObject('앞 {"a":2} 뒤')).toEqual({ a: 2 });
    expect(parseModelObject('없음')).toBeNull();
  });

  it('benchOnce(generationConfig) — Gemini는 운영 그대로(temperature · responseSchema · 최소 thinking)', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gk');
    const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }) }));
    vi.stubGlobal('fetch', spy);
    const r = await benchOnce('gemini-3.6-flash', 'p', { json: true, generationConfig: QUALITY_TASKS.writing.generationConfig });
    expect(r.ok).toBe(true);
    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual({
      contents: [{ parts: [{ text: 'p' }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: FEEDBACK_SCHEMA, thinkingConfig: { thinkingLevel: 'minimal' } },
    });
  });

  it('benchOnce(generationConfig) — Claude는 운영 본선 요청(structured output · 모델 표 · 샘플링 인자 없음)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'ak');
    vi.stubEnv('ANTHROPIC_BASE_URL', '');
    const spy = vi.fn(async () => new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [{ type: 'text', text: '{"lines":[]}' }], stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', spy);
    const r = await benchOnce('claude-sonnet-5-5', 'p', { json: true, generationConfig: QUALITY_TASKS.conversation.generationConfig });
    expect(r).toMatchObject({ ok: true, usage: { in: 5, out: 2, thinking: 0 } });
    const body = JSON.parse(spy.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: 'claude-sonnet-5-5', thinking: { type: 'between_tools' }, output_config: { effort: 'medium', format: { type: 'json_schema', schema: toClaudeSchema(CONVERSATION_RESPONSE_SCHEMA) } } });
    expect(body).not.toHaveProperty('temperature');
    expect(body.messages).toEqual([{ role: 'user', content: 'p' }]); // 스키마가 있으면 꼬리 없음
  });
});

// ── 판정 — 금 응답(설계상 통과)과 어긋난 응답 ──
const convGold = (from, to) => JSON.stringify({ lines: [{ t: '你跟谁见面了？', ko: '누구와 만났어요?' }], feedback: '어순을 한번 볼까요?', focus: { from, to, level: 'retry', kind: 'grammar' }, repair: null });
const PJ1_GOLD = {
  paragraph: '朝ごはんを食べました。店でラーメンを食べたいです。友達もラーメンを食べたいです。',
  translation: '아침밥을 먹었어요. 가게에서 라멘을 먹고 싶어요. 친구도 라멘을 먹고 싶어요.',
  sentences: [
    { text: '朝ごはんを食べました。', pron: 'あさごはんをたべました。', ko: '아침밥을 먹었어요.', tokens: ['朝ごはんを', '食べました。'] },
    { text: '店でラーメンを食べたいです。', pron: 'みせでらーめんをたべたいです。', ko: '가게에서 라멘을 먹고 싶어요.', tokens: ['店で', 'ラーメンを', '食べたいです。'] },
    { text: '友達もラーメンを食べたいです。', pron: 'ともだちもらーめんをたべたいです。', ko: '친구도 라멘을 먹고 싶어요.', tokens: ['友達も', 'ラーメンを', '食べたいです。'] },
  ],
  questions: [
    { type: 'cloze', focus: 'new-grammar', key: '〜たいです', prompt: '店でラーメンを食べ＿＿＿。', answer: 'たいです', distractors: ['ました', 'ません', 'ましょう'], ko: '가게에서 라멘을 먹고 싶어요.' },
    { type: 'vocab', focus: 'due-word', key: '朝ごはん', prompt: '朝ごはん', answer: '아침밥', distractors: ['저녁밥', '점심밥', '간식'], ko: '' },
    { type: 'comprehension', focus: '', key: '', prompt: '무엇을 먹고 싶어요?', answer: '라멘', distractors: ['초밥', '우동', '빵'], ko: '' },
  ],
  preQuestion: { q: '무엇을 먹고 싶어 할까요?', answerHint: '라멘' },
  arcSummary: '친구와 라멘을 먹고 싶어 하는 이야기.',
};

describe('판정 — 기계 검사 + 사람이 읽는 줄', () => {
  it('회화 — 오류 구간을 짚는 금 응답은 통과, 한글 섞인 튜터 줄은 「줄 버림」 · 제품 판정으로 어긋남', () => {
    const czw = byId(quality.conversation, 'CZW01');
    const good = scoreQualityConversation(czw, convGold(czw.case.error, '我昨天跟朋友见面了。'), { ms: 3_000 });
    expect(good.pass).toBe(true);
    expect(good.read.lines[0]).toBe('你跟谁见面了？ — 누구와 만났어요?');
    const slow = scoreQualityConversation(czw, convGold(czw.case.error, '我昨天跟朋友见面了。'), { ms: 16_000 });
    expect(slow.checks.routeTimeout).toBe(false); // 운영 15초 상한 밖
    const hangul = scoreQualityConversation(czw, JSON.stringify({ lines: [{ t: '좋아요! 你跟谁见面了？', ko: '좋아요' }], feedback: null, focus: null, repair: null }));
    expect(hangul.checks.noDroppedLines).toBe(false);
    expect(hangul.pass).toBe(false);
    expect(scoreQualityConversation(czw, null)).toMatchObject({ pass: false, verdict: 'ERROR' });
  });

  it('작문 — 아는 오류를 다 짚으면 통과 · 놓치면 어긋남 · 오류 없는 글에 지적하면 거짓 지적 · 금지 표현을 잡는다', () => {
    const wj = byId(quality.writing, 'WJ1');
    const fb = (errors, summary = '영화를 본 일을 잘 썼어요. 조사 に를 점검해 보세요.') => JSON.stringify({
      score: 3, summary, levelFit: 'fit', naturalness: [],
      sentences: [{ original: wj.text, corrected: '私は昨日友達と映画館に行きました。映画はとても面白かったです。', errors }],
    });
    const both = [{ part: '映画館を行きました', fix: '映画館に行きました', why: '이동 목적지는 に를 써요.', tag: '조사 に' }, { part: '面白いでした', fix: '面白かったです', why: 'い형용사 과거는 かった예요.', tag: 'い형용사 과거' }];
    expect(scoreQualityWriting(wj, fb(both))).toMatchObject({ pass: true, found: '2/2' });
    expect(scoreQualityWriting(wj, fb(both.slice(0, 1)))).toMatchObject({ pass: false, found: '1/2' });
    expect(scoreQualityWriting(wj, fb(both, '잘 썼어요. 조사를 다시 확인해주세요.')).forbiddenHits).toEqual(['해주세요']);
    const clean = byId(quality.writing, 'WE2');
    const noErr = JSON.stringify({ score: 5, summary: '자연스러워요.', levelFit: 'fit', naturalness: [], sentences: [{ original: clean.text, corrected: clean.text, errors: [] }] });
    expect(scoreQualityWriting(clean, noErr)).toMatchObject({ pass: true, falseFlags: 0 });
    const flagged = JSON.stringify({ score: 4, summary: '좋아요.', levelFit: 'fit', naturalness: [], sentences: [{ original: clean.text, corrected: clean.text, errors: [{ part: 'small', fix: 'little', why: '더 자연스러워요.', tag: '어휘' }] }] });
    expect(scoreQualityWriting(clean, flagged)).toMatchObject({ pass: false, falseFlags: 1 });
    expect(scoreQualityWriting(wj, '첨삭할 수 없어요').checks.schema).toBe(false);
  });

  it('문단 — 운영 2차 검증을 통과하고 재료를 다 녹인 금 응답은 통과, 재료 누락 · 괄호 독음 · 문항 지어냄은 어긋남', () => {
    const pj = byId(quality.paragraph, 'PJ1');
    const good = scoreQualityParagraph(pj, JSON.stringify(PJ1_GOLD));
    expect(good).toMatchObject({ pass: true, materials: '3/3', questions: 3 });
    expect(good.read.translation).toBe(PJ1_GOLD.translation);
    const missing = { ...PJ1_GOLD, paragraph: PJ1_GOLD.paragraph.replace('店で', '') };
    expect(scoreQualityParagraph(pj, JSON.stringify(missing)).checks.materials).toBe(false);
    const inline = { ...PJ1_GOLD, paragraph: PJ1_GOLD.paragraph.replace('店', '店(みせ)') };
    expect(scoreQualityParagraph(pj, JSON.stringify(inline)).checks.noInlineReading).toBe(false);
    const madeUp = { ...PJ1_GOLD, questions: PJ1_GOLD.questions.map((q) => (q.type === 'cloze' ? { ...q, prompt: '寿司を食べ＿＿＿。' } : q)) };
    expect(scoreQualityParagraph(pj, JSON.stringify(madeUp)).checks.verified).toBe(false);
  });

  it('금지 표현 표 — 화면 문구 린트의 꼴과 형식 누출', () => {
    expect(QUALITY_FORBIDDEN.map((f) => f.form)).toEqual(['해주세요', '하시겠습니까', '실패했습니다', '```', '**', 'JSON']);
    for (const form of ['해주세요', '하시겠습니까', '실패했습니다']) expect(read('src/lib/__tests__/copyStandard.test.js')).toContain(`form: '${form}'`);
  });
});

describe('runQualityBench — 같은 입력 · 운영 설정 · 기존 단가표', () => {
  it('키가 없으면 호출 0 · 모든 사례를 한 번씩 · 과제별 운영 설정 · 비용은 BENCH_MODELS.price 식', async () => {
    const call = vi.fn();
    expect(await runQualityBench('claude-haiku-5-5', { call })).toMatchObject({ error: 'no_key:ANTHROPIC_API_KEY', set: 'quality' });
    expect(call).not.toHaveBeenCalled();
    vi.stubEnv('ANTHROPIC_API_KEY', 'k');
    const res = vi.fn(async (_id, prompt, opts) => ({ ok: true, ms: 10, text: '{}', usage: { in: 1000, out: 100, thinking: 0 }, prompt, opts }));
    const r = await runQualityBench('claude-sonnet-5-5', { call: res });
    expect(res).toHaveBeenCalledTimes(13);
    const kinds = { conversation: quality.conversation, writing: quality.writing, paragraph: quality.paragraph };
    for (const [kind, items] of Object.entries(kinds)) {
      for (const item of items) {
        const hit = res.mock.calls.find((c) => c[1] === item.prompt);
        expect(hit[0]).toBe('claude-sonnet-5-5');
        expect(hit[2]).toMatchObject({ json: true, generationConfig: QUALITY_TASKS[kind].generationConfig });
      }
    }
    expect(r).toMatchObject({ set: 'quality', calls: { total: 13, ok: 13 }, tokens: { in: 13_000, out: 1_300, thinking: 0 } });
    const [pin, pout] = BENCH_MODELS['claude-sonnet-5-5'].price;
    expect(r.costUsd).toBe(Number(((13_000 * pin + 1_300 * pout) / 1e6).toFixed(5)));
    expect(r.conversation).toMatchObject({ total: 5 });
    expect(r.writing.items.every((x) => x.pass === false)).toBe(true); // '{}'는 형식 밖
  });

  it('실패 호출은 사례별 어긋남과 errors로 남는다(던지지 않는다)', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'k');
    const r = await runQualityBench('gemini-3.6-flash', { call: async () => ({ ok: false, status: 402, code: 'http', detail: { error: { message: 'credits' } }, ms: 5 }) });
    expect(r.errors).toHaveLength(13);
    expect(r.paragraph.pass).toBe(0);
  });
});
