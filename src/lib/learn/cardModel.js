/**
 * 어휘 SRS 카드 모델 — 노트→카드 파생 + 4상태 머신 (G1-A)
 *
 * 설계: docs/audit-card-srs.md #578
 * Anki 개념 차용 (개인 사용 방침 #150 5066898872):
 * - 1개 노트(단어) → N개 카드 (FRONT: 단어→뜻, BACK: 뜻→단어)
 * - 4상태 머신: new → learning → review ↔ relearning
 *
 * ts-fsrs State 매핑:
 *   - new → ts-fsrs.State.New
 *   - learning → ts-fsrs.State.Learning (1~10분 초기 반복)
 *   - review → ts-fsrs.State.Review (장기 복습)
 *   - relearning → ts-fsrs.State.Relearning (오답 후 재진입)
 *
 * DB 적응: 기존 user_vocabulary 무손실 유지 + localStorage 저장 (게스트 폴백)
 */

import { State } from 'ts-fsrs';

// ────────────────────────────────────────────────────────────────────────────
// 1. 상수 및 열거형
// ────────────────────────────────────────────────────────────────────────────

export const CARD_TYPE = Object.freeze({
  FRONT: 'front', // 단어 → 뜻 (선택형)
  BACK: 'back',   // 뜻 → 단어 (선택형)
  // LISTENING: 'listening' 추후 확장
});

export const CARD_STATE = Object.freeze({
  NEW: 'new',               // 처음 본 카드
  LEARNING: 'learning',     // 배운 직후 짧은 반복 (1~10분)
  REVIEW: 'review',         // 장기 복습 상태
  RELEARNING: 'relearning', // 오답 후 재진입
});

/**
 * 카드 상태 전이표 (Anki 개념 기반)
 *
 * rating: 1=Again / 2=Hard / 3=Good / 4=Easy
 */
export const STATE_TRANSITIONS = Object.freeze({
  [CARD_STATE.NEW]: {
    1: CARD_STATE.NEW,       // Again → 다시 NEW (1회 카운트)
    2: CARD_STATE.LEARNING,  // Hard → 학습 상태 진입
    3: CARD_STATE.LEARNING,  // Good → 학습 상태 진입
    4: CARD_STATE.REVIEW,    // Easy → 즉시 복습 상태
  },
  [CARD_STATE.LEARNING]: {
    1: CARD_STATE.LEARNING,  // Again → 학습 중 재반복
    2: CARD_STATE.LEARNING,  // Hard → 학습 중 유지
    3: CARD_STATE.REVIEW,    // Good → 복습 상태 진입
    4: CARD_STATE.REVIEW,    // Easy → 복습 상태 진입
  },
  [CARD_STATE.REVIEW]: {
    1: CARD_STATE.RELEARNING, // Again → 재학습 상태 진입
    2: CARD_STATE.REVIEW,     // Hard → 복습 유지
    3: CARD_STATE.REVIEW,     // Good → 복습 유지
    4: CARD_STATE.REVIEW,     // Easy → 복습 유지
  },
  [CARD_STATE.RELEARNING]: {
    1: CARD_STATE.RELEARNING, // Again → 재학습 중 유지
    2: CARD_STATE.RELEARNING, // Hard → 재학습 중 유지
    3: CARD_STATE.REVIEW,     // Good → 복습 상태로 복귀
    4: CARD_STATE.REVIEW,     // Easy → 복습 상태로 복귀
  },
});

// ────────────────────────────────────────────────────────────────────────────
// 2. 타입 정의 & 카드 생성
// ────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} VocabNote
 * @property {string} id - 단어 고유 ID (vocab row id)
 * @property {string} word - 단어 텍스트
 * @property {string} meaning - 정의/뜻
 * @property {string} [language] - 언어 코드 (기본: ko)
 * @property {string} [sourceMaterialId] - 출처 자료 ID
 * @property {Object} [fsrs] - 기존 FSRS 상태 (마이그레이션용)
 */

/**
 * @typedef {Object} VocabCard
 * @property {string} id - 카드 고유 ID ({noteId}_{type})
 * @property {string} noteId - 부모 노트 ID
 * @property {string} type - CARD_TYPE (front/back)
 * @property {string} word - 단어 (두 카드 모두)
 * @property {string} meaning - 정의 (두 카드 모두)
 * @property {string} state - CARD_STATE (new/learning/review/relearning)
 * @property {number} interval - FSRS stability (일 단위)
 * @property {number} easeFactor - FSRS difficulty (1~10)
 * @property {number} repetitions - FSRS lapses (오답 누적)
 * @property {string} nextReviewAt - ISO 타임스탬프
 * @property {string} [lastReviewedAt] - 마지막 복습 시각
 * @property {string} [language] - 언어 코드
 * @property {string} [sourceMaterialId] - 출처 자료 ID
 * @property {number} [createdAt] - 카드 생성 시각 (ms)
 */

/**
 * 노트에서 카드 2개 파생 (FRONT + BACK)
 * @param {VocabNote} note
 * @returns {VocabCard[]}
 */
export function deriveCardsFromNote(note) {
  if (!note?.id || !note?.word || !note?.meaning) {
    console.warn('[cardModel] deriveCardsFromNote: incomplete note', note);
    return [];
  }

  const now = Date.now();
  const baseCard = {
    noteId: note.id,
    word: note.word,
    meaning: note.meaning,
    language: note.language || 'ko',
    sourceMaterialId: note.sourceMaterialId,
    createdAt: now,
  };

  // FRONT 카드: 단어 → 뜻 (선택형)
  const front = {
    ...baseCard,
    id: `${note.id}_front`,
    type: CARD_TYPE.FRONT,
    state: CARD_STATE.NEW,
    interval: 0,
    easeFactor: 0,
    repetitions: 0,
    nextReviewAt: new Date().toISOString(),
  };

  // BACK 카드: 뜻 → 단어 (선택형)
  const back = {
    ...baseCard,
    id: `${note.id}_back`,
    type: CARD_TYPE.BACK,
    state: CARD_STATE.NEW,
    interval: 0,
    easeFactor: 0,
    repetitions: 0,
    nextReviewAt: new Date().toISOString(),
  };

  return [front, back];
}

/**
 * 기존 user_vocabulary 행 → FRONT 카드로 무손실 마이그레이션
 * 기존 interval/ease_factor/repetitions/next_review_at 유지
 * @param {Object} vocabRow - user_vocabulary 행
 * @returns {VocabCard}
 */
export function migrateVocabRowToCard(vocabRow) {
  if (!vocabRow?.id) {
    console.warn('[cardModel] migrateVocabRowToCard: no id', vocabRow);
    return null;
  }

  const card = {
    id: `${vocabRow.id}_front`,
    noteId: vocabRow.id,
    type: CARD_TYPE.FRONT,
    word: vocabRow.word || '',
    meaning: vocabRow.meaning || '',
    state: CARD_STATE.REVIEW, // 기존 data는 모두 review로 간주 (interval > 0이면)
    interval: vocabRow.interval ?? 0,
    easeFactor: vocabRow.ease_factor ?? 0,
    repetitions: vocabRow.repetitions ?? 0,
    nextReviewAt: vocabRow.next_review_at || new Date().toISOString(),
    lastReviewedAt: vocabRow.last_reviewed_at,
    language: vocabRow.language || 'ko',
    sourceMaterialId: vocabRow.source_material_id,
    createdAt: vocabRow.created_at ? new Date(vocabRow.created_at).getTime() : Date.now(),
  };

  // 신규 카드는 interval=0, else review
  if (card.interval === 0 && !card.lastReviewedAt) {
    card.state = CARD_STATE.NEW;
  }

  return card;
}

// ────────────────────────────────────────────────────────────────────────────
// 3. 상태 전이 로직
// ────────────────────────────────────────────────────────────────────────────

/**
 * 평정(rating)에 따른 상태 전이 계산
 * @param {string} currentState - CARD_STATE
 * @param {number} rating - 1/2/3/4
 * @returns {string} 다음 상태
 */
export function nextCardState(currentState, rating) {
  if (!STATE_TRANSITIONS[currentState]) {
    console.warn('[cardModel] nextCardState: unknown state', currentState);
    return currentState;
  }

  const nextState = STATE_TRANSITIONS[currentState]?.[rating];
  if (!nextState) {
    console.warn('[cardModel] nextCardState: unknown rating', rating);
    return currentState;
  }

  return nextState;
}

/**
 * ts-fsrs State enum → 우리 CARD_STATE
 * @param {ts-fsrs.State} state
 * @returns {string} CARD_STATE
 */
export function fromFsrsState(state) {
  switch (state) {
    case State.New:
      return CARD_STATE.NEW;
    case State.Learning:
      return CARD_STATE.LEARNING;
    case State.Review:
      return CARD_STATE.REVIEW;
    case State.Relearning:
      return CARD_STATE.RELEARNING;
    default:
      return CARD_STATE.NEW;
  }
}

/**
 * 우리 CARD_STATE → ts-fsrs State enum
 * @param {string} state - CARD_STATE
 * @returns {ts-fsrs.State}
 */
export function toFsrsState(state) {
  switch (state) {
    case CARD_STATE.NEW:
      return State.New;
    case CARD_STATE.LEARNING:
      return State.Learning;
    case CARD_STATE.REVIEW:
      return State.Review;
    case CARD_STATE.RELEARNING:
      return State.Relearning;
    default:
      return State.New;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4. localStorage 저장소 (게스트 폴백)
// ────────────────────────────────────────────────────────────────────────────

const CARDS_STORAGE_KEY = 'manabi-vocab-cards-v1';
const CARD_INDEX_STORAGE_KEY = 'manabi-vocab-card-index-v1';

/**
 * 사용자/게스트의 모든 카드 localStorage 로드
 * @param {string} [userId] - 로그인 사용자 ID (없으면 게스트)
 * @returns {VocabCard[]}
 */
export function loadCardsFromStorage(userId) {
  if (typeof window === 'undefined') return [];

  try {
    const key = userId ? `${CARDS_STORAGE_KEY}:${userId}` : CARDS_STORAGE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const cards = JSON.parse(raw);
    return Array.isArray(cards) ? cards : [];
  } catch (e) {
    console.error('[cardModel] loadCardsFromStorage error:', e);
    return [];
  }
}

/**
 * 사용자/게스트의 모든 카드 localStorage 저장
 * @param {VocabCard[]} cards
 * @param {string} [userId]
 */
export function saveCardsToStorage(cards, userId) {
  if (typeof window === 'undefined') return;

  try {
    const key = userId ? `${CARDS_STORAGE_KEY}:${userId}` : CARDS_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(cards));
  } catch (e) {
    console.error('[cardModel] saveCardsToStorage error:', e);
  }
}

/**
 * 인덱스: noteId → 카드들 (빠른 조회)
 * @param {VocabCard[]} cards
 * @returns {Object} Map<noteId, VocabCard[]>
 */
export function buildCardIndex(cards) {
  const index = new Map();
  for (const card of cards) {
    if (!card.noteId) continue;
    if (!index.has(card.noteId)) index.set(card.noteId, []);
    index.get(card.noteId).push(card);
  }
  return index;
}

/**
 * 카드 추가/업데이트 (noteId 기반)
 * @param {VocabCard[]} cards - 현재 카드 배열
 * @param {VocabCard} newCard - 추가/업데이트할 카드
 * @returns {VocabCard[]} 업데이트된 배열
 */
export function upsertCard(cards, newCard) {
  const idx = cards.findIndex((c) => c.id === newCard.id);
  if (idx >= 0) {
    const updated = [...cards];
    updated[idx] = { ...updated[idx], ...newCard };
    return updated;
  }
  return [...cards, newCard];
}

/**
 * 카드 삭제 (카드 ID 기반)
 * @param {VocabCard[]} cards
 * @param {string} cardId
 * @returns {VocabCard[]}
 */
export function deleteCard(cards, cardId) {
  return cards.filter((c) => c.id !== cardId);
}

/**
 * 노트 삭제 (noteId의 모든 카드 제거)
 * @param {VocabCard[]} cards
 * @param {string} noteId
 * @returns {VocabCard[]}
 */
export function deleteNoteCards(cards, noteId) {
  return cards.filter((c) => c.noteId !== noteId);
}

// ────────────────────────────────────────────────────────────────────────────
// 5. 세션 큐 빌더 (샌드위치 연계용)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 복습 대기 카드 필터 (now 기준)
 * @param {VocabCard[]} cards
 * @param {Date} [now] - 비교 기준 시각
 * @returns {VocabCard[]} due 카드 (기한 오래된 순)
 */
export function filterDueCards(cards, now = new Date()) {
  return cards
    .filter((c) => new Date(c.nextReviewAt) <= now)
    .sort((a, b) => new Date(a.nextReviewAt) - new Date(b.nextReviewAt));
}

/**
 * 신규 카드 필터
 * @param {VocabCard[]} cards
 * @returns {VocabCard[]}
 */
export function filterNewCards(cards) {
  return cards.filter((c) => c.state === CARD_STATE.NEW);
}

/**
 * 복습/재학습 카드 필터
 * @param {VocabCard[]} cards
 * @returns {VocabCard[]}
 */
export function filterReviewCards(cards) {
  return cards.filter((c) => c.state === CARD_STATE.REVIEW || c.state === CARD_STATE.RELEARNING);
}

// ────────────────────────────────────────────────────────────────────────────
// 6. 샌드위치 연계 API
// ────────────────────────────────────────────────────────────────────────────

/**
 * vocabPreview 섹션에서 카드 등록 (lessonId + 단어 정보)
 * → deriveCardsFromNote() + localStorage 저장
 *
 * @param {Object} params
 * @param {string} params.wordId - 단어 고유 ID
 * @param {string} params.word - 단어 텍스트
 * @param {string} params.meaning - 정의
 * @param {string} [params.language] - 언어 (기본: ko)
 * @param {string} [params.sourceMaterialId] - 출처 자료 ID
 * @param {string} [params.userId] - 로그인 사용자 ID (선택)
 * @returns {VocabCard[]} 생성된 카드 배열 (2개: front/back)
 */
export function registerNoteFromLesson({ wordId, word, meaning, language, sourceMaterialId, userId }) {
  // 1. 노트 생성
  const note = {
    id: wordId,
    word,
    meaning,
    language: language || 'ko',
    sourceMaterialId,
  };

  // 2. 카드 파생
  const newCards = deriveCardsFromNote(note);
  if (newCards.length === 0) {
    console.warn('[cardModel] registerNoteFromLesson: failed to derive cards', note);
    return [];
  }

  // 3. localStorage 로드 → 병합 → 저장
  let cards = loadCardsFromStorage(userId);
  for (const card of newCards) {
    cards = upsertCard(cards, card);
  }
  saveCardsToStorage(cards, userId);

  console.log(`[cardModel] registered note ${wordId}: ${newCards.length} cards`);
  return newCards;
}

// ────────────────────────────────────────────────────────────────────────────
// 7. 상태 머신 조회 헬퍼
// ────────────────────────────────────────────────────────────────────────────

/**
 * 카드의 "준비도" 레이블 (UI용)
 * @param {VocabCard} card
 * @returns {string}
 */
export function cardReadinessLabel(card) {
  switch (card.state) {
    case CARD_STATE.NEW:
      return 'New';
    case CARD_STATE.LEARNING:
      return 'Learning';
    case CARD_STATE.REVIEW:
      return 'Review';
    case CARD_STATE.RELEARNING:
      return 'Relearning';
    default:
      return '?';
  }
}

/**
 * 카드의 다음 복습까지 남은 시간 (텍스트)
 * @param {VocabCard} card
 * @returns {string}
 */
export function timeUntilReview(card) {
  const now = Date.now();
  const due = new Date(card.nextReviewAt).getTime();
  const ms = due - now;

  if (ms <= 0) return 'Due now';
  if (ms < 60 * 1000) return '< 1m';
  if (ms < 60 * 60 * 1000) return `${Math.ceil(ms / (60 * 1000))}m`;
  if (ms < 24 * 60 * 60 * 1000) return `${Math.ceil(ms / (60 * 60 * 1000))}h`;
  return `${Math.ceil(ms / (24 * 60 * 60 * 1000))}d`;
}
