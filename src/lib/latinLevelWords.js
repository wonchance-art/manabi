// 영어 · 프랑스어 단어 페이지 묶음(오너 2026-10-26 KST 「단어 몇개만 넣어서 일단 열어봐」) — 레퍼런스 어휘(src/content/*/vocab)에서
// 고른 단어를 HSK · JLPT 단어 화면(LevelWordScreen)과 같은 항목 꼴로 만든다. 같은 단어 · 같은 예문에, 한 단어 화면 보충(wordNotes)만 더한다.
// 대조 키 = 정본 normalizeRefWordKey — 프랑스어는 관사를 뗀 꼴(「famille」, 오너 결정 ① 추천안)이라 뷰어에서 담은 단어와 한 행에서 만난다.
// 레퍼런스 어휘 페이지가 예전에 저장한 관사 붙은 꼴(「la famille」)은 alts로 함께 찾는다(entryKeys).
// levelWordKey(공백 제거 — 「good morning」 → 「goodmorning」)는 쓰지 않는다.
import { compactLevelEntry, shortMeaning } from './levelList';
import { normalizeRefWordKey } from './refWordNormalize';

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

/**
 * vocab = 레퍼런스 어휘 한 레벨({ themes:[{ name, words }] }) · lang = 'en' | 'fr' · picks = [[테마 순번, 앞에서 몇 개 | 표제어 목록]] ·
 * notes = 한 단어 화면 보충(content/*\/wordNotes.js).
 */
export function latinSampleGroups(vocab, { lang, picks, notes = {} }) {
  if (!vocab?.themes) return null;
  return picks.map(([i, which]) => [vocab.themes[i], which]).filter(([t]) => t).map(([t, which]) => ({
    name: t.name,
    entries: (Array.isArray(which) ? which.map((h) => t.words.find((w) => w[lang] === h)).filter(Boolean) : t.words.slice(0, which)).map((w) => {
      const word = String(w[lang] || '');
      const key = normalizeRefWordKey(lang, word);
      const note = notes[word] || null;
      const ko = String(w.ko || '').trim();
      const g = lang === 'fr' ? genderOf(w.pos) : null;
      const { art } = lang === 'fr' ? splitFrArticle(word) : { art: null };
      const ety = etymOf(w, note?.etym, lang);
      return compactLevelEntry({
        key, word, reading: String(w.ipa || ''), meaning: note?.mean || shortMeaning(ko), fullMeaning: ko, pos: String(w.pos || ''),
        ...(key !== word ? { alts: [word] } : {}),
        ...(g ? { g } : {}), ...(art ? { art } : {}),
        ...(note?.irregular ? { irregular: true } : {}), ...(note?.forms ? { forms: note.forms } : {}), ...(note?.conj ? { conj: note.conj } : {}),
        ...(ety ? { ety } : {}),
        ...(w.ex && w.ex[lang] ? { ex: { text: String(w.ex[lang]), ko: String(w.ex.ko || '') } } : {}),
      });
    }),
  }));
}
