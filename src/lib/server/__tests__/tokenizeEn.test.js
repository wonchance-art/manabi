import { describe, expect, it } from 'vitest';
import { buildEnLemmaCandidates, tokenizeEnLine } from '../tokenizeEn.js';

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
});
