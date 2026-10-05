import { describe, expect, it } from 'vitest';
import { koreanMorphologyConsistency as check } from '../koreanMorphologyConsistency.js';

const token = (surface, lemma, forms = []) => ({ surface, lemma, morphology: forms.map(form => ({ form, function: 'explanation' })) });
describe('narrow Korean morphology consistency, separate from semantic acceptance', () => {
  it.each([
    ['가요', '가다'], ['걸어가요', '걸어가다'], ['돌아가요', '돌아가다'],
    ['와요', '오다'], ['돌아와요', '돌아오다'],
  ])('rejects a specific -어요 claim in %s, accepts supported -아요', (surface, lemma) => {
    expect(check(token(surface, lemma, ['-어요']))).toMatchObject({ status: 'contradiction' });
    expect(check(token(surface, lemma, ['-아요']))).toMatchObject({ status: 'consistent' });
  });
  it.each([
    ['갔어요', '가다', ['가', '았', '어요']],
    ['도와줘서', '돕다', ['돕', '아', '주', '어서']],
    ['가요', '가다', ['아/어요']], ['걸어요', '걷다', ['어요']],
    ['걸어요', '걸다', ['어요']], ['가요', '가요', []], ['먹어요', '먹다', ['어요']],
  ])('does not infer unsupported analysis from %s', (surface, lemma, forms) => {
    expect(check(token(surface, lemma, forms)).status).toBe('unknown');
  });
  it.each([['걸어가요', '걸어오다'], ['걸어와요', '걸어가다']])('rejects the reversed direction %s / %s', (surface, lemma) => {
    expect(check(token(surface, lemma)).issues[0].code).toBe('opposite_motion_lemma');
  });
  it('uses normalized copies but preserves decomposed source, quoted forms and meanings', () => {
    const input = token('가요'.normalize('NFD'), '가다', ['-어요']);
    input.meaning = '去；契約、干涉、主語 are not forbidden strings';
    const snapshot = structuredClone(input);
    expect(check(input).status).toBe('contradiction');
    expect(input).toEqual(snapshot);
    expect(check({ surface: '계약', lemma: '계약', meaning: '契約' }).status).toBe('unknown');
  });
});
