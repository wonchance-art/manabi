import { describe, expect, it } from 'vitest';
import { buildEnLemmaCandidates, tokenizeEnLine } from '../tokenizeEn.js';
import { inspectAnalysisCoverage } from '../../analysisCoverage.js';

describe('tokenizeEnLine — POS별 lemma 후보', () => {
  it('기존 기본 lemma 규칙은 그대로 유지한다', () => {
    const tokens = tokenizeEnLine('record ran running saw left better leaves');
    expect(tokens.map((token) => token.base_form)).toEqual([
      'record', 'run', 'run', 'see', 'leave', 'good', 'leaf',
    ]);
  });

  it('saw·leaves처럼 품사에 따라 갈리는 후보를 함께 보존한다', () => {
    expect(buildEnLemmaCandidates('saw')).toEqual({
      '동사': 'see', '명사': 'saw', '형용사': 'saw', '기본': 'saw',
    });
    expect(buildEnLemmaCandidates('leaves')).toEqual({
      '동사': 'leave', '명사': 'leaf', '형용사': 'leaves', '기본': 'leaves',
    });
  });

  it('기호·수사는 후보를 만들지 않고 기존 로컬 pos를 유지한다', () => {
    const tokens = tokenizeEnLine('Saw, 2!');
    expect(tokens[0].lemma_candidates['동사']).toBe('see');
    expect(tokens[1]).toMatchObject({ text: ',', pos: '기호' });
    expect(tokens[1]).not.toHaveProperty('lemma_candidates');
    expect(tokens[2]).toMatchObject({ text: '2', pos: '수사' });
    expect(tokens[2]).not.toHaveProperty('lemma_candidates');
  });

  it('악상·합자 라틴 문자를 한 단어로 붙인다 — 프랑스어 자료가 이 토크나이저를 공용(§4.7)', () => {
    const tokens = tokenizeEnLine("Le café est à côté de l'hôpital");
    expect(tokens.map((t) => t.text)).toEqual(['Le', 'café', 'est', 'à', 'côté', 'de', "l'hôpital"]);
    expect(tokenizeEnLine('cœur')[0]).toMatchObject({ text: 'cœur', base_form: 'cœur' });
    expect(tokenizeEnLine('café')[0].base_form).toBe('café');
  });
});

// 완료 판정(completeAnalysis → inspectAnalysisCoverage)은 토큰을 이은 값이 공백만 빼고 원문 줄과 같아야 완료로 본다.
// 토크나이저가 모르는 글자를 버리면 그 줄은 몇 번을 다시 분석해도 완료가 안 된다 — 공개 시드 134 「010-1234-5678」이
// 서버 작업에서 3회 재시도 후 포기된 실측(2026-11-07 KST), 남은 시드 5편의 「—」, 비공개 자료의 $ % ’ & 도 같은 자리.
describe('tokenizeEnLine — 토큰을 이으면 원문 줄(공백 제외)과 같다', () => {
  const squash = (value) => value.normalize('NFC').replace(/\s/g, '');
  it.each([
    'My phone number is 010-1234-5678.',
    'Look at those clouds — it is going to rain.',
    'I love coffee. — So do I.',
    "THIS IS DONALD TRUMP’s world—we're all just living in it.",
    'the price of gold has surged to around $5,000, up about 75% in a year; the S&P 500 index',
    'QA_CHAPTER_END_1414.',
    '수정한 글과 OK',
    'emoji 😀 « guillemets » … / * + = @ # ~',
    "I'd like this, o'clock ten-minute 15th Mt. Everest",
  ])('%s', (line) => {
    expect(squash(tokenizeEnLine(line).map((token) => token.text).join(''))).toBe(squash(line));
  });

  it('새로 남기는 글자는 기호 토큰 — 뜻 조회 · 단어 카드 대상이 아니다(숫자 · 단어는 그대로)', () => {
    const tokens = tokenizeEnLine('010-1234 — $5 it’s');
    expect(tokens.map((token) => [token.text, token.pos])).toEqual([
      ['010', '수사'], ['-', '기호'], ['1234', '수사'], ['—', '기호'], ['$', '기호'], ['5', '수사'], ['it', null], ['’', '기호'], ['s', null],
    ]);
    expect(tokens[1]).toMatchObject({ base_form: '-' });
    expect(tokens[1]).not.toHaveProperty('lemma_candidates');
  });

  it('자료 134 원문 전체 — 토큰으로 만든 분석이 완료 판정(inspectAnalysisCoverage)을 통과한다', () => {
    const text = 'There are three children in our family.\nMy phone number is 010-1234-5678.\nLook at those clouds — it is going to rain.';
    const json = { sequence: [], dictionary: {} };
    text.split('\n').forEach((line, i, lines) => {
      tokenizeEnLine(line).forEach((token, k) => { json.sequence.push(`id_${i}_${k}`); json.dictionary[`id_${i}_${k}`] = token; });
      if (i < lines.length - 1) { json.sequence.push(`br_${i}_x`); json.dictionary[`br_${i}_x`] = { text: '\n', pos: '개행' }; }
    });
    expect(inspectAnalysisCoverage(text, json)).toMatchObject({ validStructure: true, missingIndices: [] });
  });

  it('기존 단어 · 문장부호 · 숫자 토큰은 그대로', () => {
    expect(tokenizeEnLine("I'd like ten-minute walks, 15th!").map((token) => token.text))
      .toEqual(["I'd", 'like', 'ten-minute', 'walks', ',', '15', 'th', '!']);
  });
});
