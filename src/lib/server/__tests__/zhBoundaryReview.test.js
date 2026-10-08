import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokenizeZhLine } from '../tokenizeZh.js';
import { collectZhPosMarks } from '../disambiguateZhPos.js';
import {
  ZH_AUTO_BOUNDARY_MARKER, ZH_BOUNDARY_MAX_PAIRS, ZH_BOUNDARY_REVIEW, applyZhBoundaryJoins, attachZhBoundaryPairs,
  collectZhBoundaryPairs, collectZhPairLookupForms, zhBoundaryBlockedRegions,
} from '../zhBoundaryReview.js';
import { scoreCase } from '../../../../scripts/eval/zhSenseHoldout.mjs';

// AD-R4 PR④ — 경계 검수 순수 함수(설계서 docs/manabi-viewer-v2-ad-r4.md §5 · §4.2 · §9.1 「등재 정의」「경계 자동 조건」).
// 등재 + join:true만 자동 묶기(표식 ai_registered), 미등재 + join:true는 앞 토큰에 후보 표식, AD-R3 기록 구간·표식 토큰은 쌍 0.

const lineOf = (text) => ({ original: text, tokens: tokenizeZhLine(text) });
const texts = (line) => line.tokens.map((t) => t.text);
const pickMap = (pairs, join) => new Map(pairs.map((p) => [p.key, { pos: null, all: [], join: typeof join === 'function' ? join(p) : join }]));

describe('상수 — 꺼진 채 출시(§0.1 · §10 ②′와 같은 원칙)', () => {
  it('ZH_BOUNDARY_REVIEW = false, 쌍 상한 20, 자동 표식 ai_registered', () => {
    expect(ZH_BOUNDARY_REVIEW).toBe(false);
    expect(ZH_BOUNDARY_MAX_PAIRS).toBe(20);
    expect(ZH_AUTO_BOUNDARY_MARKER).toBe('ai_registered');
  });
});

describe('쌍 만들기(§5.2) — 이은 꼴이 등재이거나 사전 행이 있는 이웃 한자 쌍', () => {
  it('등재 꼴은 행 없이도 쌍(个人·不客气), 미등재는 사전 행이 있을 때만(身体素质), 문장부호를 넘지 않는다', () => {
    const lines = ['他一个人去旅行。', '不客气。', '运动员的身体素质非常好。', '得了，别再说了。'].map(lineOf);
    const marks = collectZhPosMarks(lines, new Map());
    const bare = collectZhBoundaryPairs(lines, { cache: new Map(), marks });
    expect(bare.map((p) => [p.lineIdx, p.form, p.registered])).toEqual([[0, '个人', true], [1, '不客气', true], [3, '得了', true]]);
    const withRow = collectZhBoundaryPairs(lines, { cache: new Map([['身体素质', { source: 'gemini', meanings: [{ meaning: '신체 조건' }] }]]), marks });
    expect(withRow.map((p) => p.form)).toEqual(['个人', '不客气', '身体素质', '得了']);
    expect(withRow[2]).toMatchObject({ lineIdx: 2, index: 2, a: '身体', b: '素质', start: 4, end: 8, key: '2:身体', registered: false, reading: 'shēn tǐ sù zhì' });
  });

  it('표식(boundary) 토큰·요청 기록 구간(적용 못 한 pending 포함)과 겹치는 쌍은 만들지 않는다 — 사용자 경계가 이긴다', () => {
    const lines = ['他一个人去旅行。', '不客气。'].map(lineOf);
    lines[1].tokens = lines[1].tokens.map((t) => (t.text === '客气' ? { ...t, boundary: 'user' } : t));
    const marks = collectZhPosMarks(lines, new Map());
    expect(collectZhBoundaryPairs(lines, { cache: new Map(), marks }).map((p) => p.form)).toEqual(['个人']);
    const blocked = zhBoundaryBlockedRegions(new Map([[0, [{ start: 2, end: 4, text: '个大', cuts: [3] }]]]), null);
    expect([...blocked]).toEqual([[0, [[2, 4]]]]);
    expect(collectZhBoundaryPairs(lines, { cache: new Map(), marks, blocked })).toEqual([]);
    // 서버가 옮겨 적용한 좌표도 막는다
    const moved = zhBoundaryBlockedRegions(new Map(), { lines: new Map([[0, { results: [{ status: 'applied', start: 3, end: 5 }, { status: 'pending' }] }]]) });
    expect([...moved]).toEqual([[0, [[3, 5]]]]);
  });

  it('단어성 판정(oov) 마크 토큰·이합사 조각·기본형 불일치·한자 아닌 토큰은 쌍에서 빠진다', () => {
    const line = { original: '笔在桌上', tokens: [
      { text: '笔在', base_form: '笔在', pos: null }, { text: '桌', base_form: '桌', pos: '명사' }, { text: '上', base_form: '上', pos: '방위사' },
    ] };
    const marks = [{ lineIdx: 0, word: '笔在', key: '0:笔在', oov: true }];
    const cache = new Map([['笔在桌', { source: 'gemini' }], ['桌上', { source: 'gemini' }]]);
    expect(collectZhBoundaryPairs([line], { cache, marks }).map((p) => p.form)).toEqual(['桌上']);
    const sep = { original: '道了歉', tokens: [{ text: '道', base_form: '道歉', pos: '동사' }, { text: '了', base_form: '了', pos: '조사' }, { text: '歉', base_form: '歉', sep_link: '道歉' }] };
    expect(collectZhBoundaryPairs([sep], { cache: new Map([['道了', { source: 'gemini' }], ['了歉', { source: 'gemini' }]]), marks: [] })).toEqual([]);
    const latin = { original: 'A股市场', tokens: [{ text: 'A股', base_form: 'A股' }, { text: '市场', base_form: '市场' }] };
    expect(collectZhBoundaryPairs([latin], { cache: new Map([['A股市场', { source: 'gemini' }]]), marks: [] })).toEqual([]);
  });

  it('같은 마크 키(줄:앞 토큰)에는 쌍 하나 · 요청당 상한 · 조회 꼴 상한', () => {
    const line = lineOf('不客气，不客气。');
    expect(collectZhBoundaryPairs([line], { cache: new Map(), marks: [] }).map((p) => p.start)).toEqual([0]);
    const many = Array.from({ length: 30 }, () => lineOf('不客气。'));
    expect(collectZhBoundaryPairs(many, { cache: new Map(), marks: [] })).toHaveLength(20);
    expect(collectZhPairLookupForms(many, new Map(), 5)).toEqual(['不客气']);
    expect(collectZhPairLookupForms([lineOf('运动员的身体素质非常好。')])).toEqual(['运动员的', '的身体', '身体素质', '素质非常', '非常好']);
  });
});

describe('마크에 싣기(§4.2)', () => {
  it('앞 토큰 마크에 pair를 싣고, 마크가 아니면(个 양사) pairOnly 마크를 뒤에 더한다 — 입력은 바꾸지 않는다', () => {
    const lines = ['他一个人去旅行。', '得了，别再说了。'].map(lineOf);
    const marks = collectZhPosMarks(lines, new Map([['得', { pos: '조사·동사' }]]));
    const pairs = collectZhBoundaryPairs(lines, { cache: new Map(), marks });
    const before = JSON.stringify(marks);
    const out = attachZhBoundaryPairs(marks, pairs);
    expect(JSON.stringify(marks)).toBe(before);
    expect(out.slice(0, marks.length).map((m) => m.key)).toEqual(marks.map((m) => m.key));
    expect(out.find((m) => m.key === '1:得')).toMatchObject({ pair: ['得', '了'] });
    expect(out.find((m) => m.key === '1:得').pairOnly).toBeUndefined();
    expect(out.at(-1)).toEqual({ lineIdx: 0, word: '个', key: '0:个', pairOnly: true, pair: ['个', '人'] });
  });
});

describe('경계 정하기(§5.2 표)', () => {
  const lines = ['不客气。', '运动员的身体素质非常好。', '他一个人去旅行。'].map(lineOf);
  const cache = new Map([['身体素质', { source: 'gemini' }]]);
  const pairs = collectZhBoundaryPairs(lines, { cache, marks: [] });

  it('등재 + join:true → 자동 묶기(표식 ai_registered · 병음 이어 붙임), 미등재 + join:true → 앞 토큰 후보 표식만', () => {
    const r = applyZhBoundaryJoins(lines, pairs, pickMap(pairs, true));
    expect(texts(r.tokenizedLines[0])).toEqual(['不客气', '。']);
    expect(r.tokenizedLines[0].tokens[0]).toEqual({ text: '不客气', base_form: '不客气', furigana: 'bú kè qi', pos: null, boundary: 'ai_registered' });
    expect(texts(r.tokenizedLines[1])).toEqual(texts(lines[1]));
    expect(r.tokenizedLines[1].tokens[2]).toMatchObject({ text: '身体', boundarySuggest: '身体素质' });
    expect(r.tokenizedLines[1].tokens.some((t) => t.boundary)).toBe(false);
    expect(texts(r.tokenizedLines[2])).toEqual(['他', '一', '个人', '去', '旅行', '。']);
    expect(r).toMatchObject({ applied: 2, suggested: 1 });
    expect(lines[0].tokens.map((t) => t.text)).toEqual(['不', '客气', '。']); // 입력 불변
  });

  it('join:false·판정 없음이면 아무것도 바꾸지 않는다(같은 배열) · 뜻을 붙일 수 없는 등재 꼴은 묶지 않는다', () => {
    expect(applyZhBoundaryJoins(lines, pairs, pickMap(pairs, false)).tokenizedLines).toBe(lines);
    expect(applyZhBoundaryJoins(lines, pairs, new Map()).tokenizedLines).toBe(lines);
    const r = applyZhBoundaryJoins(lines, pairs, pickMap(pairs, true), { canJoin: (form) => form === '个人' });
    expect(texts(r.tokenizedLines[0])).toEqual(['不', '客气', '。']);
    expect(texts(r.tokenizedLines[2])).toEqual(['他', '一', '个人', '去', '旅行', '。']);
    expect(r.applied).toBe(1);
  });

  it('같은 줄에서 겹치는 쌍은 앞의 것만', () => {
    const line = { original: '甲乙丙', tokens: ['甲', '乙', '丙'].map((t) => ({ text: t, base_form: t, furigana: 'x', pos: '명사' })) };
    const rows = new Map([['甲乙', { source: 'user_verified' }], ['乙丙', { source: 'user_verified' }]]);
    const ps = collectZhBoundaryPairs([line], { cache: rows, marks: [] });
    expect(ps.map((p) => p.form)).toEqual(['甲乙', '乙丙']);
    expect(texts(applyZhBoundaryJoins([line], ps, pickMap(ps, true)).tokenizedLines[0])).toEqual(['甲乙', '丙']);
  });
});

// 측정 세트 D 범주(docs/verification/zh-sense-holdout-20261008.json — 묶여야 할 不客气·得了·有空儿·个人助理 / 나뉘어야 할 9건 /
// 현행 오병합 把手·人才·打包带)를 제품 함수로 돌린다. 채점은 실행기와 같은 scoreCase.
describe('D 범주 픽스처 — 자동 오병합 0(§3.5 켜는 기준 1)', () => {
  const set = JSON.parse(readFileSync(new URL('../../../../docs/verification/zh-sense-holdout-20261008.json', import.meta.url), 'utf8'));
  const cases = set.cases.filter((c) => c.cat === 'D');
  function run(judge) {
    const lines = cases.map((c) => lineOf(c.sentence));
    const marks = collectZhPosMarks(lines, new Map());
    const pairs = collectZhBoundaryPairs(lines, { cache: new Map(), marks, limit: 100 });
    const { tokenizedLines } = applyZhBoundaryJoins(lines, pairs, pickMap(pairs, (p) => judge(cases[p.lineIdx], p)));
    return cases.map((c, i) => {
      let at = 0;
      const span = tokenizedLines[i].tokens.map((t) => { const s = { t, start: at, end: at + t.text.length }; at = s.end; return s; })
        .find((s) => s.start <= c.target.index && c.target.index < s.end);
      const merged = !!span && span.end >= c.target.index + c.boundary.pair[0].length + 1;
      const out = { merged, autoMerged: merged && span.t.boundary === 'ai_registered', suggested: !!span?.t.boundarySuggest };
      return { id: c.id, ...out, ...scoreCase(c, out) };
    });
  }

  it('판정이 기대 경계와 같으면: 묶여야 할 3건이 자동으로 묶이고 오병합 자동 적용 0 — 현행 오병합 3건(묻지 않음)만 FAIL로 남는다', () => {
    const rows = run((c, p) => c.boundary.pair.join('') === p.form && c.boundary.join);
    expect(rows.filter((r) => r.wrongAutoMerge).map((r) => r.id)).toEqual([]);
    expect(rows.filter((r) => r.autoMerged).map((r) => r.id)).toEqual(['D05', 'D08', 'D13']);
    expect(rows.filter((r) => r.verdict === 'FAIL').map((r) => r.id)).toEqual(['D06', 'D15', 'D16']);
  });

  it('판정이 모두 「나뉨」이면 현행과 같다(자동 묶기 0) — 나뉘어야 할 9건은 그대로 PASS', () => {
    const rows = run(() => false);
    expect(rows.filter((r) => r.autoMerged)).toEqual([]);
    expect(rows.filter((r) => !cases.find((c) => c.id === r.id).boundary.join).filter((r) => r.verdict === 'PASS').map((r) => r.id))
      .toEqual(['D01', 'D02', 'D03', 'D04', 'D07', 'D09', 'D10', 'D11', 'D12']);
  });

  it('등재만으로는 막지 못한다 — 판정이 모두 「한 단어」면 등재 오병합 꼴이 묶인다(그래서 상수 꺼짐 + 측정 게이트, §0.5)', () => {
    const rows = run(() => true);
    expect(rows.filter((r) => r.wrongAutoMerge).map((r) => r.id)).toEqual(['D01', 'D02', 'D03', 'D04', 'D07', 'D09', 'D10', 'D11', 'D12']);
    expect(ZH_BOUNDARY_REVIEW).toBe(false);
  });
});
