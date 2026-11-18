// PRINT-GLOSS-002 — 영어 · 프랑스어 CEFR 색인: 레퍼런스 어휘 정본 레지스트리에서 [정규화 키, 가장 쉬운 단계 순위].
import { describe, expect, it } from 'vitest';
import { cefrRank, latinLevelRows } from '../latinLevelIndex';
import { getVocab as getEnglishVocab } from '../../content/english';
import { getVocab as getFrenchVocab } from '../../content/french';

describe('latinLevelRows', () => {
  it('같은 단어가 여러 단계면 가장 쉬운 단계 · 관사 · 괄호는 정본 키로', () => {
    const fake = (level) => ({ A1: { themes: [{ words: [{ en: 'Hello' }, { en: 'grow (up)' }] }] }, B1: { themes: [{ words: [{ en: 'hello' }, { en: 'renewal' }] }] } }[level]);
    expect(Object.fromEntries(latinLevelRows(fake, 'en'))).toEqual({ hello: 1, grow: 1, renewal: 3 });
    expect(cefrRank('c2')).toBe(6);
  });
  it('실제 레지스트리: 영어 · 프랑스어 모두 수백 단어 이상 · 순위 1–6', () => {
    for (const [get, lang] of [[getEnglishVocab, 'en'], [getFrenchVocab, 'fr']]) {
      const rows = latinLevelRows(get, lang);
      expect(rows.length).toBeGreaterThan(300);
      expect(rows.every(([k, r]) => k && r >= 1 && r <= 6)).toBe(true);
    }
  });
});
