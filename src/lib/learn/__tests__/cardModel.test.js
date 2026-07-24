import { describe, it, expect, beforeEach } from 'vitest';
import {
  CARD_TYPE,
  CARD_STATE,
  STATE_TRANSITIONS,
  deriveCardsFromNote,
  migrateVocabRowToCard,
  nextCardState,
  fromFsrsState,
  toFsrsState,
  loadCardsFromStorage,
  saveCardsToStorage,
  buildCardIndex,
  upsertCard,
  deleteCard,
  deleteNoteCards,
  filterDueCards,
  filterNewCards,
  filterReviewCards,
  registerNoteFromLesson,
  cardReadinessLabel,
  timeUntilReview,
} from '../cardModel';
import { State } from 'ts-fsrs';

describe('cardModel', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // 1. 상수 및 열거형
  // ────────────────────────────────────────────────────────────────────────────

  describe('CARD_TYPE & CARD_STATE', () => {
    it('CARD_TYPE.FRONT exists', () => {
      expect(CARD_TYPE.FRONT).toBe('front');
    });

    it('CARD_TYPE.BACK exists', () => {
      expect(CARD_TYPE.BACK).toBe('back');
    });

    it('CARD_STATE has 4 states', () => {
      expect(Object.keys(CARD_STATE)).toHaveLength(4);
      expect(CARD_STATE.NEW).toBe('new');
      expect(CARD_STATE.LEARNING).toBe('learning');
      expect(CARD_STATE.REVIEW).toBe('review');
      expect(CARD_STATE.RELEARNING).toBe('relearning');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 2. 카드 생성
  // ────────────────────────────────────────────────────────────────────────────

  describe('deriveCardsFromNote', () => {
    const note = {
      id: 'word_1',
      word: '안녕',
      meaning: 'hello',
      language: 'ko',
      sourceMaterialId: 'material_1',
    };

    it('생성 카드 2개 (front + back)', () => {
      const cards = deriveCardsFromNote(note);
      expect(cards).toHaveLength(2);
    });

    it('FRONT 카드: 단어 → 뜻', () => {
      const cards = deriveCardsFromNote(note);
      const front = cards.find((c) => c.type === CARD_TYPE.FRONT);
      expect(front).toBeDefined();
      expect(front.id).toBe('word_1_front');
      expect(front.word).toBe('안녕');
      expect(front.meaning).toBe('hello');
      expect(front.noteId).toBe('word_1');
    });

    it('BACK 카드: 뜻 → 단어', () => {
      const cards = deriveCardsFromNote(note);
      const back = cards.find((c) => c.type === CARD_TYPE.BACK);
      expect(back).toBeDefined();
      expect(back.id).toBe('word_1_back');
      expect(back.type).toBe(CARD_TYPE.BACK);
    });

    it('두 카드 모두 state=new, interval=0', () => {
      const cards = deriveCardsFromNote(note);
      cards.forEach((card) => {
        expect(card.state).toBe(CARD_STATE.NEW);
        expect(card.interval).toBe(0);
        expect(card.easeFactor).toBe(0);
        expect(card.repetitions).toBe(0);
      });
    });

    it('언어 기본값: ko', () => {
      const cards = deriveCardsFromNote({ id: 'w', word: 'a', meaning: 'b' });
      expect(cards[0].language).toBe('ko');
    });

    it('incomplete note → []', () => {
      expect(deriveCardsFromNote({ id: 'w' })).toEqual([]);
      expect(deriveCardsFromNote({ word: 'a' })).toEqual([]);
      expect(deriveCardsFromNote(null)).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 3. 마이그레이션
  // ────────────────────────────────────────────────────────────────────────────

  describe('migrateVocabRowToCard', () => {
    const vocabRow = {
      id: 'vocab_1',
      word: '한국',
      meaning: 'Korea',
      interval: 5,
      ease_factor: 2.5,
      repetitions: 3,
      next_review_at: '2026-07-25T10:00:00Z',
      last_reviewed_at: '2026-07-24T10:00:00Z',
      language: 'ko',
      source_material_id: 'mat_1',
    };

    it('기존 interval/ease_factor/repetitions 무손실', () => {
      const card = migrateVocabRowToCard(vocabRow);
      expect(card.interval).toBe(5);
      expect(card.easeFactor).toBe(2.5);
      expect(card.repetitions).toBe(3);
    });

    it('next_review_at 유지', () => {
      const card = migrateVocabRowToCard(vocabRow);
      expect(card.nextReviewAt).toBe('2026-07-25T10:00:00Z');
    });

    it('type=FRONT로 마이그레이션', () => {
      const card = migrateVocabRowToCard(vocabRow);
      expect(card.type).toBe(CARD_TYPE.FRONT);
    });

    it('interval > 0인 행 → state=review', () => {
      const card = migrateVocabRowToCard(vocabRow);
      expect(card.state).toBe(CARD_STATE.REVIEW);
    });

    it('interval=0 & !last_reviewed_at → state=new', () => {
      const newRow = { ...vocabRow, interval: 0, last_reviewed_at: null };
      const card = migrateVocabRowToCard(newRow);
      expect(card.state).toBe(CARD_STATE.NEW);
    });

    it('no id → null', () => {
      expect(migrateVocabRowToCard({ word: 'a' })).toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 4. 상태 전이
  // ────────────────────────────────────────────────────────────────────────────

  describe('nextCardState (상태 전이표)', () => {
    it('NEW: Again → NEW', () => {
      expect(nextCardState(CARD_STATE.NEW, 1)).toBe(CARD_STATE.NEW);
    });

    it('NEW: Hard/Good → LEARNING', () => {
      expect(nextCardState(CARD_STATE.NEW, 2)).toBe(CARD_STATE.LEARNING);
      expect(nextCardState(CARD_STATE.NEW, 3)).toBe(CARD_STATE.LEARNING);
    });

    it('NEW: Easy → REVIEW', () => {
      expect(nextCardState(CARD_STATE.NEW, 4)).toBe(CARD_STATE.REVIEW);
    });

    it('LEARNING: Again/Hard → LEARNING', () => {
      expect(nextCardState(CARD_STATE.LEARNING, 1)).toBe(CARD_STATE.LEARNING);
      expect(nextCardState(CARD_STATE.LEARNING, 2)).toBe(CARD_STATE.LEARNING);
    });

    it('LEARNING: Good/Easy → REVIEW', () => {
      expect(nextCardState(CARD_STATE.LEARNING, 3)).toBe(CARD_STATE.REVIEW);
      expect(nextCardState(CARD_STATE.LEARNING, 4)).toBe(CARD_STATE.REVIEW);
    });

    it('REVIEW: Again → RELEARNING', () => {
      expect(nextCardState(CARD_STATE.REVIEW, 1)).toBe(CARD_STATE.RELEARNING);
    });

    it('REVIEW: Hard/Good/Easy → REVIEW', () => {
      expect(nextCardState(CARD_STATE.REVIEW, 2)).toBe(CARD_STATE.REVIEW);
      expect(nextCardState(CARD_STATE.REVIEW, 3)).toBe(CARD_STATE.REVIEW);
      expect(nextCardState(CARD_STATE.REVIEW, 4)).toBe(CARD_STATE.REVIEW);
    });

    it('RELEARNING: Again/Hard → RELEARNING', () => {
      expect(nextCardState(CARD_STATE.RELEARNING, 1)).toBe(CARD_STATE.RELEARNING);
      expect(nextCardState(CARD_STATE.RELEARNING, 2)).toBe(CARD_STATE.RELEARNING);
    });

    it('RELEARNING: Good/Easy → REVIEW', () => {
      expect(nextCardState(CARD_STATE.RELEARNING, 3)).toBe(CARD_STATE.REVIEW);
      expect(nextCardState(CARD_STATE.RELEARNING, 4)).toBe(CARD_STATE.REVIEW);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 5. ts-fsrs State 매핑
  // ────────────────────────────────────────────────────────────────────────────

  describe('fromFsrsState / toFsrsState', () => {
    it('State.New ↔ CARD_STATE.NEW', () => {
      expect(fromFsrsState(State.New)).toBe(CARD_STATE.NEW);
      expect(toFsrsState(CARD_STATE.NEW)).toBe(State.New);
    });

    it('State.Learning ↔ CARD_STATE.LEARNING', () => {
      expect(fromFsrsState(State.Learning)).toBe(CARD_STATE.LEARNING);
      expect(toFsrsState(CARD_STATE.LEARNING)).toBe(State.Learning);
    });

    it('State.Review ↔ CARD_STATE.REVIEW', () => {
      expect(fromFsrsState(State.Review)).toBe(CARD_STATE.REVIEW);
      expect(toFsrsState(CARD_STATE.REVIEW)).toBe(State.Review);
    });

    it('State.Relearning ↔ CARD_STATE.RELEARNING', () => {
      expect(fromFsrsState(State.Relearning)).toBe(CARD_STATE.RELEARNING);
      expect(toFsrsState(CARD_STATE.RELEARNING)).toBe(State.Relearning);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 6. buildCardIndex 유틸리티 (inMemory)
  // ────────────────────────────────────────────────────────────────────────────

  describe('buildCardIndex: noteId 매핑', () => {
    it('카드 그룹핑', () => {
      const cards = [
        { id: 'c1', noteId: 'n1', type: CARD_TYPE.FRONT },
        { id: 'c2', noteId: 'n1', type: CARD_TYPE.BACK },
        { id: 'c3', noteId: 'n2', type: CARD_TYPE.FRONT },
      ];

      const index = buildCardIndex(cards);
      expect(index.get('n1')).toHaveLength(2);
      expect(index.get('n2')).toHaveLength(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 7. 카드 조작 (upsert/delete)
  // ────────────────────────────────────────────────────────────────────────────

  describe('upsertCard', () => {
    const cards = [
      { id: 'c1', word: 'old' },
      { id: 'c2', word: 'other' },
    ];

    it('신규 카드 추가', () => {
      const result = upsertCard(cards, { id: 'c3', word: 'new' });
      expect(result).toHaveLength(3);
      expect(result.find((c) => c.id === 'c3')).toBeDefined();
    });

    it('기존 카드 업데이트', () => {
      const result = upsertCard(cards, { id: 'c1', word: 'updated' });
      expect(result).toHaveLength(2);
      expect(result[0].word).toBe('updated');
    });
  });

  describe('deleteCard', () => {
    const cards = [
      { id: 'c1', word: 'a' },
      { id: 'c2', word: 'b' },
    ];

    it('카드 삭제', () => {
      const result = deleteCard(cards, 'c1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c2');
    });
  });

  describe('deleteNoteCards', () => {
    const cards = [
      { id: 'c1', noteId: 'n1' },
      { id: 'c2', noteId: 'n1' },
      { id: 'c3', noteId: 'n2' },
    ];

    it('noteId의 모든 카드 삭제', () => {
      const result = deleteNoteCards(cards, 'n1');
      expect(result).toHaveLength(1);
      expect(result[0].noteId).toBe('n2');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 8. 필터 (due/new/review)
  // ────────────────────────────────────────────────────────────────────────────

  describe('필터 함수들', () => {
    const now = new Date('2026-07-24T12:00:00Z');
    const cards = [
      { id: 'c1', state: CARD_STATE.NEW, nextReviewAt: '2026-07-25T00:00:00Z' },
      { id: 'c2', state: CARD_STATE.REVIEW, nextReviewAt: '2026-07-23T00:00:00Z' }, // due
      { id: 'c3', state: CARD_STATE.REVIEW, nextReviewAt: '2026-07-26T00:00:00Z' },
      { id: 'c4', state: CARD_STATE.RELEARNING, nextReviewAt: '2026-07-24T00:00:00Z' }, // due
    ];

    it('filterDueCards: 기한 이상 오래된 순', () => {
      const due = filterDueCards(cards, now);
      expect(due).toHaveLength(2);
      expect(due[0].id).toBe('c2'); // 가장 오래됨
      expect(due[1].id).toBe('c4');
    });

    it('filterNewCards: state=new만', () => {
      const newCards = filterNewCards(cards);
      expect(newCards).toHaveLength(1);
      expect(newCards[0].id).toBe('c1');
    });

    it('filterReviewCards: review/relearning', () => {
      const reviewCards = filterReviewCards(cards);
      expect(reviewCards).toHaveLength(3);
      expect(reviewCards.map((c) => c.id)).toContain('c2');
      expect(reviewCards.map((c) => c.id)).toContain('c4');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 9. 샌드위치 연계 API
  // ────────────────────────────────────────────────────────────────────────────

  describe('registerNoteFromLesson', () => {
    it('카드 2개 생성 및 반환', () => {
      // registerNoteFromLesson은 내부적으로 deriveCardsFromNote 호출 + localStorage 저장
      // 반환값 검증: 2개 카드가 front/back 타입으로 생성됨
      const result = registerNoteFromLesson({
        wordId: 'w1',
        word: '한글',
        meaning: 'Korean script',
        userId: 'user_1',
      });

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe(CARD_TYPE.FRONT);
      expect(result[1].type).toBe(CARD_TYPE.BACK);
    });

    it('incomplete params → []', () => {
      const result = registerNoteFromLesson({ wordId: 'w3' });
      expect(result).toEqual([]);
    });

    it('두 카드의 noteId 일치', () => {
      const result = registerNoteFromLesson({
        wordId: 'w4',
        word: 'test',
        meaning: 'exam',
      });

      expect(result[0].noteId).toBe('w4');
      expect(result[1].noteId).toBe('w4');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // 10. 헬퍼 함수
  // ────────────────────────────────────────────────────────────────────────────

  describe('cardReadinessLabel', () => {
    it('각 state별 라벨', () => {
      expect(cardReadinessLabel({ state: CARD_STATE.NEW })).toBe('New');
      expect(cardReadinessLabel({ state: CARD_STATE.LEARNING })).toBe('Learning');
      expect(cardReadinessLabel({ state: CARD_STATE.REVIEW })).toBe('Review');
      expect(cardReadinessLabel({ state: CARD_STATE.RELEARNING })).toBe('Relearning');
    });
  });

  describe('timeUntilReview', () => {
    const now = Date.now();

    it('due now', () => {
      const card = { nextReviewAt: new Date(now - 1000).toISOString() };
      expect(timeUntilReview(card)).toBe('Due now');
    });

    it('< 1m', () => {
      const card = { nextReviewAt: new Date(now + 30 * 1000).toISOString() };
      expect(timeUntilReview(card)).toBe('< 1m');
    });

    it('minutes', () => {
      const card = { nextReviewAt: new Date(now + 5 * 60 * 1000).toISOString() };
      expect(timeUntilReview(card)).toMatch(/^\d+m$/);
    });

    it('hours', () => {
      const card = { nextReviewAt: new Date(now + 3 * 60 * 60 * 1000).toISOString() };
      expect(timeUntilReview(card)).toMatch(/^\d+h$/);
    });

    it('days', () => {
      const card = { nextReviewAt: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString() };
      expect(timeUntilReview(card)).toMatch(/^\d+d$/);
    });
  });
});
