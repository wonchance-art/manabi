import { describe, expect, it } from 'vitest';
import { koreanMorphologyConsistency as check } from '../koreanMorphologyConsistency.js';

const inflected = (surface, lemma, pos, form = '-게') => ({ surface, lemma, pos,
  meaning: 'Contextual explanation is not rewritten', morphology: [{ form, function: 'An adverbial role in the sentence' }] });

describe('v1 lexical POS and adverbial form are separate', () => {
  it.each([
    ['늦게', '늦다'], ['빠르게', '빠르다'], ['조용하게', '조용하다'], ['모르게', '모르다'],
  ])('rejects a claimed predicate lemma and explicit -게 inflection tagged as lexical adverb: %s', (surface, lemma) => {
    const token = inflected(surface, lemma, '부사');
    const snapshot = structuredClone(token);
    expect(check(token)).toMatchObject({ status: 'contradiction', issues: [{ code: 'adverbial_form_as_lexical_pos', field: 'pos' }] });
    expect(token).toEqual(snapshot);
  });

  it.each([
    ['늦게', '늦다', '형용사'], ['모르게', '모르다', '동사'],
    ['아주', '아주', '부사'], ['늦게', '늦게', '부사'], ['지게', '지게', '명사'],
    ['낮게', '', '부사'], ['다르게', '달다', '부사'],
  ])('leaves non-contradictory or ambiguous %s / %s claims unknown', (surface, lemma, pos) => {
    expect(check(inflected(surface, lemma, pos)).status).toBe('unknown');
  });

  it('requires explicit morphology and compares normalized copies without modifying source', () => {
    const omitted = inflected('늦게', '늦다', '부사');
    delete omitted.morphology;
    expect(check(omitted).status).toBe('unknown');
    expect(check(inflected('늦게', '늦다', '부사', '-게끔')).status).toBe('unknown');
    const decomposed = inflected('늦게'.normalize('NFD'), '늦다'.normalize('NFD'), '부사');
    const snapshot = structuredClone(decomposed);
    expect(check(decomposed).status).toBe('contradiction');
    expect(decomposed).toEqual(snapshot);
  });
});
