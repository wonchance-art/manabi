import { describe, expect, it } from 'vitest';
import { indexEntry, latinKey, queryKind, searchLevelIndex } from '../levelWordIndex.js';
import { latinSampleGroups } from '../latinLevelWords.js';
import { levelGroupsOf } from '../levelList.js';
import enA1 from '../../content/english/vocab/a1.js';
import frA1 from '../../content/french/vocab/a1.js';

// 영어 · 프랑스어 단어 페이지(오너 2026-10-26 KST — 몇 단어로 먼저 연다).
describe('영어 · 프랑스어 단어 묶음 — 레퍼런스 어휘에서 고른다', () => {
  const fr = levelGroupsOf(latinSampleGroups(frA1, { themes: [0, 1, 2, 5], per: 2 }));
  const en = levelGroupsOf(latinSampleGroups(enA1, { themes: [0, 2, 4, 5], per: 2 }));

  it('테마마다 앞 두 단어, 대조 키 = 레퍼런스 어휘가 저장하는 word_text(관사 · 공백 그대로)', () => {
    expect(fr.flatMap((g) => g.entries.map((e) => e.key))).toEqual(['la famille', 'le père', 'être', 'avoir', 'le pain', 'le riz', 'grand', 'petit']);
    expect(en.flatMap((g) => g.entries.map((e) => e.key))).toEqual(['hello', 'hi', 'family', 'mother', 'be', 'have', 'good', 'bad']);
    expect(fr[0].name).toBe(frA1.themes[0].name);
  });

  it('읽기 = IPA, 뜻 · 예문은 원문 그대로', () => {
    const famille = fr[0].entries[0];
    expect(famille).toMatchObject({ word: 'la famille', reading: '[famij]', meaning: '가족', pos: 'n.f.' });
    expect(famille.ex).toEqual({ text: frA1.themes[0].words[0].ex.fr, ko: frA1.themes[0].words[0].ex.ko });
    expect(en[0].entries[0].ex.text).toBe('Hello! Nice to meet you.');
  });
});

describe('라틴 문자 찾기(mode latin) — 철자로 찾고 악센트 · 대소문자는 가리지 않는다', () => {
  const rows = [['la famille', '[famij]', '가족', 'A1'], ['le père', '[pɛʁ]', '아버지', 'A1'], ['être', '[ɛtʁ]', '~이다, 있다', 'A1'], ['la sœur', '[sœʁ]', '누나', 'A1']];
  const entries = rows.map((r, i) => indexEntry(r, i, 'latin'));
  const find = (q) => searchLevelIndex(entries, q, 'A1', { mode: 'latin' });

  it('비교 꼴', () => {
    expect(latinKey("L'Été")).toBe('lete');
    expect(latinKey('la sœur')).toBe('lasoeur');
  });
  it('악센트 없이 · 관사 없이 · 한국어 뜻으로', () => {
    expect(queryKind('pere', 'latin')).toBe('latin');
    expect(find('pere').current.map((e) => e.word)).toEqual(['le père']);
    expect(find('ETRE').current.map((e) => e.word)).toEqual(['être']);
    expect(find('famille').current.map((e) => e.word)).toEqual(['la famille']);
    expect(find('soeur').current.map((e) => e.word)).toEqual(['la sœur']);
    expect(find('아버지').current.map((e) => e.word)).toEqual(['le père']);
  });
  it('IPA로는 찾지 않는다', () => {
    expect(find('famij').total).toBe(0);
  });
});
