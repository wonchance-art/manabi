/**
 * cardModel.js — 노트(어휘 항목)→카드 파생 모델 + 4상태 머신
 *
 * 설계:
 * - 1노트(word_text) → N카드: forward(단어→뜻), reverse(뜻→단어)
 * - 기본 카드 종류: 2종 (FRONT, BACK) — 오너 디폴트
 * - 상태 머신: new/learning/review/relearning (Anki 공개 규격)
 * - ts-fsrs와 통합: FSRS State 매핑 + 독립 카드 스케줄
 * - 기존 데이터 무손실 승계: 기존 '1단어=1행' 어댑터 + reverse는 신규 시작
 *
 * 참고: Anki AGPL 코드 참조 허용, 이 파일의 차용 부분은 // Anki-derived 주석 필수
 */

import { State as FSRSState } from 'ts-fsrs';

// ────────────────────────────────────────────────────────────────────
// 상수 정의
// ────────────────────────────────────────────────────────────────────

/**
 * 카드 종류 (1노트에서 파생되는 카드 타입)
 */
export const CardType = {
  FRONT: 'front', // 단어 → 뜻
  BACK: 'back',   // 뜻 → 단어
};

export const CARD_TYPES = [CardType.FRONT, CardType.BACK];
export const DEFAULT_CARD_TYPES = [CardType.FRONT, CardType.BACK];

/**
 * 카드 상태 머신 (Anki 공개 규격 기준)
 * Anki-derived: https://github.com/ankitects/anki/blob/main/rslib/src/notetype.rs
 */
export const CardState = {
  NEW: 'new',           // 미학습
  LEARNING: 'learning', // 학습 중 (1~3스텝)
  REVIEW: 'review',     // 복습 (졸업 후)
  RELEARNING: 'relearning', // 재학습 (강등 후)
};

export const CARD_STATES = [CardState.NEW, CardState.LEARNING, CardState.REVIEW, CardState.RELEARNING];

/**
 * 학습 액션 (카드에 대한 사용자 응답)
 * Anki-derived: https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering.rs
 */
export const ReviewAction = {
  AGAIN: 'again',       // 다시 (실패, 1.0배 간격)
  HARD: 'hard',         // 어려움 (1.2배 간격)
  GOOD: 'good',         // 좋음 (기본)
  EASY: 'easy',         // 쉬움 (1.3배 간격)
};

export const REVIEW_ACTIONS = [ReviewAction.AGAIN, ReviewAction.HARD, ReviewAction.GOOD, ReviewAction.EASY];

/**
 * 카드→FSRS 상태 매핑 (ts-fsrs State와의 동기화)
 * Anki-derived: https://github.com/ankitects/anki/blob/main/rslib/src/cards.rs
 */
export const cardStateToFSRSState = {
  [CardState.NEW]: FSRSState.New,
  [CardState.LEARNING]: FSRSState.Learning,
  [CardState.REVIEW]: FSRSState.Review,
  [CardState.RELEARNING]: FSRSState.Relearning,
};

export const fsrsStateToCardState = {
  [FSRSState.New]: CardState.NEW,
  [FSRSState.Learning]: CardState.LEARNING,
  [FSRSState.Review]: CardState.REVIEW,
  [FSRSState.Relearning]: CardState.RELEARNING,
};

// ────────────────────────────────────────────────────────────────────
// 카드 모델 데이터 구조
// ────────────────────────────────────────────────────────────────────

/**
 * 카드 생성 시 필수 필드
 * @typedef {Object} Card
 * @property {string} id - UUID (noteId + '-' + cardType)
 * @property {string} noteId - 어휘 항목 ID (원본 word_text 기반 or user_vocabulary.id)
 * @property {string} cardType - CardType.FRONT | CardType.BACK
 * @property {string} state - CardState 중 하나
 * @property {number} reps - 반복 횟수 (누적)
 * @property {number} lapses - 강등 횟수 (다시를 선택한 횟수)
 * @property {Date} dueAt - 다음 복습 시각 (과거면 due)
 * @property {number} interval - 현재 간격(일)
 * @property {number} easeFactor - 난도 계수 (1.3~2.5)
 * @property {FSRSMemoryState} fsrsState - ts-fsrs 내부 상태 저장
 * @property {Date} createdAt - 카드 생성 시각
 * @property {Date} lastReviewedAt - 마지막 복습 시각
 * @property {string} [sourceRef] - 교재 출처 (예: "중국어 · H3")
 */

/**
 * 새 카드 생성
 * @param {string} noteId - 어휘 ID
 * @param {string} cardType - CardType.FRONT or CardType.BACK
 * @param {Object} [options]
 * @param {string} [options.sourceRef] - 교재 참조
 * @param {Date} [options.createdAt] - 기본값: now
 * @returns {Card}
 */
export function createCard(noteId, cardType, options = {}) {
  if (!CARD_TYPES.includes(cardType)) {
    throw new Error(`Invalid cardType: ${cardType}`);
  }

  const now = new Date();
  return {
    id: `${noteId}-${cardType}`,
    noteId,
    cardType,
    state: CardState.NEW,
    reps: 0,
    lapses: 0,
    dueAt: options.createdAt || now,
    interval: 0,
    easeFactor: 2.5, // Anki default
    fsrsState: null, // ts-fsrs 초기화 전
    createdAt: options.createdAt || now,
    lastReviewedAt: null,
    sourceRef: options.sourceRef,
  };
}

/**
 * 주어진 노트에서 카드 파생 (기본 2종)
 * @param {Object} note - 어휘 항목 { id, word_text, meaning, ... }
 * @param {string[]} [cardTypes] - 파생할 카드 종류 (기본값: DEFAULT_CARD_TYPES)
 * @returns {Card[]}
 */
export function deriveCardsFromNote(note, cardTypes = DEFAULT_CARD_TYPES) {
  if (!note || !note.id) throw new Error('Note must have id');

  return cardTypes.map((type) => createCard(note.id, type, {
    sourceRef: note.source_ref,
    createdAt: note.createdAt || new Date(),
  }));
}

// ────────────────────────────────────────────────────────────────────
// 상태 전이 (State Machine)
// ────────────────────────────────────────────────────────────────────

/**
 * 카드 상태 전이 규칙 (Anki 규격)
 * Anki-derived: https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering.rs
 *
 * new → learning (GOOD/HARD/EASY) | AGAIN→new
 * learning → review (GOOD졸업) | learning (AGAIN/HARD) | AGAIN→relearning
 * review → review (GOOD) | relearning (AGAIN) | review (HARD/EASY)
 * relearning → review (GOOD졸업) | relearning (AGAIN/HARD) | AGAIN→relearning
 */
export function transitionState(currentState, action) {
  if (!CARD_STATES.includes(currentState)) {
    throw new Error(`Invalid cardState: ${currentState}`);
  }
  if (!REVIEW_ACTIONS.includes(action)) {
    throw new Error(`Invalid action: ${action}`);
  }

  // Anki-derived state machine
  const transitions = {
    [CardState.NEW]: {
      [ReviewAction.AGAIN]: CardState.NEW,      // 다시 선택 → 그대로
      [ReviewAction.HARD]: CardState.LEARNING,
      [ReviewAction.GOOD]: CardState.LEARNING,
      [ReviewAction.EASY]: CardState.REVIEW,    // 쉬움 → 바로 졸업
    },
    [CardState.LEARNING]: {
      [ReviewAction.AGAIN]: CardState.LEARNING, // 다시 선택 → 그대로 (또는 relearning)
      [ReviewAction.HARD]: CardState.LEARNING,
      [ReviewAction.GOOD]: CardState.REVIEW,    // 졸업
      [ReviewAction.EASY]: CardState.REVIEW,
    },
    [CardState.REVIEW]: {
      [ReviewAction.AGAIN]: CardState.RELEARNING, // 강등
      [ReviewAction.HARD]: CardState.REVIEW,
      [ReviewAction.GOOD]: CardState.REVIEW,
      [ReviewAction.EASY]: CardState.REVIEW,
    },
    [CardState.RELEARNING]: {
      [ReviewAction.AGAIN]: CardState.RELEARNING,
      [ReviewAction.HARD]: CardState.RELEARNING,
      [ReviewAction.GOOD]: CardState.REVIEW,    // 졸업
      [ReviewAction.EASY]: CardState.REVIEW,
    },
  };

  return transitions[currentState]?.[action] || currentState;
}

// ────────────────────────────────────────────────────────────────────
// 기존 데이터 무손실 어댑터
// ────────────────────────────────────────────────────────────────────

/**
 * 기존 어휘 레코드(user_vocabulary)를 forward 카드 이력으로 승계
 *
 * 기존 필드 매핑:
 * - last_reviewed_at → card.lastReviewedAt
 * - repetitions → card.reps (Anki와 호환)
 * - interval → card.interval
 * - ease_factor → card.easeFactor
 * (lapses는 기존 스키마에 없으므로 0으로 시작)
 *
 * @param {Object} vocabRow - user_vocabulary 레코드
 * @returns {Card}
 */
export function legacyVocabToCard(vocabRow) {
  if (!vocabRow.id) throw new Error('vocabRow must have id');

  const card = createCard(vocabRow.id, CardType.FRONT, {
    sourceRef: vocabRow.source_ref,
    createdAt: vocabRow.createdAt || new Date(),
  });

  // 기존 이력 승계
  if (vocabRow.last_reviewed_at) {
    card.lastReviewedAt = new Date(vocabRow.last_reviewed_at);
    card.state = CardState.REVIEW; // 한 번이라도 복습했으면 REVIEW
  }

  card.reps = vocabRow.repetitions || 0;
  card.interval = vocabRow.interval || 0;
  card.easeFactor = vocabRow.ease_factor || 2.5;
  card.lapses = 0; // 기존 스키마에 없음

  return card;
}

/**
 * 기존 어휘 데이터→forward 카드 + reverse는 신규 생성
 * @param {Object} vocabRow - user_vocabulary 레코드
 * @returns {{ forward: Card, reverse: Card }}
 */
export function legacyVocabToCardPair(vocabRow) {
  const forward = legacyVocabToCard(vocabRow);
  const reverse = createCard(vocabRow.id, CardType.BACK, {
    sourceRef: vocabRow.source_ref,
    createdAt: vocabRow.createdAt || new Date(),
  });

  return { forward, reverse };
}

// ────────────────────────────────────────────────────────────────────
// 카드 정렬 및 필터링 헬퍼
// ────────────────────────────────────────────────────────────────────

/**
 * 카드가 due인지 판정 (지금 복습할 시간인지)
 * @param {Card} card
 * @param {Date} [now] - 기본값: now
 * @returns {boolean}
 */
export function isCardDue(card, now = new Date()) {
  return card.dueAt <= now;
}

/**
 * Due 카드 필터
 * @param {Card[]} cards
 * @param {Date} [now]
 * @returns {Card[]}
 */
export function filterDueCards(cards, now = new Date()) {
  return cards.filter((card) => isCardDue(card, now));
}

/**
 * 카드 정렬: due 오름차순 (old first)
 * @param {Card[]} cards
 * @returns {Card[]}
 */
export function sortCardsByDue(cards) {
  return [...cards].sort((a, b) => a.dueAt - b.dueAt);
}

/**
 * 카드 정렬: NEW → LEARNING → REVIEW → RELEARNING
 * @param {Card[]} cards
 * @returns {Card[]}
 */
export function sortCardsByState(cards) {
  const stateOrder = [CardState.NEW, CardState.LEARNING, CardState.REVIEW, CardState.RELEARNING];
  return [...cards].sort(
    (a, b) => stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state),
  );
}

// ────────────────────────────────────────────────────────────────────
// 게스트 폴백 & 저장소 계약
// ────────────────────────────────────────────────────────────────────

/**
 * 카드 직렬화 (localStorage/JSON 저장용)
 * Date 필드는 ISO 문자열로 변환
 * @param {Card} card
 * @returns {Object}
 */
export function serializeCard(card) {
  return {
    ...card,
    dueAt: card.dueAt.toISOString?.() || card.dueAt,
    createdAt: card.createdAt.toISOString?.() || card.createdAt,
    lastReviewedAt: card.lastReviewedAt?.toISOString?.() || card.lastReviewedAt,
  };
}

/**
 * 카드 역직렬화 (localStorage/JSON 로드용)
 * @param {Object} obj
 * @returns {Card}
 */
export function deserializeCard(obj) {
  return {
    ...obj,
    dueAt: new Date(obj.dueAt),
    createdAt: new Date(obj.createdAt),
    lastReviewedAt: obj.lastReviewedAt ? new Date(obj.lastReviewedAt) : null,
  };
}

/**
 * 기존 storage 키 계약 (무손실 어댑터)
 * - vocabulary_cards_<noteId> → 현재 카드 쌍 저장
 * - vocabulary_review_log_<noteId> → 복습 이력 (선택사항)
 *
 * @type {string}
 */
export const STORAGE_KEYS = {
  CARDS: (noteId) => `vocabulary_cards_${noteId}`,
  REVIEW_LOG: (noteId) => `vocabulary_review_log_${noteId}`,
  CARD_INDEX: 'vocabulary_card_index', // 모든 noteId 목록
};

/**
 * 게스트 폴백: localStorage에서 카드 로드
 * @param {string} noteId
 * @returns {Card[] | null}
 */
export function loadCardsFromStorage(noteId) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CARDS(noteId));
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(deserializeCard) : null;
  } catch {
    return null;
  }
}

/**
 * 게스트 폴백: localStorage에 카드 저장
 * @param {string} noteId
 * @param {Card[]} cards
 */
export function saveCardsToStorage(noteId, cards) {
  if (typeof window === 'undefined') return;
  try {
    const arr = cards.map(serializeCard);
    localStorage.setItem(STORAGE_KEYS.CARDS(noteId), JSON.stringify(arr));
    // 인덱스 갱신
    const index = JSON.parse(localStorage.getItem(STORAGE_KEYS.CARD_INDEX) || '[]');
    if (!index.includes(noteId)) {
      index.push(noteId);
      localStorage.setItem(STORAGE_KEYS.CARD_INDEX, JSON.stringify(index));
    }
  } catch {
    // ignore storage quota exceeded
  }
}

/**
 * 게스트 폴백: 모든 저장된 카드 ID 로드
 * @returns {string[]}
 */
export function loadCardIndex() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CARD_INDEX) || '[]');
  } catch {
    return [];
  }
}
