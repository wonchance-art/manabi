import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CardType, CardState, ReviewAction,
  createCard, deriveCardsFromNote, legacyVocabToCard, legacyVocabToCardPair,
  transitionState, isCardDue, filterDueCards, sortCardsByDue, sortCardsByState,
  serializeCard, deserializeCard, loadCardsFromStorage, saveCardsToStorage, loadCardIndex,
  CARD_TYPES, CARD_STATES, DEFAULT_CARD_TYPES, REVIEW_ACTIONS, STORAGE_KEYS,
} from '../cardModel';

describe('cardModel', () => {
  describe('createCard', () => {
    it('should create a new card with default state', () => {
      const card = createCard('note-123', CardType.FRONT);
      expect(card.id).toBe('note-123-front');
      expect(card.noteId).toBe('note-123');
      expect(card.cardType).toBe(CardType.FRONT);
      expect(card.state).toBe(CardState.NEW);
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.easeFactor).toBe(2.5);
      expect(card.createdAt).toBeDefined();
      expect(card.lastReviewedAt).toBeNull();
    });

    it('should accept source_ref option', () => {
      const card = createCard('note-123', CardType.BACK, {
        sourceRef: '中国語 · H3',
      });
      expect(card.sourceRef).toBe('中国語 · H3');
    });

    it('should throw on invalid cardType', () => {
      expect(() => createCard('note-123', 'invalid')).toThrow();
    });
  });

  describe('deriveCardsFromNote', () => {
    it('should derive default 2 cards (FRONT + BACK) from note', () => {
      const note = {
        id: 'word-abc',
        word_text: 'apple',
        meaning: 'りんご',
        source_ref: '日本語 · A1',
      };

      const cards = deriveCardsFromNote(note);
      expect(cards).toHaveLength(2);
      expect(cards[0].cardType).toBe(CardType.FRONT);
      expect(cards[1].cardType).toBe(CardType.BACK);
      expect(cards[0].sourceRef).toBe('日本語 · A1');
      expect(cards[1].sourceRef).toBe('日本語 · A1');
    });

    it('should respect custom cardTypes parameter', () => {
      const note = { id: 'word-xyz', word_text: 'test', meaning: 'テスト' };
      const cards = deriveCardsFromNote(note, [CardType.FRONT]);
      expect(cards).toHaveLength(1);
      expect(cards[0].cardType).toBe(CardType.FRONT);
    });

    it('should throw if note has no id', () => {
      expect(() => deriveCardsFromNote({ word_text: 'test' })).toThrow();
    });
  });

  describe('transitionState', () => {
    it('should transition NEW → LEARNING on GOOD', () => {
      const next = transitionState(CardState.NEW, ReviewAction.GOOD);
      expect(next).toBe(CardState.LEARNING);
    });

    it('should transition NEW → REVIEW on EASY (skip learning)', () => {
      const next = transitionState(CardState.NEW, ReviewAction.EASY);
      expect(next).toBe(CardState.REVIEW);
    });

    it('should stay NEW on AGAIN', () => {
      const next = transitionState(CardState.NEW, ReviewAction.AGAIN);
      expect(next).toBe(CardState.NEW);
    });

    it('should transition LEARNING → REVIEW on GOOD (graduate)', () => {
      const next = transitionState(CardState.LEARNING, ReviewAction.GOOD);
      expect(next).toBe(CardState.REVIEW);
    });

    it('should stay LEARNING on HARD', () => {
      const next = transitionState(CardState.LEARNING, ReviewAction.HARD);
      expect(next).toBe(CardState.LEARNING);
    });

    it('should transition REVIEW → RELEARNING on AGAIN (demote)', () => {
      const next = transitionState(CardState.REVIEW, ReviewAction.AGAIN);
      expect(next).toBe(CardState.RELEARNING);
    });

    it('should stay REVIEW on GOOD/HARD/EASY', () => {
      expect(transitionState(CardState.REVIEW, ReviewAction.GOOD)).toBe(CardState.REVIEW);
      expect(transitionState(CardState.REVIEW, ReviewAction.HARD)).toBe(CardState.REVIEW);
      expect(transitionState(CardState.REVIEW, ReviewAction.EASY)).toBe(CardState.REVIEW);
    });

    it('should transition RELEARNING → REVIEW on GOOD (graduate)', () => {
      const next = transitionState(CardState.RELEARNING, ReviewAction.GOOD);
      expect(next).toBe(CardState.REVIEW);
    });

    it('should throw on invalid state', () => {
      expect(() => transitionState('invalid', ReviewAction.GOOD)).toThrow();
    });

    it('should throw on invalid action', () => {
      expect(() => transitionState(CardState.NEW, 'invalid')).toThrow();
    });
  });

  describe('isCardDue', () => {
    it('should return true if dueAt is in past', () => {
      const card = createCard('note-123', CardType.FRONT);
      card.dueAt = new Date(Date.now() - 1000);
      expect(isCardDue(card)).toBe(true);
    });

    it('should return false if dueAt is in future', () => {
      const card = createCard('note-123', CardType.FRONT);
      card.dueAt = new Date(Date.now() + 1000);
      expect(isCardDue(card)).toBe(false);
    });

    it('should accept custom now parameter', () => {
      const card = createCard('note-123', CardType.FRONT);
      card.dueAt = new Date('2026-01-01');
      const now = new Date('2026-01-02');
      expect(isCardDue(card, now)).toBe(true);
    });
  });

  describe('filterDueCards', () => {
    it('should return only due cards', () => {
      const card1 = createCard('note-1', CardType.FRONT);
      card1.dueAt = new Date(Date.now() - 1000);

      const card2 = createCard('note-2', CardType.FRONT);
      card2.dueAt = new Date(Date.now() + 1000);

      const now = new Date();
      const due = filterDueCards([card1, card2], now);
      expect(due).toHaveLength(1);
      expect(due[0].noteId).toBe('note-1');
    });

    it('should return empty array if no cards are due', () => {
      const card = createCard('note-1', CardType.FRONT);
      card.dueAt = new Date(Date.now() + 1000);
      expect(filterDueCards([card])).toHaveLength(0);
    });
  });

  describe('sortCardsByDue', () => {
    it('should sort by dueAt ascending (old first)', () => {
      const card1 = createCard('note-1', CardType.FRONT);
      card1.dueAt = new Date('2026-01-03');

      const card2 = createCard('note-2', CardType.FRONT);
      card2.dueAt = new Date('2026-01-01');

      const card3 = createCard('note-3', CardType.FRONT);
      card3.dueAt = new Date('2026-01-02');

      const sorted = sortCardsByDue([card1, card2, card3]);
      expect(sorted[0].noteId).toBe('note-2');
      expect(sorted[1].noteId).toBe('note-3');
      expect(sorted[2].noteId).toBe('note-1');
    });

    it('should not mutate original array', () => {
      const card1 = createCard('note-1', CardType.FRONT);
      const card2 = createCard('note-2', CardType.FRONT);
      const original = [card1, card2];
      const sorted = sortCardsByDue(original);
      expect(original).toBe(original); // original unchanged
      expect(sorted).not.toBe(original);
    });
  });

  describe('sortCardsByState', () => {
    it('should sort by state (NEW → LEARNING → REVIEW → RELEARNING)', () => {
      const card1 = createCard('note-1', CardType.FRONT);
      card1.state = CardState.REVIEW;

      const card2 = createCard('note-2', CardType.FRONT);
      card2.state = CardState.LEARNING;

      const card3 = createCard('note-3', CardType.FRONT);
      card3.state = CardState.NEW;

      const card4 = createCard('note-4', CardType.FRONT);
      card4.state = CardState.RELEARNING;

      const sorted = sortCardsByState([card1, card2, card3, card4]);
      expect(sorted[0].state).toBe(CardState.NEW);
      expect(sorted[1].state).toBe(CardState.LEARNING);
      expect(sorted[2].state).toBe(CardState.REVIEW);
      expect(sorted[3].state).toBe(CardState.RELEARNING);
    });
  });

  describe('legacyVocabToCard', () => {
    it('should convert existing vocab row to FRONT card', () => {
      const vocabRow = {
        id: 'vocab-123',
        word_text: 'apple',
        meaning: 'りんご',
        last_reviewed_at: '2026-01-15T10:00:00Z',
        repetitions: 5,
        interval: 30,
        ease_factor: 2.3,
        source_ref: '日本語 · A1',
      };

      const card = legacyVocabToCard(vocabRow);
      expect(card.id).toBe('vocab-123-front');
      expect(card.cardType).toBe(CardType.FRONT);
      expect(card.state).toBe(CardState.REVIEW); // has last_reviewed_at
      expect(card.reps).toBe(5);
      expect(card.interval).toBe(30);
      expect(card.easeFactor).toBe(2.3);
      expect(card.lapses).toBe(0); // not in old schema
      expect(card.sourceRef).toBe('日本語 · A1');
    });

    it('should set state to NEW if no last_reviewed_at', () => {
      const vocabRow = {
        id: 'vocab-456',
        word_text: 'test',
        meaning: 'テスト',
      };

      const card = legacyVocabToCard(vocabRow);
      expect(card.state).toBe(CardState.NEW);
      expect(card.lastReviewedAt).toBeNull();
    });

    it('should use default ease_factor if not provided', () => {
      const vocabRow = { id: 'vocab-789', word_text: 'new' };
      const card = legacyVocabToCard(vocabRow);
      expect(card.easeFactor).toBe(2.5);
    });

    it('should throw if vocabRow has no id', () => {
      expect(() => legacyVocabToCard({ word_text: 'test' })).toThrow();
    });
  });

  describe('legacyVocabToCardPair', () => {
    it('should create FRONT + BACK card pair', () => {
      const vocabRow = {
        id: 'vocab-abc',
        word_text: 'hello',
        meaning: 'こんにちは',
        last_reviewed_at: '2026-01-20T15:30:00Z',
        repetitions: 3,
        interval: 15,
        ease_factor: 2.4,
      };

      const { forward, reverse } = legacyVocabToCardPair(vocabRow);

      expect(forward.cardType).toBe(CardType.FRONT);
      expect(forward.reps).toBe(3);
      expect(forward.state).toBe(CardState.REVIEW);

      expect(reverse.cardType).toBe(CardType.BACK);
      expect(reverse.state).toBe(CardState.NEW); // starts new
      expect(reverse.reps).toBe(0);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize card', () => {
      const card = createCard('note-xyz', CardType.BACK);
      card.state = CardState.LEARNING;
      card.reps = 2;
      card.lastReviewedAt = new Date('2026-01-15T12:00:00Z');

      const serialized = serializeCard(card);
      expect(typeof serialized.dueAt).toBe('string');
      expect(typeof serialized.createdAt).toBe('string');
      expect(typeof serialized.lastReviewedAt).toBe('string');

      const deserialized = deserializeCard(serialized);
      expect(deserialized.dueAt).toEqual(card.dueAt);
      expect(deserialized.createdAt).toEqual(card.createdAt);
      expect(deserialized.lastReviewedAt).toEqual(card.lastReviewedAt);
      expect(deserialized.state).toBe(CardState.LEARNING);
    });

    it('should handle null lastReviewedAt on deserialize', () => {
      const serialized = {
        id: 'test-front',
        noteId: 'test',
        cardType: CardType.FRONT,
        dueAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        lastReviewedAt: null,
        state: CardState.NEW,
      };

      const deserialized = deserializeCard(serialized);
      expect(deserialized.lastReviewedAt).toBeNull();
    });
  });

  describe('localStorage storage', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear?.();
      }
    });

    it('should save and load cards from storage', () => {
      const card1 = createCard('note-1', CardType.FRONT);
      card1.state = CardState.LEARNING;

      const card2 = createCard('note-1', CardType.BACK);
      card2.state = CardState.NEW;

      if (typeof window !== 'undefined') {
        saveCardsToStorage('note-1', [card1, card2]);
        const loaded = loadCardsFromStorage('note-1');

        expect(loaded).toHaveLength(2);
        expect(loaded[0].cardType).toBe(CardType.FRONT);
        expect(loaded[0].state).toBe(CardState.LEARNING);
        expect(loaded[1].cardType).toBe(CardType.BACK);
      }
    });

    it('should return null if cards not in storage', () => {
      if (typeof window !== 'undefined') {
        const loaded = loadCardsFromStorage('nonexistent-note');
        expect(loaded).toBeNull();
      }
    });

    it('should update card index on save', () => {
      if (typeof window !== 'undefined') {
        const card = createCard('note-new', CardType.FRONT);
        saveCardsToStorage('note-new', [card]);

        const index = loadCardIndex();
        expect(index).toContain('note-new');
      }
    });
  });

  describe('constants', () => {
    it('should have correct CardType values', () => {
      expect(CardType.FRONT).toBe('front');
      expect(CardType.BACK).toBe('back');
    });

    it('should have correct CardState values', () => {
      expect(CardState.NEW).toBe('new');
      expect(CardState.LEARNING).toBe('learning');
      expect(CardState.REVIEW).toBe('review');
      expect(CardState.RELEARNING).toBe('relearning');
    });

    it('should have correct ReviewAction values', () => {
      expect(ReviewAction.AGAIN).toBe('again');
      expect(ReviewAction.HARD).toBe('hard');
      expect(ReviewAction.GOOD).toBe('good');
      expect(ReviewAction.EASY).toBe('easy');
    });

    it('CARD_TYPES should contain all card types', () => {
      expect(CARD_TYPES).toContain(CardType.FRONT);
      expect(CARD_TYPES).toContain(CardType.BACK);
    });

    it('CARD_STATES should contain all states', () => {
      expect(CARD_STATES).toContain(CardState.NEW);
      expect(CARD_STATES).toContain(CardState.LEARNING);
      expect(CARD_STATES).toContain(CardState.REVIEW);
      expect(CARD_STATES).toContain(CardState.RELEARNING);
    });

    it('DEFAULT_CARD_TYPES should be FRONT and BACK', () => {
      expect(DEFAULT_CARD_TYPES).toEqual([CardType.FRONT, CardType.BACK]);
    });
  });
});
