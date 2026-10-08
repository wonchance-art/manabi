import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  baselineB0, buildParagraphs, buildZhSensePromptDraft, collectPairCandidates, evaluateRelease, matchCandidate,
  scoreCase, senseFragments, summarize, validateHoldout, validateSensePickDraft,
} from '../../../scripts/eval/zhSenseHoldout.mjs';
import { disambiguateZhPos, pickZhMeaning, zhPosMarkKey } from '../server/disambiguateZhPos.js';
import { isCanonPos } from '../server/posCanon.js';

// AD-R4 PR① — 중국어 「이 문장 뜻」 측정 세트(ZH-SENSE-HOLDOUT-001)와 채점기 계약.
// 설계서 docs/manabi-viewer-v2-ad-r4.md §3·§4.3. 제품 코드는 바꾸지 않는다(시안 프롬프트는 eval 전용).

const set = JSON.parse(readFileSync(new URL('../../../docs/verification/zh-sense-holdout-20261008.json', import.meta.url), 'utf8'));
const byId = (id) => set.cases.find((c) => c.id === id);
const clone = (x) => JSON.parse(JSON.stringify(x));

describe('측정 세트 — 무결성', () => {
  it('형식 검증을 통과하고 조정 40 · 보류 40이다', () => {
    expect(validateHoldout(set)).toEqual([]);
    expect(set.cases).toHaveLength(80);
    expect(set.cases.filter((c) => c.split === 'tune')).toHaveLength(40);
    expect(set.cases.filter((c) => c.split === 'holdout')).toHaveLength(40);
  });

  it('범주 분포가 설계서 §3.4와 같다(A 6/6 · B 10/10 · C 8/8 · D 8/8 · E 4/4 · F 4/4)', () => {
    const want = { A: 6, B: 10, C: 8, D: 8, E: 4, F: 4 };
    for (const [cat, n] of Object.entries(want)) {
      for (const split of ['tune', 'holdout']) {
        expect(set.cases.filter((c) => c.cat === cat && c.split === split).length, `${cat}/${split}`).toBe(n);
      }
    }
    expect(set.criticalCategories).toEqual(['B', 'D']);
  });

  it('조정·보류는 문장을 하나도 공유하지 않는다', () => {
    const tune = new Set(set.cases.filter((c) => c.split === 'tune').map((c) => c.sentence));
    expect(set.cases.filter((c) => c.split === 'holdout' && tune.has(c.sentence)).map((c) => c.id)).toEqual([]);
  });

  it('보류 세트는 조정에 쓰지 않는다는 규칙과 소모 규칙을 세트 안에 적는다', () => {
    const rules = set.rules.join('\n');
    expect(rules).toContain('보류(holdout) 세트는 프롬프트·후처리 조정에 쓰지 않는다');
    expect(rules).toContain('소모');
  });

  it('모든 사례의 표면형이 문장의 지정 위치에 있다', () => {
    for (const c of set.cases) expect(c.sentence.slice(c.target.index, c.target.index + c.target.surface.length), c.id).toBe(c.target.surface);
  });

  it('뜻 사례마다 금지 오답과 이유가 있고, 허용 번호와 금지 번호가 겹치지 않는다', () => {
    for (const c of set.cases.filter((x) => x.cat !== 'D')) {
      expect(c.forbidden.length, c.id).toBeGreaterThan(0);
      for (const f of c.forbidden) expect(f.why, c.id).toBeTruthy();
      const forbid = c.forbidden.map((f) => f.sense).filter((s) => s != null);
      expect((c.accept.sense || []).filter((s) => forbid.includes(s)), c.id).toEqual([]);
    }
  });

  it('E는 후보 밖 정답(ctx)만, 나머지 뜻 사례는 후보 번호 정답을 갖는다', () => {
    for (const c of set.cases.filter((x) => x.cat === 'E')) expect(c.accept.ctx?.length && !c.accept.sense, c.id).toBeTruthy();
    for (const c of set.cases.filter((x) => !['D', 'E'].includes(x.cat))) expect(c.accept.sense?.length, c.id).toBeGreaterThan(0);
  });

  it('기대 품사와 후보 품사는 중국어 품사 정본 안에 있다', () => {
    for (const c of set.cases.filter((x) => x.cat !== 'D')) {
      expect(isCanonPos('Chinese', c.pos), c.id).toBe(true);
      for (const m of c.candidates) expect(isCanonPos('Chinese', m.pos), `${c.id} ${m.meaning}`).toBe(true);
    }
  });

  it('후보는 아직 운영 스냅숏이 아니라 임시 후보임을 사례마다 표시한다', () => {
    for (const c of set.cases.filter((x) => x.cat !== 'D')) expect(c.candidatesSource, c.id).toMatch(/^provisional:/);
  });

  it('번체 쌍둥이는 쌍과 같은 세트·같은 기대 답이다', () => {
    for (const c of set.cases.filter((x) => x.cat === 'F')) {
      const twin = byId(c.twinOf);
      expect(twin.split, c.id).toBe(c.split);
      expect(c.accept, c.id).toEqual(twin.accept);
    }
  });

  it('조정·보류 문장 공유, 허용·금지 겹침, 표면형 위치 오류, 분포 이탈을 잡는다', () => {
    const shared = clone(set);
    shared.cases.find((c) => c.id === 'A07').sentence = byId('A01').sentence;
    expect(validateHoldout(shared).join('\n')).toContain('A07: 조정·보류가 같은 문장을 공유함');

    const overlap = clone(set);
    overlap.cases.find((c) => c.id === 'B01').forbidden.push({ sense: 2, why: 'x' });
    expect(validateHoldout(overlap).join('\n')).toContain('B01: 허용과 금지가 겹침 2');

    const moved = clone(set);
    moved.cases.find((c) => c.id === 'C01').target.index = 0;
    expect(validateHoldout(moved).join('\n')).toContain('C01: 문장의 0 위치에 표면형');

    const skew = clone(set);
    skew.cases.find((c) => c.id === 'B20').split = 'tune';
    expect(validateHoldout(skew).join('\n')).toContain('구성: B/tune 11건 ≠ 10');

    const noForbid = clone(set);
    noForbid.cases.find((c) => c.id === 'A01').forbidden = [];
    expect(validateHoldout(noForbid).join('\n')).toContain('A01: 금지 오답 없음');
  });
});

describe('채점 — 판정 규칙', () => {
  const B01 = byId('B01'); // 打电话: ②(전화를) 걸다 허용, ①·③ 금지
  const B13 = byId('B13'); // 送花: ② 허용, ③ 금지, ① 지정 밖
  const E03 = byId('E03'); // 火: 후보 밖 「인기 있다」
  const E04 = byId('E04'); // 黑: 1글자 금지 표현 「검」

  it('허용 후보 = PASS, 금지 후보 = FAIL, 지정 밖 후보 = REVIEW', () => {
    expect(scoreCase(B01, { meaning: '(전화를) 걸다' })).toMatchObject({ verdict: 'PASS', sense: 2 });
    expect(scoreCase(B01, { meaning: '때리다, 치다' })).toMatchObject({ verdict: 'FAIL', sense: 1 });
    expect(scoreCase(B13, { meaning: '보내다' })).toMatchObject({ verdict: 'REVIEW', sense: 1 });
  });

  it('후보 밖 문맥 뜻: 허용 표현 = PASS, 금지 표현 = FAIL, 그 밖 = REVIEW', () => {
    expect(scoreCase(E03, { meaning: '인기 있다', via: 'ctx' }).verdict).toBe('PASS');
    expect(scoreCase(E03, { meaning: '화나다', via: 'ctx' }).verdict).toBe('FAIL');
    expect(scoreCase(E03, { meaning: '뜨겁다', via: 'ctx' }).verdict).toBe('REVIEW');
    expect(scoreCase(E03, { meaning: '불' }).verdict, '후보 문구 그대로면 후보 번호로 본다').toBe('FAIL');
  });

  it('한 글자 금지 표현은 조각 단위로만 잡는다(「검」이 「검사하다」에서 오탐하지 않음)', () => {
    expect(scoreCase(E04, { meaning: '검', via: 'ctx' }).verdict).toBe('FAIL');
    expect(scoreCase(E04, { meaning: '검사하다', via: 'ctx' }).verdict).toBe('REVIEW');
    expect(scoreCase(E04, { meaning: '해킹당하다', via: 'ctx' }).verdict).toBe('PASS');
  });

  it('호출 실패 = ERROR, 대상이 다른 경계로 잘림·뜻 없음 = BLOCKED', () => {
    expect(scoreCase(B01, { error: 'call: 503' }).verdict).toBe('ERROR');
    expect(scoreCase(B01, { blocked: '현행 토큰화가 대상과 다름: 打了个' }).verdict).toBe('BLOCKED');
    expect(scoreCase(B01, { meaning: '' }).verdict).toBe('BLOCKED');
  });

  it('경계: 기대와 같으면 PASS, 오병합·미결합은 FAIL, 미등재 후보 제시는 REVIEW, 자동 오병합은 표시한다', () => {
    const D01 = byId('D01'); // 一个人 — 个人으로 묶이면 안 됨
    const D05 = byId('D05'); // 不客气 — 묶여야 함
    expect(scoreCase(D01, { merged: false }).verdict).toBe('PASS');
    expect(scoreCase(D01, { merged: true, autoMerged: true })).toMatchObject({ verdict: 'FAIL', wrongAutoMerge: true });
    expect(scoreCase(D05, { merged: true }).verdict).toBe('PASS');
    expect(scoreCase(D05, { merged: false }).verdict).toBe('FAIL');
    expect(scoreCase(D05, { merged: false, suggested: true }).verdict).toBe('REVIEW');
    expect(scoreCase(D05, {}).verdict).toBe('ERROR');
  });

  it('B0는 현행 pickZhMeaning(후보, 정답 품사) — 품사를 맞혀도 같은 품사 다의는 첫 뜻이다', () => {
    expect(scoreCase(byId('A02'), baselineB0(byId('A02'), pickZhMeaning)).verdict, '겸류는 품사로 갈린다').toBe('PASS');
    expect(scoreCase(B01, baselineB0(B01, pickZhMeaning)).verdict, '같은 품사 다의는 못 가른다').toBe('FAIL');
    expect(scoreCase(byId('C10'), baselineB0(byId('C10'), pickZhMeaning)).verdict).toBe('FAIL');
    expect(scoreCase(byId('D06'), baselineB0(byId('D06'), pickZhMeaning, true)).verdict, '현행 把手 오병합').toBe('FAIL');
    expect(baselineB0(byId('D06'), pickZhMeaning).error).toBeTruthy();
  });

  it('뜻 정규화는 괄호 보충을 빼고 쉼표 조각으로 비교한다', () => {
    expect(senseFragments('(전화를) 걸다')).toEqual(['걸다']);
    expect(senseFragments('때리다, 치다')).toEqual(['때리다', '치다']);
    expect(matchCandidate(B01.candidates, '걸다')).toBe(2);
    expect(matchCandidate(B01.candidates, '치다')).toBe(1);
    expect(matchCandidate(B01.candidates, '전화하다')).toBe(0);
  });
});

describe('N 시안 응답 검증 — 설계서 §4.3 표', () => {
  const cands = byId('B01').candidates;
  const mark = { word: '打', candidates: cands };
  const isCanon = (p) => isCanonPos('Chinese', p);

  it('pos ∉ all이면 그 단어를 통째로 버린다(뜻도)', () => {
    expect(validateSensePickDraft({ all: ['동사'], pos: '명사', sense: 2 }, mark, isCanon)).toEqual({ discarded: 'pos' });
  });
  it('정수 sense 1..n은 그 후보 문구를 그대로 쓴다. 후보 품사가 판정 품사와 다르면 doubt', () => {
    expect(validateSensePickDraft({ all: ['동사'], pos: '동사', sense: 2 }, mark, isCanon).sense).toEqual({ meaning: '(전화를) 걸다', via: 'sense' });
    const zai = byId('C01').candidates;
    expect(validateSensePickDraft({ all: ['동사', '전치사'], pos: '동사', sense: 2 }, { word: '在', candidates: zai }, isCanon).sense)
      .toEqual({ meaning: '~에서', via: 'sense', meaningCheck: 'doubt' });
  });
  it('범위 밖·비정수·문자열(후보 문구를 다시 쓴 답) sense는 버린다', () => {
    for (const sense of [4, -1, 1.5, '2', '(전화를) 걸다', null]) {
      const v = validateSensePickDraft({ all: ['동사'], pos: '동사', sense }, mark, isCanon);
      expect(v.sense, JSON.stringify(sense)).toBeUndefined();
      expect(v.senseDiscarded, JSON.stringify(sense)).toBeTruthy();
      expect(v.pos).toBe('동사');
    }
  });
  it('sense 0 + 한글 ctx 1~10자는 문맥 뜻, 후보와 같은 뜻이면 그 후보로 바꾼다', () => {
    expect(validateSensePickDraft({ all: ['동사'], pos: '동사', sense: 0, ctx: '질투하다' }, mark, isCanon).sense)
      .toEqual({ meaning: '질투하다', via: 'ctx', meaningCheck: 'ctx' });
    expect(validateSensePickDraft({ all: ['동사'], pos: '동사', sense: 0, ctx: '걸다' }, mark, isCanon).sense)
      .toEqual({ meaning: '(전화를) 걸다', via: 'sense' });
  });
  it('sense 0인데 ctx가 없거나 10자 초과·한글 없음·한자 섞임이면 버리고 doubt', () => {
    for (const ctx of [undefined, '', '아주아주아주아주긴뜻이다', 'hack', '해킹黑']) {
      const v = validateSensePickDraft({ all: ['동사'], pos: '동사', sense: 0, ctx }, mark, isCanon);
      expect(v.sense, String(ctx)).toBeUndefined();
      expect(v.meaningCheck, String(ctx)).toBe('doubt');
    }
  });
  it('후보 없는 단어의 sense는 무시하고, join은 묶음 판정 마크에서만 받는다', () => {
    expect(validateSensePickDraft({ all: ['명사'], pos: '명사', sense: 1, join: true }, { word: '电话' }, isCanon)).toEqual({ pos: '명사', all: ['명사'] });
    expect(validateSensePickDraft({ all: ['양사'], pos: '양사', join: false }, { word: '个', pair: ['个', '人'] }, isCanon)).toMatchObject({ join: false });
    expect(validateSensePickDraft({ all: ['양사'], pos: '양사', join: 'yes' }, { word: '个', pair: ['个', '人'] }, isCanon).join).toBeUndefined();
  });
  it('all은 품사 정본으로 거른다(현행과 같은 X 게이트)', () => {
    expect(validateSensePickDraft({ all: ['동사·喝咖啡'], pos: '동사·喝咖啡' }, { word: '喝' }, isCanon)).toEqual({ discarded: 'pos' });
  });
});

describe('N 시안 프롬프트 — 현행 프롬프트 + 추가분', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const lines = ['我给妈妈打了一个电话。', '他一个人去旅行。'];
  const marks = [
    { lineIdx: 0, word: '打', key: zhPosMarkKey(0, '打') },
    { lineIdx: 0, word: '电话', key: zhPosMarkKey(0, '电话') },
    { lineIdx: 1, word: '旅行', key: zhPosMarkKey(1, '旅行') },
  ];

  it('추가분이 없으면 현행 buildZhPosPrompt와 바이트 단위로 같다', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    let sent = '';
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      sent = JSON.parse(opts.body).contents[0].parts[0].text;
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }) };
    }));
    await disambiguateZhPos(lines, marks);
    expect(sent).not.toBe('');
    expect(buildZhSensePromptDraft(lines, marks)).toBe(sent);
  });

  it('후보 있는 단어에만 「뜻 후보」를, 쌍의 앞 토큰에만 [묶음 판정]을 붙이고 규칙을 더한다', () => {
    const withExtras = [
      { ...marks[0], candidates: byId('B01').candidates },
      marks[1],
      { lineIdx: 1, word: '个', key: zhPosMarkKey(1, '个'), pair: ['个', '人'] },
    ];
    const prompt = buildZhSensePromptDraft(lines, withExtras);
    expect(prompt).toContain('1. "打" (문장 1) 뜻 후보: ①때리다, 치다(동사) ②(전화를) 걸다(동사) ③(운동을) 하다(동사)');
    expect(prompt).toContain('2. "电话" (문장 1)\n');
    expect(prompt).toContain('3. "个" (문장 2) [묶음 판정: 个+人]');
    expect(prompt).toContain('- sense: 「뜻 후보」가 있는 단어만');
    expect(prompt).toContain('- ctx: sense가 0일 때만. 이 문장에서의 한국어 뜻, 10자 이내');
    expect(prompt).toContain('- join: [묶음 판정] 표시 항목만');
    expect(buildZhSensePromptDraft(lines, marks)).not.toContain('sense');
  });
});

describe('실행 묶음 · 쌍 후보 · 켜는 기준', () => {
  it('문단은 한 세트 안에서만 묶이고(4~6문장), 모든 사례가 한 번씩 들어간다', () => {
    const pars = buildParagraphs(set.cases);
    expect(pars.flatMap((p) => p.cases.map((c) => c.id)).sort()).toEqual(set.cases.map((c) => c.id).sort());
    for (const p of pars) {
      expect(new Set(p.cases.map((c) => c.split)).size).toBe(1);
      expect(p.cases.length).toBeGreaterThanOrEqual(4);
      expect(p.cases.length).toBeLessThanOrEqual(6);
    }
  });

  it('등재된 꼴만 이웃 한자 토큰 쌍으로 묻는다', () => {
    const tok = (text) => ({ text, base_form: text });
    const lines = [{ tokens: [tok('他'), tok('一'), tok('个'), tok('人'), tok('去'), tok('。')] }];
    const pairs = collectPairCandidates(lines, (w) => w === '个人');
    expect(pairs).toEqual([{ lineIdx: 0, a: '个', b: '人', start: 2 }]);
  });

  const rowsOf = (arm, verdicts) => Object.entries(verdicts).map(([id, verdict]) => ({ arm, id, cat: byId(id).cat, split: byId(id).split, verdict }));
  const stats = { b1: { calls: [1, 1], ms: [800, 900] }, n: { calls: [1, 1], ms: [900, 1200] } };

  it('보류 세트에서 치명 FAIL 감소 · 전체 FAIL 30% 이상 감소 · PASS→FAIL ≤1 · 호출 수 같음이면 충족', () => {
    const b1 = rowsOf('B1', { B11: 'FAIL', B12: 'FAIL', C10: 'FAIL', A07: 'PASS', D09: 'PASS' });
    const n = rowsOf('N', { B11: 'PASS', B12: 'PASS', C10: 'FAIL', A07: 'PASS', D09: 'PASS' });
    expect(evaluateRelease(set, [...b1, ...n], stats)).toMatchObject({ status: '켜기 기준 충족', reasons: [] });
  });

  it('조정 세트 결과는 기준에 넣지 않는다', () => {
    const rows = [...rowsOf('B1', { B01: 'FAIL', B02: 'FAIL' }), ...rowsOf('N', { B01: 'PASS', B02: 'PASS' })];
    expect(evaluateRelease(set, rows, stats).status).toBe('보류');
  });

  it('자동 오병합 1건, PASS→FAIL 2건, 감소 30% 미만, 호출 수 차이는 각각 보류 사유다', () => {
    const b1 = rowsOf('B1', { B11: 'FAIL', B12: 'FAIL', B13: 'FAIL', A07: 'PASS', A08: 'PASS', D09: 'PASS' });
    const n = rowsOf('N', { B11: 'PASS', B12: 'FAIL', B13: 'FAIL', A07: 'FAIL', A08: 'FAIL', D09: 'FAIL' });
    n.find((r) => r.id === 'D09').wrongAutoMerge = true;
    const r = evaluateRelease(set, [...b1, ...n], { b1: stats.b1, n: { calls: [1, 2], ms: stats.n.ms } });
    expect(r.status).toBe('보류');
    const text = r.reasons.join('\n');
    expect(text).toContain('오병합 자동 적용 1건: D09');
    expect(text).toContain('B1 PASS → N FAIL 3건');
    expect(text).toContain('전체 FAIL 감소');
    expect(text).toContain('요청당 호출 수가 다름');
  });

  it('기준을 넘어도 REVIEW가 남으면 사람 판정 대기, 호출 오류가 있으면 보류', () => {
    const b1 = rowsOf('B1', { B11: 'FAIL', B12: 'FAIL', A07: 'PASS' });
    expect(evaluateRelease(set, [...b1, ...rowsOf('N', { B11: 'PASS', B12: 'PASS', A07: 'REVIEW' })], stats).status).toBe('사람 판정 대기');
    expect(evaluateRelease(set, [...b1, ...rowsOf('N', { B11: 'PASS', B12: 'ERROR', A07: 'PASS' })], stats).reasons.join()).toContain('호출 오류');
  });

  it('집계는 팔·세트별 판정 수와 치명 범주 FAIL을 센다', () => {
    const s = summarize(set, rowsOf('B0', { B11: 'FAIL', D09: 'FAIL', A07: 'PASS', E05: 'REVIEW' }));
    expect(s['B0/holdout']).toMatchObject({ total: 4, PASS: 1, FAIL: 2, REVIEW: 1, criticalFail: ['B11', 'D09'] });
  });
});
