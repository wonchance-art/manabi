// 단어장 학습 관련 순수 헬퍼 — 덱 그룹핑 · 신규 판정 · 하루 새 단어 한도 · 셔플
import { parseTitle } from './seriesMeta';
import { splitSentenceAroundWord } from './constants';

// 저장한 문장 전체를 가리거나 정답만 제시하면 회상할 단서가 없다.
// 선호 모드를 덮지 않고 이 카드만 기존 플래시 방식으로 출제한다.
export function usableVocabReviewMode(mode, word, options) {
  if (!word || !['context', 'listening'].includes(mode)) return mode;
  const meanings = options.map(option => option.meaning?.trim() || '');
  if (meanings.length < 2 || meanings.some(meaning => !meaning)
    || new Set(meanings).size !== meanings.length) return 'flash';
  if (mode === 'context' && word.source_sentence) {
    const { parts } = splitSentenceAroundWord(word.source_sentence, word.word_text, word.base_form);
    if (!/[\p{L}\p{N}]/u.test(parts.join(''))) return 'flash';
  }
  return mode;
}

// 하루 새 단어 한도 — Anki식 신규 큐 제한 (0 = 복습만)
export const NEW_PER_DAY_OPTIONS = [0, 5, 10, 15, 20, 30, 40];
export const DEFAULT_NEW_PER_DAY = 15;

const INTRO_KEY = 'vocab_new_intro';
const todayStr = () => new Date().toISOString().slice(0, 10);

// 신규(미학습) 판정 — 한 번이라도 복습하면 last_reviewed_at이 채워진다.
// (repetitions는 이 스키마에서 lapses라 신규 판정에 쓰면 안 됨)
export const isNewWord = (v) => !v.last_reviewed_at;

// 오늘 새로 시작한 단어 ID 집합 (날짜 바뀌면 리셋)
export function loadIntroIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(INTRO_KEY) || 'null');
    if (raw && raw.date === todayStr() && Array.isArray(raw.ids)) return raw.ids;
  } catch { /* ignore */ }
  return [];
}
export function saveIntroIds(ids) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INTRO_KEY, JSON.stringify({ date: todayStr(), ids }));
}

// 단어의 "덱" — 교재 단어는 source_ref(예: "중국어 · H3"), 리더 단어는 자료 시리즈로 묶는다.
export function deckOf(v) {
  if (v.source_ref) return { key: v.source_ref, label: v.source_ref };
  const t = v.reading_materials?.title;
  if (t) {
    const m = parseTitle(t);
    if (m.level && m.series) return { key: `${m.level}|${m.series}`, label: `${m.level} ${m.series}` };
  }
  return null;
}

export function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
