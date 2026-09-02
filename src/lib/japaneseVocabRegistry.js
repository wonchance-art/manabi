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
import vocabTravelSceneCore from '../content/japanese/vocab/travel_scene_core';
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

const BUNKEI_BY_LEVEL = Object.freeze({
  N5: true,
  N4: true,
  N3: true,
  N2: true,
  N1: true,
});

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
  N5: mergeVocab(vocabN5, vocabN5jlptA, vocabN5jlptB, vocabN5jlptC, vocabN5travelCore, vocabSlangCore, vocabCultureCore, vocabTravelSceneCore),
  N4: mergeVocab(vocabN4, vocabN4jlptA, vocabN4jlptB, vocabN4jlptC, vocabOnomatopeCore),
  N3: mergeVocab(vocabN3, vocabN3jlptA, vocabN3jlptB, vocabN3jlptC, vocabN3jlptD, vocabN3jlptE, vocabN3jlptF, vocabN3jlptG, vocabN3jlptH, vocabN3jlptI, vocabN3jlptJ),
  N2: mergeVocab(vocabN2, vocabN2jlptA, vocabN2jlptB, vocabN2jlptC, vocabN2jlptD, vocabN2jlptE, vocabN2jlptF, vocabN2jlptG, vocabN2jlptH, vocabN2jlptI),
  N1: mergeVocab(vocabN1, vocabN1jlptA, vocabN1jlptB, vocabN1jlptC, vocabN1jlptD, vocabN1jlptE, vocabN1jlptF, vocabN1jlptG, vocabN1jlptH),
};

// 표기 → { level, word } 지연 인덱스. 낮은 급수(N5 → N1 순서로 먼저 등록되는 쪽)가 이긴다 —
// mergeVocab의 중복 제거와 같은 정규화(normalizeWord)를 쓴다. 만남 요약(월드)·상태 점(뷰어)이 소비.
let wordIndex = null;
function buildWordIndex() {
  const idx = new Map();
  for (const meta of LEVEL_META) {
    const vocab = VOCAB[meta.key];
    if (!vocab) continue;
    for (const theme of vocab.themes) {
      for (const word of theme.words) {
        const key = normalizeWord(word.ja);
        if (key && !idx.has(key)) idx.set(key, { level: meta.key, word });
      }
    }
  }
  return idx;
}

// ── 읽기 색인(ja 표제어 읽기 매칭 — #1077 라운드 10 §남긴 것) — 표기가 달라 표면 키로 못 만나는 말을
// 읽기(yomi)로 2차 조회한다. 어휘 정답지 대조에서 표제어 미생존 429 중 204건이 「어휘 いぬ·예문 犬」류의
// 표기 차이였다. 규칙 셋: ① 〜표기 표제어(〜分·〜時)는 표제어가 아니라 제외 ② 표기 차이는 가나↔한자뿐 —
// 표면과 후보가 둘 다 한자면(橋↔箸) 다른 말이므로 제외 ③ 동음이의는 최저 급수 우선, 동급이면 무개입(null)
// — 라운드 4(jaKanaSegment)의 규칙 재사용. 가타카나는 히라가나로 접어 비교한다(パン=ぱん).
const kataToHira = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const HAS_KANJI = /[\u3400-\u4dbf\u4e00-\u9fff々]/;
const normalizeReading = (value) => kataToHira(normalizeWord(value));
let readingIndex = null;
function buildReadingIndex() {
  const idx = new Map();
  LEVEL_META.forEach((meta, rank) => {
    const vocab = VOCAB[meta.key];
    if (!vocab) return;
    for (const theme of vocab.themes) {
      for (const word of theme.words) {
        if (!word?.yomi || /[～〜~]/.test(word.ja || '')) continue;
        const key = normalizeReading(word.yomi);
        if (!key) continue;
        if (!idx.has(key)) idx.set(key, []);
        idx.get(key).push({ level: meta.key, rank, word });
      }
    }
  });
  return idx;
}

export const JAPANESE_VOCAB_REF = Object.freeze({
  base: '/japanese',
  flag: '🇯🇵',
  name: '일본어',
  langCode: 'ja',
  LEVEL_META,
  /** 정본 표기로 단어를 찾는다 — { level, word } 또는 null. */
  findWord(text) {
    wordIndex ||= buildWordIndex();
    return wordIndex.get(normalizeWord(text)) || null;
  },
  /**
   * 읽기로 단어를 찾는다 — 표면 키가 없을 때의 2차 조회. { level, word } 또는 null.
   * surface는 한자↔한자 차단용(표면이 한자면 가나 표제어 후보만 남긴다).
   */
  findWordByReading(reading, surface = '') {
    const key = normalizeReading(reading);
    if (!key) return null;
    readingIndex ||= buildReadingIndex();
    const list = readingIndex.get(key);
    if (!list) return null;
    const cands = HAS_KANJI.test(String(surface || '')) ? list.filter((c) => !HAS_KANJI.test(c.word.ja)) : list;
    if (cands.length === 0) return null;
    const best = Math.min(...cands.map((c) => c.rank));
    const top = cands.filter((c) => c.rank === best);
    if (top.length !== 1) return null; // 동급 동음이의 — 무개입
    return { level: top[0].level, word: top[0].word };
  },
  getLevelMeta(level) {
    return LEVEL_META.find(meta => meta.key === normalize(level)) || null;
  },
  getVocab(level) {
    return VOCAB[normalize(level)] || null;
  },
  hasBunkei(level) {
    return BUNKEI_BY_LEVEL[normalize(level)] === true;
  },
  countVocab(level) {
    const vocab = VOCAB[normalize(level)];
    return vocab ? vocab.themes.reduce((sum, theme) => sum + theme.words.length, 0) : 0;
  },
});
