import { describe, expect, it } from 'vitest';
import { countBunkei, getVocab } from '../../content/japanese';
import { JAPANESE_VOCAB_REF } from '../japaneseVocabRegistry';

describe('Japanese lightweight vocabulary registry', () => {
  it.each(['N5', 'N4', 'N3', 'N2', 'N1'])('%s stays identical to the canonical registry', level => {
    expect(JAPANESE_VOCAB_REF.getVocab(level)).toEqual(getVocab(level));
  });

  it.each(['N5', 'N4', 'N3', 'N2', 'N1'])('%s keeps the bunkei availability semantic', level => {
    expect(JAPANESE_VOCAB_REF.hasBunkei(level)).toBe(countBunkei(level) > 0);
  });

  it('does not infer bunkei availability from an unknown vocabulary level', () => {
    expect(JAPANESE_VOCAB_REF.hasBunkei('ot')).toBe(false);
    expect(JAPANESE_VOCAB_REF.hasBunkei('unknown')).toBe(false);
  });
});
