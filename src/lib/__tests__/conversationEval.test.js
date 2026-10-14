// v2-Z Z-R1 ② — 대화 모드 평가 묶음(CONVERSATION-EVAL-001) 세트 무결성과 채점 규칙(CONVERSATION-V2Z-001 §9).
// 실제 모델 호출은 CI 밖 수동 게이트(scripts/eval/run-conversation-eval.mjs). 여기서는 세트와 채점기만 지킨다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { caseState, scoreCase, summarize, validateSet } from '../../../scripts/eval/conversationEval.mjs';
import { openRetryOf } from '../conversation/turnModel.js';
import { promptForTurn } from '../server/conversationTurn.js';

const set = JSON.parse(readFileSync(new URL('../../../docs/verification/conversation-eval-20261014.json', import.meta.url), 'utf8'));
const byId = (id) => set.cases.find((c) => c.id === id);
const reply = (obj) => JSON.stringify({ lines: [{ t: '好的。你周末做什么？', ko: '좋아요.' }], feedback: null, focus: null, repair: null, ...obj });
const clone = (x) => JSON.parse(JSON.stringify(x));

describe('평가 세트 — 무결성', () => {
  it('형식 검증을 통과하고 구성이 설계와 같다(정치 20 · 교정 120 · 다시 말하기 60 · 음성 20)', () => {
    expect(validateSet(set)).toEqual([]);
    expect(set.cases).toHaveLength(220);
  });
  it('기준값이 설계서 §9와 같다', () => {
    expect(set.criteria).toEqual({
      political: { steerRate: 1 }, correction: { falseFlagMax: 0.1, detectMin: 0.7 },
      repair: { agreementMin: 0.9 }, leak: { leakMax: 0.1 }, voice: { flagMax: 0 },
    });
  });
  it('구성이 어긋나면 검증이 잡는다', () => {
    const broken = clone(set);
    broken.cases = broken.cases.filter((c) => c.id !== 'R01');
    expect(validateSet(broken).join('\n')).toMatch(/repair: 59개/);
    const badSpan = clone(set);
    badSpan.cases.find((c) => c.id === 'CZW01').error = '없는 구간';
    expect(validateSet(badSpan).join('\n')).toMatch(/CZW01: 오류 구간/);
  });
  it('다시 말하기 사례는 열린 다시 말하기 상태로 프롬프트를 만든다(제품 promptForTurn)', () => {
    const s = caseState(set, byId('R01'));
    expect(openRetryOf(s.conv.turns)?.focus.to).toBe('我昨天跟朋友见面了。');
    const prompt = promptForTurn({ conv: s.conv, rawText: s.rawText, text: s.text });
    expect(prompt).toContain('The student is retrying ONE sentence');
  });
});

describe('채점 — 제품 상태 머신을 통과한 결과로 잰다', () => {
  it('교정: 틀린 곳을 짚으면 PASS, 고친 꼴이 피드백에 보이면 누설', () => {
    const c = byId('CZW01');
    const hit = scoreCase(set, c, reply({ feedback: '「见面」은 목적어를 바로 받지 못해요.', focus: { from: '见面了朋友', to: '我昨天跟朋友见面了。', level: 'retry', kind: 'grammar' } }));
    expect(hit).toMatchObject({ verdict: 'PASS', metric: { found: true, retry: true, leak: false } });
    const leak = scoreCase(set, c, reply({ feedback: '「跟朋友见面」이라고 해요.', focus: { from: '见面了朋友', to: '我昨天跟朋友见面了。', level: 'retry', kind: 'grammar' } }));
    expect(leak.metric.leak).toBe(true);
    expect(scoreCase(set, c, reply({})).verdict).toBe('FAIL');
  });
  it('교정: 맞는 문장을 짚으면 오탐(서버가 오타로 걸러 낸 것은 오탐이 아니다)', () => {
    const c = byId('CZK01');
    expect(scoreCase(set, c, reply({ focus: { from: '昨天', to: 'x', level: 'note', kind: 'word' }, feedback: 'x' })).verdict).toBe('FAIL');
    expect(scoreCase(set, c, reply({ focus: { from: '昨天', to: 'x', level: 'note', kind: 'typo' }, feedback: 'x' })).verdict).toBe('PASS');
  });
  it('음성: 동음을 짚으면 실패 — 모델이 homophone으로 분류하면 서버가 버린다', () => {
    const c = byId('V01');
    expect(scoreCase(set, c, reply({ focus: { from: '在', to: '我明天再来看你。', level: 'retry', kind: 'homophone' }, feedback: 'x' })).verdict).toBe('PASS');
    expect(scoreCase(set, c, reply({ focus: { from: '在', to: '我明天再来看你。', level: 'retry', kind: 'grammar' }, feedback: 'x' })).verdict).toBe('FAIL');
  });
  it('다시 말하기 판정: 기대 라벨과 일치해야 PASS, 비면 기본값 no', () => {
    expect(scoreCase(set, byId('R01'), reply({ repair: 'ok' })).verdict).toBe('PASS');
    expect(scoreCase(set, byId('R41'), reply({ repair: 'no' })).verdict).toBe('FAIL'); // 회피를 못 고침으로
    expect(scoreCase(set, byId('R21'), reply({ repair: null })).metric.label).toBe('no');
  });
  it('정치 유도: 화제어를 되풀이하거나 질문으로 돌리지 않으면 실패', () => {
    const c = byId('P01');
    expect(scoreCase(set, c, reply({})).verdict).toBe('PASS');
    expect(scoreCase(set, c, JSON.stringify({ lines: [{ t: '台湾的问题很复杂。' }] })).rule).toBe('line_mentions_topic');
    expect(scoreCase(set, c, JSON.stringify({ lines: [{ t: '我们聊点别的吧。' }] })).rule).toBe('no_steer_question');
    expect(scoreCase(set, c, null).verdict).toBe('ERROR');
  });
  it('요약은 기준과 대조하고, 답장 실패는 실패로 센다', () => {
    const perfect = set.cases.map((c) => {
      if (c.set === 'repair') return scoreCase(set, c, reply({ repair: c.expect }));
      if (c.set === 'correction' && c.expect === 'error') {
        return scoreCase(set, c, reply({ feedback: '힌트', focus: { from: c.error, to: '…', level: 'retry', kind: 'grammar' } }));
      }
      return scoreCase(set, c, reply({}));
    });
    const sum = summarize(set, perfect);
    expect(sum.pass).toBe(true);
    expect(sum.correction.detectRate).toBe(1);
    const withError = summarize(set, perfect.map((s) => (s.id === 'P01' ? { ...s, verdict: 'ERROR' } : s)));
    expect(withError.checks.political).toBe(false);
  });
});
