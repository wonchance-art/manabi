// 단어장 학습 관련 순수 헬퍼 — 덱 그룹핑 · 신규 판정 · 하루 새 단어 한도 · 셔플
import { parseTitle } from './seriesMeta';
import { splitSentenceAroundWord } from './constants';
import { learningDay } from './fsrsScheduler';
import { DEFAULT_SESSION_LENGTH, SESSION_LENGTHS } from './reviewQueue';

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

// 하루 새 단어 한도 — Anki식 신규 큐 제한 (0 = 복습만). 9999 = 「제한 없음」(Anki 상한과 같은 값 — 사실상 끔, LEVEL-NEW-UNLIMITED-001 ·
// 오너 결정 2026-10-30 KST). 서버(learning_configure_admission · fsrs_apply_operation · 정책 CHECK)도 같은 목록이다.
export const NEW_PER_DAY_UNLIMITED = 9999;
export const NEW_PER_DAY_OPTIONS = [0, 5, 10, 15, 20, 30, 40, NEW_PER_DAY_UNLIMITED];
/** 설정 · 안내의 한도 글 — 0 = 「없음 (복습만)」, 9999 = 「제한 없음」. */
export const newPerDayLabel = (n) => (n === 0 ? '없음 (복습만)' : n === NEW_PER_DAY_UNLIMITED ? '제한 없음' : `${n}개`);
export const DEFAULT_NEW_PER_DAY = 15;

const INTRO_KEY = 'vocab_new_intro';
// 오늘 = 학습일(04:00 KST 경계) — 서버의 새 단어 하루 몫과 같은 날(2026-10-25 KST, 그 전은 UTC 날짜 = 09:00 KST에 넘어갔다).
// 저장 모양(YYYY-MM-DD)은 그대로라 같은 학습일이면 이전 기록을 이어 읽는다.
const todayStr = () => new Date(learningDay(Date.now()) * 86400000).toISOString().slice(0, 10);

// 신규(미학습) 판정 — 한 번이라도 복습하면 last_reviewed_at이 채워진다.
// (repetitions는 이 스키마에서 lapses라 신규 판정에 쓰면 안 됨)
export const isNewWord = (v) => !v.last_reviewed_at;

// 이 기기의 하루 새 단어 한도(복습 설정) — 배움 칸 · 단어 목록이 같은 값을 읽는다. 없거나 깨졌으면 기본값.
export function loadNewPerDay() {
  if (typeof window === 'undefined') return DEFAULT_NEW_PER_DAY;
  try { const stored = parseInt(localStorage.getItem('vocab_new_per_day'), 10); if (NEW_PER_DAY_OPTIONS.includes(stored)) return stored; } catch { /* 저장소 차단 */ }
  return DEFAULT_NEW_PER_DAY;
}

// 이 기기의 복습 세션 길이(서로 다른 카드 수) — 단어장 복습 설정이 저장하고 단어장 · 내 정보가 같은 값을 읽는다.
// 'all'은 전부(null), 없거나 깨졌으면 기본값.
export function loadSessionLength() {
  if (typeof window === 'undefined') return DEFAULT_SESSION_LENGTH;
  try {
    const stored = localStorage.getItem('vocab_session_length');
    if (stored === 'all') return null;
    if (SESSION_LENGTHS.includes(Number(stored))) return Number(stored);
  } catch { /* 저장소 차단 */ }
  return DEFAULT_SESSION_LENGTH;
}

/** 세션 길이 쓰기 — loadSessionLength의 짝(null = 전부 'all'). 단어장 복습 칸 · 내 정보 「단어 복습」 시트가 같은 키에 쓴다. */
export function saveSessionLength(length) {
  try { localStorage.setItem('vocab_session_length', String(length ?? 'all')); } catch { /* 저장소 차단 */ }
}

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
