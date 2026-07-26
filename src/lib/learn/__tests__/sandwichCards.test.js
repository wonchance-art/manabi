import { describe, expect, it } from 'vitest';
import { applyLessonRegistration, buildLessonNotes, ratingFromSignal } from '../sandwichCards.js';
import { CARD_STATE } from '../cardModel.js';

const VOCABS = [
  { word: 'ne… plus', meanings: ['더는 ~않다'] },
  { word: 'la marée', meanings: ['조수', '밀물·썰물'] },
  { word: '무효', meanings: [] },
];

describe('sandwichCards — 샌드위치 자가 체크·단어 등록 배선', () => {
  it('fsrsSignal을 카드 rating으로 매핑한다 (1→Good, 0.5→Hard, -1→Again)', () => {
    expect(ratingFromSignal(1)).toBe(3);
    expect(ratingFromSignal(0.5)).toBe(2);
    expect(ratingFromSignal(-1)).toBe(1);
  });

  it('어휘를 결정적 id의 노트로 변환하고 무효 항목은 거른다', () => {
    const notes = buildLessonNotes('french', 'a2-15-negation-variants', VOCABS);
    expect(notes).toHaveLength(2);
    expect(notes[0].id).toBe('sandwich:french:a2-15-negation-variants:ne… plus');
    expect(notes[1].meaning).toBe('조수, 밀물·썰물');
  });

  it('등록은 FRONT/BACK 카드를 만들고 Good 신호는 FRONT를 LEARNING으로 전이한다', () => {
    const { cards, added, advanced } = applyLessonRegistration([], 'french', 's', VOCABS, { rating: 3 });
    expect(added).toBe(2);
    expect(advanced).toBe(2);
    expect(cards).toHaveLength(4);
    const front = cards.find((c) => c.id.endsWith(':ne… plus_front'));
    expect(front.state).toBe(CARD_STATE.LEARNING);
    expect(front.repetitions).toBe(1);
    const back = cards.find((c) => c.id.endsWith(':ne… plus_back'));
    expect(back.state).toBe(CARD_STATE.NEW);
  });

  it('재실행은 중복 카드를 만들지 않고 상태만 다시 전이한다 (멱등 등록)', () => {
    const first = applyLessonRegistration([], 'french', 's', VOCABS, { rating: 3 });
    const second = applyLessonRegistration(first.cards, 'french', 's', VOCABS, { rating: 3 });
    expect(second.added).toBe(0);
    expect(second.cards).toHaveLength(4);
    const front = second.cards.find((c) => c.id.endsWith(':la marée_front'));
    expect(front.state).toBe(CARD_STATE.REVIEW); // LEARNING + Good → REVIEW
    expect(front.repetitions).toBe(2);
  });

  it('rating 없이(⑤ 담기 버튼) 등록하면 상태 전이 없이 NEW로 쌓인다', () => {
    const { cards, advanced } = applyLessonRegistration([], 'french', 's', VOCABS, {});
    expect(advanced).toBe(0);
    expect(cards.every((c) => c.state === CARD_STATE.NEW)).toBe(true);
  });
});
