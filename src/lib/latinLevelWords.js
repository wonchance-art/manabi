// 영어 · 프랑스어 단어 페이지 묶음(오너 2026-10-26 KST 「단어 몇개만 넣어서 일단 열어봐」) — 레퍼런스 어휘(src/content/*/vocab)에서
// 고른 단어를 HSK · JLPT 단어 화면(LevelWordScreen)과 같은 항목 꼴로 만든다. 같은 단어 · 같은 예문에, 한 단어 화면 보충(wordNotes)만 더한다.
// 대조 키 = 정본 normalizeRefWordKey — 프랑스어는 관사를 뗀 꼴(「famille」, 오너 결정 ① 추천안)이라 뷰어에서 담은 단어와 한 행에서 만난다.
// 레퍼런스 어휘 페이지가 예전에 저장한 관사 붙은 꼴(「la famille」)은 alts로 함께 찾는다(entryKeys).
// 원천은 레퍼런스 페이지와 같은 정본 레지스트리(getVocab)다 — 단어를 한 곳에만 채운다(오너 2026-10-29 KST 「ㄱㄱ」, 준비 검토 ①).
// levelWordKey(공백 제거 — 「good morning」 → 「goodmorning」)는 쓰지 않는다.
import { compactLevelEntry, shortMeaning } from './levelList';
import { normalizeRefWordKey } from './refWordNormalize';

/** 단어 페이지가 여는 레벨(순서대로) — 라우트(서버)와 화면 판(LatinWordPage)이 같은 줄을 쓴다. 'use client' 모듈의 값은 서버에서 읽히지 않아 여기 둔다. */
export const LATIN_WORD_LEVELS = Object.freeze({ english: Object.freeze(['A1']), french: Object.freeze(['A1']) });

const FR_ARTICLE = /^(l['’]|les |le |la )/i;

/** 프랑스어 표제어 → { art, noun } — 화면이 관사를 명사 왼쪽에 매단다(명사가 가운데). 관사가 없으면 art null. 괄호 메모(m. pl.)는 뗀다. */
export function splitFrArticle(word) {
  const s = String(word || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const m = s.match(FR_ARTICLE);
  if (!m) return { art: null, noun: s };
  return { art: m[1].trim(), noun: s.slice(m[1].length).trim() };
}

/** 품사 → 성(f · m) — 어휘의 n.f. · n.m.만 읽는다. 명사가 아니면 null. */
export function genderOf(pos) {
  const p = String(pos || '');
  return /\bn\.\s?f\./.test(p) ? 'f' : /\bn\.\s?m\./.test(p) ? 'm' : null;
}

/** 어원 칸 — wordNotes의 짜인 값(조각 · 뿌리 · 같은 뿌리) + 어휘의 etym 글. 둘 다 없으면 null(칸을 그리지 않는다). */
function etymOf(w, note, lang) {
  const kinFromVocab = lang === 'fr' && w.en ? [['영어', String(w.en)]] : null;
  const prose = String(w.etym || '').trim() || null;
  if (!note) return prose || kinFromVocab ? { kin: kinFromVocab, note: prose } : null;
  return { parts: note.parts || null, root: note.root || null, kin: note.kin || kinFromVocab, note: note.note === false ? null : (note.note ?? prose) };
}

/** 품사 갈래 — 같은 키의 두 항목이 같은 말(뒤 것을 뺀다)인지, 다른 말(le souvenir · se souvenir — 키를 따로)인지 가른다. */
function posClass(pos) {
  const p = String(pos || '');
  return /\bv\./.test(p) ? 'v' : /\bn\./.test(p) ? 'n' : /\badj\./.test(p) ? 'adj' : p.split(/[\s./]/)[0];
}

/** 다른 말인데 정본 키가 같을 때 뒤 말의 키 — 괄호 메모만 떼고 관사 · 재귀 대명사(se)는 남긴다(「se souvenir」). */
const ownKey = (word) => String(word || '').toLowerCase().replace(/’/g, "'").replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * vocab = 레퍼런스 어휘 한 레벨({ themes:[{ name, words }] }) · lang = 'en' | 'fr' · picks = [[테마 순번, 앞에서 몇 개 | 표제어 목록]] — 없으면 전부 ·
 * notes = 한 단어 화면 보충(content/*\/wordNotes.js) · seen = 앞에서 실은 키 → 품사 갈래(latinLevelGroups가 레벨을 건너 나눠 쓴다).
 * 같은 키 · 같은 갈래는 한 말이라 뒤 것을 뺀다(본편의 vouloir 두 번, 앞 레벨의 famille). 빈 테마는 싣지 않는다.
 */
export function latinSampleGroups(vocab, { lang, picks = null, notes = {}, seen = new Map() }) {
  if (!vocab?.themes) return null;
  const chosen = picks ? picks.map(([i, which]) => [vocab.themes[i], which]) : vocab.themes.map((t) => [t, t?.words.length]);
  return chosen.filter(([t]) => t).map(([t, which]) => ({
    name: t.name,
    entries: (Array.isArray(which) ? which.map((h) => t.words.find((w) => w[lang] === h)).filter(Boolean) : t.words.slice(0, which)).flatMap((w) => {
      const word = String(w[lang] || '');
      const cls = posClass(w.pos);
      let key = normalizeRefWordKey(lang, word);
      if (seen.has(key)) {
        if (seen.get(key) === cls || seen.has(ownKey(word)) || ownKey(word) === key) return [];
        key = ownKey(word);
      }
      seen.set(key, cls);
      const note = notes[word] || null;
      const ko = String(w.ko || '').trim();
      const g = lang === 'fr' ? genderOf(w.pos) : null;
      const { art } = lang === 'fr' ? splitFrArticle(word) : { art: null };
      const ety = etymOf(w, note?.etym, lang);
      return [compactLevelEntry({
        key, word, reading: String(w.ipa || ''), meaning: note?.mean || shortMeaning(ko), fullMeaning: ko, pos: String(w.pos || ''),
        ...(key !== word ? { alts: [word] } : {}),
        ...(g ? { g } : {}), ...(art ? { art } : {}),
        ...(note?.irregular ? { irregular: true } : {}), ...(note?.forms ? { forms: note.forms } : {}), ...(note?.conj ? { conj: note.conj } : {}),
        ...(ety ? { ety } : {}),
        ...(w.ex && w.ex[lang] ? { ex: { text: String(w.ex[lang]), ko: String(w.ex.ko || '') } } : {}),
      })];
    }),
  })).filter((g) => g.entries.length);
}

/**
 * 한 레벨의 묶음 — getVocab = 정본 레지스트리(content/{english,french} — 레퍼런스 페이지와 같은 원천, 프랑스어는 FLELex 보강 병합) ·
 * levels = 이 단어 페이지가 여는 레벨(순서대로). 앞 레벨에 이미 실은 말은 뒤 레벨에서 뺀다(HSK처럼 한 말 = 한 레벨).
 * picks는 이 레벨에만 건다(앞 레벨은 전부 센다).
 */
export function latinLevelGroups(getVocab, { lang, levelKey, levels, picks = null, notes = {} }) {
  const at = levels.indexOf(levelKey);
  if (at < 0) return null;
  const seen = new Map();
  for (const L of levels.slice(0, at)) latinSampleGroups(getVocab(L), { lang, seen });
  return latinSampleGroups(getVocab(levelKey), { lang, picks, notes, seen });
}
