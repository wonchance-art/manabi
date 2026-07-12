import { describe, expect, it } from 'vitest';
import { getVocab } from '../../content/japanese';
import { JAPANESE_VOCAB_REF } from '../japaneseVocabRegistry';

describe('Japanese lightweight vocabulary registry', () => {
  it.each(['N5', 'N4', 'N3', 'N2', 'N1'])('%s stays identical to the canonical registry', level => {
    expect(JAPANESE_VOCAB_REF.getVocab(level)).toEqual(getVocab(level));
  });
});
