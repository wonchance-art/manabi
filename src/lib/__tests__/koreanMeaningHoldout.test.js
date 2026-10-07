import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { meaningTerms, scoreCase, summarize, validateHoldout } from '../../../scripts/eval/koreanMeaningHoldout.mjs';

const set = JSON.parse(readFileSync(new URL('../../../docs/verification/korean-word-meaning-holdout-20261007.json', import.meta.url), 'utf8'));
const spec = (id, locale) => set.cases.find(c => c.id === id)[locale];
const ok = lexicalMeaning => ({ lemmaStatus: 'matched', lexicalMeaning });

describe('한국어 뜻 미사용 표본 — 표본 무결성', () => {
  it('기존 66건 기본형을 쓰지 않고, 허용·금지가 겹치지 않으며, 문장에 표면형이 있다', () => {
    expect(validateHoldout(set)).toEqual([]);
    expect(set.cases).toHaveLength(30);
  });
  it('기존 기본형이 섞이면 잡는다', () => {
    const bad = { ...set, cases: [{ ...set.cases[0], id: 'X1', lemma: '파리' }] };
    expect(validateHoldout(bad).join()).toContain('기존 66건');
  });
  it('대만 지역 어휘 사례는 간체 표기를 금지어로 갖는다', () => {
    for (const c of set.cases.filter(c => c.cat === 'E')) {
      const simplified = c['zh-CN'].accept[0];
      if (simplified !== c['zh-TW'].accept[0]) expect(c['zh-TW'].forbidden.map(f => f.term), c.id).toContain(simplified);
    }
  });
});

describe('한국어 뜻 미사용 표본 — 채점', () => {
  it('어체 괄호를 빼고 대응어로 나눈다', () => {
    expect(meaningTerms('火车、列车（书面）')).toEqual(['火车', '列车']);
    expect(meaningTerms('補習班; 培訓班')).toEqual(['補習班', '培訓班']);
  });
  it('가짜 친구 금지어는 다른 허용어가 있어도 FAIL이다', () => {
    expect(scoreCase(spec('A06', 'zh-CN'), ok('火车、汽车')).verdict).toBe('FAIL');
    expect(scoreCase(spec('A03', 'zh-CN'), ok('爱人')).verdict).toBe('FAIL');
    expect(scoreCase(spec('E03', 'zh-TW'), ok('土豆')).verdict).toBe('FAIL');
  });
  it('같은 사례의 다른 언어 표기가 나오면 글자체 오류로 FAIL이다(간체↔번체)', () => {
    const a05 = set.cases.find(c => c.id === 'A05'), a06 = set.cases.find(c => c.id === 'A06');
    expect(scoreCase(a05['zh-TW'], ok('学院'), a05['zh-CN']).verdict).toBe('FAIL');
    expect(scoreCase(a06['zh-CN'], ok('火車'), a06['zh-TW']).verdict).toBe('FAIL');
    expect(scoreCase(a06['zh-TW'], ok('火車'), a06['zh-CN']).verdict).toBe('PASS');
    const b04 = set.cases.find(c => c.id === 'B04');
    expect(scoreCase(b04['zh-TW'], ok('茶'), b04['zh-CN']).verdict, '양쪽 공통 글자는 오류가 아니다').toBe('PASS');
  });
  it('한 글자 금지어는 다른 대응어 속 글자로 오탐하지 않는다', () => {
    expect(scoreCase(spec('B08', 'zh-CN'), ok('合适')).verdict).toBe('PASS');
    expect(scoreCase(spec('A03', 'zh-CN'), ok('对象')).verdict).toBe('PASS');
  });
  it('두 글자 이상 금지어는 부분 문자열로도 잡는다(조사 뜻 혼입)', () => {
    expect(scoreCase(spec('D02', 'zh-CN'), ok('在市场')).verdict).toBe('FAIL');
  });
  it('허용 예시 밖은 사람 판정(REVIEW), 기본형 불일치는 저장 차단(BLOCKED)이다', () => {
    expect(scoreCase(spec('C02', 'zh-CN'), ok('建筑')).verdict).toBe('REVIEW');
    expect(scoreCase(spec('E02', 'zh-TW'), ok('的士')).verdict).toBe('REVIEW');
    expect(scoreCase(spec('C01', 'zh-CN'), { lemmaStatus: 'uncertain', lexicalMeaning: '' }).verdict).toBe('BLOCKED');
    expect(scoreCase(spec('C01', 'zh-CN'), { error: 'call: 503' }).verdict).toBe('ERROR');
  });
  it('치명 범주 FAIL이 하나라도 있으면 그 언어는 보류, REVIEW가 남으면 사람 판정 대기다', () => {
    const rows = set.cases.flatMap(c => ['zh-CN', 'zh-TW'].map(locale => ({ id: c.id, cat: c.cat, locale, verdict: 'PASS' })));
    rows.find(r => r.id === 'A01' && r.locale === 'zh-CN').verdict = 'FAIL';
    rows.find(r => r.id === 'C01' && r.locale === 'zh-TW').verdict = 'REVIEW';
    const s = summarize(set, rows);
    expect(s['zh-CN'].status).toBe('보류');
    expect(s['zh-CN'].criticalFail).toEqual(['A01']);
    expect(s['zh-TW'].status).toBe('사람 판정 대기');
  });
});
