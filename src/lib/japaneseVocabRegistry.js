import vocabN5 from '../content/japanese/vocab/n5';
import vocabN4 from '../content/japanese/vocab/n4';
import vocabN3 from '../content/japanese/vocab/n3';
import vocabN2 from '../content/japanese/vocab/n2';
import vocabN1 from '../content/japanese/vocab/n1';
import vocabN5jlptA from '../content/japanese/vocab/n5_jlpt_a';
import vocabN5jlptB from '../content/japanese/vocab/n5_jlpt_b';
import vocabN5jlptC from '../content/japanese/vocab/n5_jlpt_c';
import vocabN5travelCore from '../content/japanese/vocab/n5_travel_core';
import vocabSlangCore from '../content/japanese/vocab/slang_core';
import vocabCultureCore from '../content/japanese/vocab/culture_core';
import vocabOnomatopeCore from '../content/japanese/vocab/onomatope_core';
import vocabN4jlptA from '../content/japanese/vocab/n4_jlpt_a';
import vocabN4jlptB from '../content/japanese/vocab/n4_jlpt_b';
import vocabN4jlptC from '../content/japanese/vocab/n4_jlpt_c';
import vocabN3jlptA from '../content/japanese/vocab/n3_jlpt_a';
import vocabN3jlptB from '../content/japanese/vocab/n3_jlpt_b';
import vocabN3jlptC from '../content/japanese/vocab/n3_jlpt_c';
import vocabN3jlptD from '../content/japanese/vocab/n3_jlpt_d';
import vocabN3jlptE from '../content/japanese/vocab/n3_jlpt_e';
import vocabN3jlptF from '../content/japanese/vocab/n3_jlpt_f';
import vocabN3jlptG from '../content/japanese/vocab/n3_jlpt_g';
import vocabN3jlptH from '../content/japanese/vocab/n3_jlpt_h';
import vocabN3jlptI from '../content/japanese/vocab/n3_jlpt_i';
import vocabN3jlptJ from '../content/japanese/vocab/n3_jlpt_j';
import vocabN2jlptA from '../content/japanese/vocab/n2_jlpt_a';
import vocabN2jlptB from '../content/japanese/vocab/n2_jlpt_b';
import vocabN2jlptC from '../content/japanese/vocab/n2_jlpt_c';
import vocabN2jlptD from '../content/japanese/vocab/n2_jlpt_d';
import vocabN2jlptE from '../content/japanese/vocab/n2_jlpt_e';
import vocabN2jlptF from '../content/japanese/vocab/n2_jlpt_f';
import vocabN2jlptG from '../content/japanese/vocab/n2_jlpt_g';
import vocabN2jlptH from '../content/japanese/vocab/n2_jlpt_h';
import vocabN2jlptI from '../content/japanese/vocab/n2_jlpt_i';
import vocabN1jlptA from '../content/japanese/vocab/n1_jlpt_a';
import vocabN1jlptB from '../content/japanese/vocab/n1_jlpt_b';
import vocabN1jlptC from '../content/japanese/vocab/n1_jlpt_c';
import vocabN1jlptD from '../content/japanese/vocab/n1_jlpt_d';
import vocabN1jlptE from '../content/japanese/vocab/n1_jlpt_e';
import vocabN1jlptF from '../content/japanese/vocab/n1_jlpt_f';
import vocabN1jlptG from '../content/japanese/vocab/n1_jlpt_g';
import vocabN1jlptH from '../content/japanese/vocab/n1_jlpt_h';

const LEVEL_META = [
  { key: 'N5', label: 'N5 기초', focus: '기초 입문', color: '#F5C34A', bg: 'rgba(245,195,74,0.12)', line: 'rgba(245,195,74,0.35)' },
  { key: 'N4', label: 'N4 기본', focus: '일상 회화', color: '#F0A040', bg: 'rgba(240,160,64,0.12)', line: 'rgba(240,160,64,0.35)' },
  { key: 'N3', label: 'N3 중급', focus: '가교 단계', color: '#E8763C', bg: 'rgba(232,118,60,0.12)', line: 'rgba(232,118,60,0.35)' },
  { key: 'N2', label: 'N2 상급', focus: '사회·직업적 언어', color: '#D85840', bg: 'rgba(216,88,64,0.12)', line: 'rgba(216,88,64,0.35)' },
  { key: 'N1', label: 'N1 심화', focus: '원어민 수준', color: '#C03C42', bg: 'rgba(192,60,66,0.12)', line: 'rgba(192,60,66,0.35)' },
];

const normalize = value => String(value || '').toUpperCase();
const normalizeWord = value => String(value || '')
  .trim()
  .split(/[;；／、]/)[0]
  .trim()
  .replace(/[～〜~]/g, '')
  .replace(/\s+/g, '');

function mergeVocab(base, ...addLists) {
  const themes = base.themes.map(theme => ({ ...theme, words: [...theme.words] }));
  const byName = new Map(themes.map(theme => [theme.name.trim(), theme]));
  const seen = new Set(themes.flatMap(theme => theme.words.map(word => normalizeWord(word.ja))));

  for (const additions of addLists) {
    const addThemes = Array.isArray(additions) ? additions : additions?.themes || [];
    for (const addition of addThemes) {
      for (const word of addition.words || []) {
        const key = normalizeWord(word.ja);
        if (seen.has(key)) continue;
        seen.add(key);
        let theme = byName.get(addition.name.trim());
        if (!theme) {
          theme = { name: addition.name, icon: addition.icon, words: [] };
          themes.push(theme);
          byName.set(addition.name.trim(), theme);
        }
        theme.words.push(word);
      }
    }
  }

  return { ...base, themes };
}

const VOCAB = {
  N5: mergeVocab(vocabN5, vocabN5jlptA, vocabN5jlptB, vocabN5jlptC, vocabN5travelCore, vocabSlangCore, vocabCultureCore),
  N4: mergeVocab(vocabN4, vocabN4jlptA, vocabN4jlptB, vocabN4jlptC, vocabOnomatopeCore),
  N3: mergeVocab(vocabN3, vocabN3jlptA, vocabN3jlptB, vocabN3jlptC, vocabN3jlptD, vocabN3jlptE, vocabN3jlptF, vocabN3jlptG, vocabN3jlptH, vocabN3jlptI, vocabN3jlptJ),
  N2: mergeVocab(vocabN2, vocabN2jlptA, vocabN2jlptB, vocabN2jlptC, vocabN2jlptD, vocabN2jlptE, vocabN2jlptF, vocabN2jlptG, vocabN2jlptH, vocabN2jlptI),
  N1: mergeVocab(vocabN1, vocabN1jlptA, vocabN1jlptB, vocabN1jlptC, vocabN1jlptD, vocabN1jlptE, vocabN1jlptF, vocabN1jlptG, vocabN1jlptH),
};

export const JAPANESE_VOCAB_REF = Object.freeze({
  base: '/japanese',
  flag: '🇯🇵',
  name: '일본어',
  langCode: 'ja',
  LEVEL_META,
  getLevelMeta(level) {
    return LEVEL_META.find(meta => meta.key === normalize(level)) || null;
  },
  getVocab(level) {
    return VOCAB[normalize(level)] || null;
  },
  countVocab(level) {
    const vocab = VOCAB[normalize(level)];
    return vocab ? vocab.themes.reduce((sum, theme) => sum + theme.words.length, 0) : 0;
  },
});
