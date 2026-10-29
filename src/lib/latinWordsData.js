// 영어 · 프랑스어 단어 페이지 항목 조립(서버) — 페이지(/english|french/words/{레벨})와 정적 묶음(/api/level-words/{lang}/{레벨})이 같은 함수를 쓴다.
// 항목은 HSK · JLPT처럼 화면 조각 밖 정적 묶음으로 싣는다(LEVEL-LIST-RSC-001 — 다 채우면 프랑스어 B2가 약 300 KB, 준비 검토 ② 2026-10-29 KST).
// 원천 = 레퍼런스 페이지와 같은 정본 레지스트리(getVocab — 프랑스어는 FLELex 보강 병합). 레벨 줄 = LATIN_WORD_LEVELS.
import { LATIN_WORD_LEVELS, latinLevelGroups } from './latinLevelWords';
import { getVocab as getEnVocab } from '../content/english';
import { getVocab as getFrVocab } from '../content/french';
import enNotes from '../content/english/wordNotes';
import frNotes from '../content/french/wordNotes';

const SOURCES = {
  // 인사 · 가족 · 기초 동사 · 기초 형용사에서 두 단어씩 — 합성어(welcome) · 불규칙 동사(be · go) · 비교급(good · bad)이 한 번씩 보이게 고른다.
  english: { code: 'en', getVocab: getEnVocab, notes: enNotes, picks: { A1: [[0, ['hello', 'welcome']], [2, 2], [4, ['be', 'go']], [5, 2]] } },
  // 가족 · 일상 필수 동사 · 음식 · 기초 형용사, 테마마다 앞 두 단어.
  french: { code: 'fr', getVocab: getFrVocab, notes: frNotes, picks: { A1: [[0, 2], [1, 2], [2, 2], [5, 2]] } },
};

/** 몇 단어만 연 레벨의 고르기 — 없는 레벨은 전부 싣는다. */
export const LATIN_WORD_PICKS = Object.freeze(Object.fromEntries(Object.entries(SOURCES).map(([lang, s]) => [lang, s.picks])));

/** lang = 'english' | 'french' · levelParam = 'a1' 등 → { lang, levelKey, groups } | null(열지 않은 언어 · 레벨). */
export function latinWordsData(lang, levelParam) {
  const src = SOURCES[lang];
  const levels = LATIN_WORD_LEVELS[lang];
  const levelKey = String(levelParam || '').toUpperCase();
  if (!src || !levels?.includes(levelKey)) return null;
  const groups = latinLevelGroups(src.getVocab, { lang: src.code, levelKey, levels, picks: src.picks[levelKey] || null, notes: src.notes });
  return groups ? { lang, levelKey, groups } : null;
}

/** 굽는 묶음 · 페이지 주소 — { lang, level } 줄. */
export const latinWordParams = () => Object.entries(LATIN_WORD_LEVELS).flatMap(([lang, levels]) => levels.map((key) => ({ lang, level: key.toLowerCase() })));
