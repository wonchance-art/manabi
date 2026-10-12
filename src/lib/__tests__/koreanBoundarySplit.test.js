import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { KO_WORDS } from './helpers/koreanBoundaryHarness.js';
import { koreanFormula, koreanPieceToken, koreanSplitUnits } from '../koreanBoundarySplit';

// 뷰어 v2 AD-R3 §7.5 — 한국어 나누기 B안(오너 결정 2026-10-09). 칼선은 morphology form이 표면에 글자 그대로 있는 자리만,
// 왼쪽부터. 축약·불규칙(#1346 C 범주)은 칼선 없이(또는 그 앞까지만) 합친 꼴 + 공식 설명.

const eojeol = (text, extra = {}) => ({ text, surface: text, language: 'Korean', base_form: KO_WORDS[text]?.lemma ?? null, lemma: KO_WORDS[text]?.lemma,
  pos: KO_WORDS[text]?.pos, meaning: KO_WORDS[text]?.meaning, morphology: KO_WORDS[text]?.morphology, explanationLocale: 'ko', analysisVersion: 'ko-llm-v1',
  sourceSpan: { start: 10, end: 10 + text.length, unit: 'utf16', lineIndex: 1, lineStart: 4, lineEnd: 4 + text.length }, selectionGroup: `ko_1_4_${4 + text.length}`, ...extra });
const pieces = text => koreanSplitUnits(eojeol(text)).units.map(u => u.text);
const cuts = text => koreanSplitUnits(eojeol(text)).cuts;

describe('칼선 후보 — 표면에 글자 그대로 있는 형태소 경계만(왼쪽부터)', () => {
  it('체언 + 조사, 어간 + 어미가 표면 그대로면 모든 경계가 후보다', () => {
    expect(pieces('도서관에서')).toEqual(['도서관', '에서']);
    expect(cuts('도서관에서')).toEqual([3]);
    expect(pieces('먹었어요')).toEqual(['먹', '었', '어요']);
    expect(cuts('먹었어요')).toEqual([1, 2]);
    expect(pieces('저는')).toEqual(['저', '는']);
  });
  it('일부만: 앞의 표면 그대로 형태소까지 자르고, 줄어든 자리부터 끝까지는 한 조각(공부│했어요)', () => {
    expect(pieces('공부했어요')).toEqual(['공부', '했어요']);
    expect(cuts('공부했어요')).toEqual([2]);
    const tail = koreanSplitUnits(eojeol('공부했어요')).units[1];
    expect(tail.morphemes.map(x => x.form)).toEqual(['하-', '-였-', '-어요']);
  });
  it('축약 했어요는 칼선 없음 — 오른쪽 어미만 떼어 「했」 같은 단어 아닌 조각을 만들지 않는다(목업 B)', () => {
    expect(cuts('했어요')).toEqual([]);
    expect(pieces('했어요')).toEqual(['했어요']);
  });
  it.each(['도와요', '지으셨어요', '하얘요', '불렀어요', '더워서'])('#1346 C 범주 %s: 칼선 없음', (word) => {
    expect(cuts(word)).toEqual([]);
    expect(pieces(word)).toEqual([word]);
  });
  it('morphology가 없거나 하나뿐이거나, form이 표면을 다 덮지 못하면 칼선 없음(추측하지 않는다)', () => {
    expect(koreanSplitUnits(eojeol('오늘'))).toMatchObject({ cuts: [] });
    expect(koreanSplitUnits(eojeol('도서관에서', { morphology: [{ form: '도서관', function: '명사' }] })).cuts).toEqual([]);
    expect(koreanSplitUnits(eojeol('학교', { morphology: [{ form: '학교', function: '명사' }] })).cuts).toEqual([]);
    // 분해형(NFD) 표면은 글자 그대로 비교가 되지 않으므로 칼선 없음
    expect(koreanSplitUnits(eojeol('도서관에서'.normalize('NFD'), { morphology: KO_WORDS.도서관에서.morphology })).cuts).toEqual([]);
  });
  it('공백·문장부호·실패 토큰은 대상이 아니다(조각 0)', () => {
    expect(koreanSplitUnits({ text: ' ', whitespace: true, morphology: [] }).units).toEqual([]);
    expect(koreanSplitUnits({ text: '.', pos: '기호' }).units).toEqual([]);
    expect(koreanSplitUnits({ text: '도서관에서', failed: true, morphology: KO_WORDS.도서관에서.morphology }).units).toEqual([]);
  });
  it('어간 form을 「먹다」처럼 기본형으로 준 첫 형태소도 표면 그대로 앞부분이면 자른다', () => {
    const t = eojeol('먹었어요', { morphology: [{ form: '먹다', function: '어간' }, { form: '었', function: '과거' }, { form: '어요', function: '해요체' }] });
    expect(koreanSplitUnits(t).units.map(u => u.text)).toEqual(['먹', '었', '어요']);
  });
});

describe('공식 — 「했어요 = 하다 + -였- + -어요 (줄어든 꼴)」', () => {
  it('어간 form은 X다로, 형태소 글자 수 합이 표면보다 길면 줄어든 꼴', () => {
    expect(koreanFormula(koreanSplitUnits(eojeol('했어요')).units[0])).toEqual({ surface: '했어요', terms: ['하다', '-였-', '-어요'], kind: 'contracted' });
    expect(koreanFormula(koreanSplitUnits(eojeol('지으셨어요')).units[0])).toMatchObject({ terms: ['짓다', '-으시-', '-었-', '-어요'], kind: 'contracted' });
    expect(koreanFormula(koreanSplitUnits(eojeol('불렀어요')).units[0]).kind).toBe('contracted');
    expect(koreanFormula(koreanSplitUnits(eojeol('하얘요')).units[0]).kind).toBe('contracted');
  });
  it('글자 수가 같은데 모양이 다르면 모양이 바뀐 꼴(도와요·더워서 — ㅂ 불규칙)', () => {
    expect(koreanFormula(koreanSplitUnits(eojeol('도와요')).units[0])).toEqual({ surface: '도와요', terms: ['돕다', '-아요'], kind: 'changed' });
    expect(koreanFormula(koreanSplitUnits(eojeol('더워서')).units[0])).toEqual({ surface: '더워서', terms: ['덥다', '-어서'], kind: 'changed' });
  });
  it('형태소 하나인 조각은 공식이 없다', () => {
    expect(koreanFormula(koreanSplitUnits(eojeol('먹었어요')).units[0])).toBeNull();
  });
});

describe('조각 토큰 — 뜻은 기존 morphology 설명, 위치는 어절 범위를 옮긴 것', () => {
  it('형태소 하나 조각: 뜻 = function, 표제어 = form(어간이면 X다), 품사는 어절 표제어와 같을 때만', () => {
    const t = eojeol('도서관에서');
    const [a, b] = koreanSplitUnits(t).units;
    expect(koreanPieceToken(t, [a])).toEqual({
      text: '도서관', surface: '도서관', lemma: '도서관', base_form: '도서관', pos: '명사', meaning: '명사. 책을 모아 두고 읽는 곳', language: 'Korean',
      sourceSpan: { start: 10, end: 13, unit: 'utf16', lineIndex: 1, lineStart: 4, lineEnd: 7 }, selectionGroup: 'ko_1_4_7',
      explanationLocale: 'ko', analysisVersion: 'ko-llm-v1', boundary: 'user',
    });
    expect(koreanPieceToken(t, [b])).toMatchObject({ text: '에서', lemma: '에서', base_form: '에서', pos: null, meaning: '장소를 나타내는 조사',
      sourceSpan: { start: 13, end: 15, lineStart: 7, lineEnd: 9 }, selectionGroup: 'ko_1_7_9' });
    const m = eojeol('먹었어요');
    expect(koreanPieceToken(m, [koreanSplitUnits(m).units[0]])).toMatchObject({ text: '먹', lemma: '먹다', base_form: '먹다', pos: '동사' });
  });
  it('여러 형태소 조각(합친 꼴): 형태소 목록을 morphology로 싣는다 · 설명 언어 표식은 어절 것', () => {
    const t = eojeol('공부했어요', { explanationLocale: 'zh-CN', meaningLocale: 'zh-CN' });
    const tail = koreanSplitUnits(t).units[1];
    const piece = koreanPieceToken(t, [tail]);
    expect(piece).toMatchObject({ text: '했어요', lemma: '하다', pos: null, explanationLocale: 'zh-CN', meaningLocale: 'zh-CN', boundary: 'user',
      morphology: [{ form: '하-', function: '동사 하다의 어간' }, { form: '-였-', function: '과거 시제 어미' }, { form: '-어요', function: '해요체 종결 어미' }] });
    expect(piece.meaning).toBe('동사 하다의 어간 · 과거 시제 어미 · 해요체 종결 어미');
    expect(piece).not.toHaveProperty('readings');
  });
  it('줄 기준(lineStart 없는) 옛 sourceSpan도 같은 만큼 옮긴다', () => {
    const t = eojeol('도서관에서', { sourceSpan: { start: 4, end: 9, unit: 'utf16', lineIndex: 1 } });
    expect(koreanPieceToken(t, [koreanSplitUnits(t).units[1]]).sourceSpan).toEqual({ start: 7, end: 9, unit: 'utf16', lineIndex: 1 });
  });
});

describe('모듈 경계', () => {
  it('브라우저·서버 공용 — 서버 전용 모듈·네트워크·AI 호출을 import하지 않는다', () => {
    const src = readFileSync(new URL('../koreanBoundarySplit.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from ['"](node:|\.\/server\/|\.\.\/server\/)|callLLM|callGemini|fetch\(|supabase/);
  });
});
