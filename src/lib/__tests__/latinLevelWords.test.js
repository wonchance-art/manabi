import { describe, expect, it } from 'vitest';
import { indexEntry, latinKey, queryKind, searchLevelIndex } from '../levelWordIndex.js';
import { LATIN_WORD_LEVELS, genderOf, latinLevelGroups, latinSampleGroups, splitFrArticle } from '../latinLevelWords.js';
import { entryKeys } from '../levelWordStatus.js';
import { levelGroupsOf } from '../levelList.js';
import enA1 from '../../content/english/vocab/a1.js';
import frA1 from '../../content/french/vocab/a1.js';
import enNotes from '../../content/english/wordNotes.js';
import frNotes from '../../content/french/wordNotes.js';
import { getVocab as frVocab } from '../../content/french/index.js';
import { getVocab as enVocab } from '../../content/english/index.js';

// 영어 · 프랑스어 단어 페이지(오너 2026-10-26 KST — 몇 단어로 먼저 연다).
describe('영어 · 프랑스어 단어 묶음 — 레퍼런스 어휘에서 고른다', () => {
  const fr = levelGroupsOf(latinSampleGroups(frA1, { lang: 'fr', picks: [[0, 2], [1, 2], [2, 2], [5, 2]], notes: frNotes }));
  const en = levelGroupsOf(latinSampleGroups(enA1, { lang: 'en', picks: [[0, ['hello', 'welcome']], [2, 2], [4, ['be', 'go']], [5, 2]], notes: enNotes }));
  const frBy = Object.fromEntries(fr.flatMap((g) => g.entries).map((e) => [e.word, e]));
  const enBy = Object.fromEntries(en.flatMap((g) => g.entries).map((e) => [e.word, e]));

  it('고른 단어 · 대조 키 — 프랑스어는 관사를 뗀 정본 키(normalizeRefWordKey), 옛 저장 꼴(관사 포함)은 alts로 함께 찾는다', () => {
    expect(fr.flatMap((g) => g.entries.map((e) => e.word))).toEqual(['la famille', 'le père', 'être', 'avoir', 'le pain', 'le riz', 'grand', 'petit']);
    expect(fr.flatMap((g) => g.entries.map((e) => e.key))).toEqual(['famille', 'père', 'être', 'avoir', 'pain', 'riz', 'grand', 'petit']);
    expect(frBy['la famille'].alts).toEqual(['la famille']);
    expect(frBy['être'].alts).toBeUndefined();
    expect(entryKeys(frBy['la famille'])).toEqual(['famille', 'la famille']);
    expect(entryKeys(frBy['être'])).toBe('être');
    expect(en.flatMap((g) => g.entries.map((e) => e.key))).toEqual(['hello', 'welcome', 'family', 'mother', 'be', 'go', 'good', 'bad']);
    expect(fr[0].name).toBe(frA1.themes[0].name);
  });

  it('읽기 = IPA, 뜻 · 예문은 원문 그대로 — 형태 칸이 맡는 괄호 꼴만 화면 뜻에서 뺀다(저장 뜻은 원문)', () => {
    expect(frBy['la famille']).toMatchObject({ word: 'la famille', reading: '[famij]', meaning: '가족', pos: 'n.f.' });
    expect(frBy['la famille'].ex).toEqual({ text: frA1.themes[0].words[0].ex.fr, ko: frA1.themes[0].words[0].ex.ko });
    expect(enBy.hello.ex.text).toBe('Hello! Nice to meet you.');
    expect(frBy.grand).toMatchObject({ meaning: '큰, 키가 큰', fullMeaning: '큰, 키가 큰 (여성형 grande)' });
    expect(enBy.be).toMatchObject({ meaning: '~이다, 있다', fullMeaning: '~이다, 있다 (am/is/are)' });
  });

  it('프랑스어 성 = 품사(n.f. · n.m.), 관사는 따로 — 형용사 · 동사는 성 · 관사 없음', () => {
    expect(frBy['la famille']).toMatchObject({ g: 'f', art: 'la' });
    expect(frBy['le père']).toMatchObject({ g: 'm', art: 'le' });
    expect(frBy.grand.g).toBeUndefined();
    expect(frBy['être'].art).toBeUndefined();
    expect(splitFrArticle("l'année")).toEqual({ art: "l'", noun: 'année' });
    expect(splitFrArticle('les parents (m. pl.)')).toEqual({ art: 'les', noun: 'parents' });
    expect(genderOf('n.f.')).toBe('f');
    expect(genderOf('adj.')).toBeNull();
    expect(enBy.family.g).toBeUndefined();
  });

  it('불규칙 · 형태 · 현재형은 보충(wordNotes)에서 — être 여섯 칸', () => {
    expect(frBy['être']).toMatchObject({ irregular: true });
    expect(frBy['être'].conj.map(([who, form]) => `${who} ${form}`)).toEqual(['je suis', 'tu es', 'il · elle est', 'nous sommes', 'vous êtes', 'ils · elles sont']);
    expect(enBy.go.forms).toEqual([['현재', 'go'], ['과거', 'went'], ['과거분사', 'gone']]);
    expect(frBy.grand.forms).toEqual([['m.', 'grand'], ['f.', 'grande']]);
    expect(enBy.hello.forms).toBeUndefined();
  });

  it('어원 칸 — 짜인 값 + 어휘 글, 없으면 칸 없음 · 같은 말을 이미 하면 글을 뺀다', () => {
    expect(frBy['la famille'].ety).toEqual({ parts: null, root: ['familia', '라틴어'], kin: [['영어', 'family'], ['영어', 'familiar']], note: null });
    expect(enBy.welcome.ety.parts).toEqual([['well', '잘'], ['come', '오다']]);
    expect(frBy['le pain'].ety.note).toContain('pain au chocolat');
    expect(frBy.petit.ety).toEqual({ kin: null, note: frA1.themes[5].words[1].etym });
    expect(frBy['le riz'].ety).toBeUndefined();
    expect(enBy.mother.ety).toBeUndefined();
  });
});

// 준비 검토 ① · ③(오너 2026-10-29 KST 「ㄱㄱ」) — 단어를 다 채우기 전에 원천 · 중복 규칙을 박는다.
describe('원천 = 레퍼런스 페이지와 같은 정본(getVocab) · 한 말은 한 번', () => {
  const words = (groups) => levelGroupsOf(groups).flatMap((g) => g.entries);
  const full = (getVocab, lang, levelKey, levels = [levelKey]) => words(latinLevelGroups(getVocab, { lang, levelKey, levels }));

  it('라우트가 여는 레벨 줄 · 8단어 표본은 정본에서 골라도 그대로', () => {
    expect(LATIN_WORD_LEVELS).toEqual({ english: ['A1'], french: ['A1'] });
    const fr8 = words(latinLevelGroups(frVocab, { lang: 'fr', levelKey: 'A1', levels: LATIN_WORD_LEVELS.french, picks: [[0, 2], [1, 2], [2, 2], [5, 2]], notes: frNotes }));
    expect(fr8.map((e) => e.word)).toEqual(['la famille', 'le père', 'être', 'avoir', 'le pain', 'le riz', 'grand', 'petit']);
  });
  it('picks가 없으면 그 레벨 전부 — 프랑스어는 FLELex 보강까지(본편 원본만 읽으면 A1 206어)', () => {
    const a1 = full(frVocab, 'fr', 'A1');
    expect(a1.length).toBeGreaterThan(400);
    expect(new Set(a1.map((e) => e.key)).size).toBe(a1.length);
    const raw = frA1.themes.reduce((n, t) => n + t.words.length, 0);
    expect(a1.length).toBeGreaterThan(raw);
  });
  it('같은 레벨에서 같은 말이 두 번이면 앞 것만(vouloir · venir · se lever · libre)', () => {
    expect(full(frVocab, 'fr', 'A1').filter((e) => e.word === 'vouloir')).toHaveLength(1);
    expect(full(frVocab, 'fr', 'A2').filter((e) => e.word === 'se lever')).toHaveLength(1);
    expect(full(frVocab, 'fr', 'B1').filter((e) => e.word === 'libre')).toHaveLength(1);
  });
  it('키가 같아도 품사가 다르면 다른 말 — le souvenir(정본 키) · se souvenir(재귀 대명사를 남긴 키)', () => {
    const b1 = Object.fromEntries(full(frVocab, 'fr', 'B1').map((e) => [e.word, e]));
    expect(b1['le souvenir'].key).toBe('souvenir');
    expect(b1['se souvenir (de)'].key).toBe('se souvenir');
    expect(entryKeys(b1['se souvenir (de)'])).toEqual(['se souvenir', 'se souvenir (de)']);
  });
  it('앞 레벨에 실은 말은 뒤 레벨에서 뺀다 — 단어 페이지가 연 레벨끼리만(지금은 A1 하나라 빠지는 말 없음)', () => {
    expect(full(frVocab, 'fr', 'A1', ['A0', 'A1']).some((e) => e.key === 'famille')).toBe(false);
    expect(full(frVocab, 'fr', 'A1').some((e) => e.key === 'famille')).toBe(true);
    const en2 = full(enVocab, 'en', 'A2', ['A1', 'A2']);
    const en1 = new Set(full(enVocab, 'en', 'A1').map((e) => e.key));
    expect(en2.filter((e) => en1.has(e.key))).toEqual([]);
    expect(full(enVocab, 'en', 'A2').filter((e) => en1.has(e.key)).length).toBeGreaterThan(0);
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
