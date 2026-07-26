// 샌드위치 레슨 → 카드 등록·자가 체크 신호 배선 (G1-A 카드 모델 위, DB 스키마 불변)
// 순수 로직(applyLessonRegistration)과 storage 래퍼(registerLessonCards)를 분리해
// 노드 환경 테스트가 가능하게 한다.

import {
  CARD_TYPE,
  deriveCardsFromNote,
  loadCardsFromStorage,
  nextCardState,
  saveCardsToStorage,
} from './cardModel.js';

/** selfCheck fsrsSignal → 카드 rating (1=Again/2=Hard/3=Good) */
export function ratingFromSignal(signal) {
  const map = { 1: 3, 0.5: 2, '-1': 1 };
  return map[String(signal)] ?? 3;
}

/** 레슨 어휘 → 카드 노트(결정적 id — 재클릭·재방문에도 중복 없음) */
export function buildLessonNotes(lang, slug, vocabs) {
  return (vocabs ?? [])
    .filter((v) => v?.word && Array.isArray(v.meanings) && v.meanings.length > 0)
    .map((v) => ({
      id: `sandwich:${lang}:${slug}:${v.word}`,
      word: v.word,
      meaning: v.meanings.join(', '),
      language: lang,
      sourceMaterialId: slug,
    }));
}

/**
 * 카드 배열에 레슨 어휘를 등록하고(신규만), rating이 있으면 FRONT 카드 상태를 전이한다.
 * @returns {{ cards: Array, added: number, advanced: number }}
 */
export function applyLessonRegistration(cards, lang, slug, vocabs, { rating } = {}) {
  const notes = buildLessonNotes(lang, slug, vocabs);
  let next = [...cards];
  const byId = new Map(next.map((c) => [c.id, c]));
  let added = 0;
  let advanced = 0;

  for (const note of notes) {
    for (const derived of deriveCardsFromNote(note)) {
      if (!byId.has(derived.id)) {
        next.push(derived);
        byId.set(derived.id, derived);
        added += 1;
      }
    }
    if (rating) {
      const frontId = `${note.id}_front`;
      const idx = next.findIndex((c) => c.id === frontId);
      if (idx >= 0) {
        const card = next[idx];
        next = [...next];
        next[idx] = {
          ...card,
          state: nextCardState(card.state, rating),
          repetitions: (card.repetitions ?? 0) + 1,
          lastReviewedAt: new Date().toISOString(),
        };
        advanced += 1;
      }
    }
  }
  // FRONT/BACK 각 1장씩 → 노트 수로 환산
  return { cards: next, added: Math.floor(added / CARD_FANOUT), advanced };
}

const CARD_FANOUT = Object.keys(CARD_TYPE).length; // front + back

/** 게스트 localStorage에 등록(브라우저 전용 — 서버에서는 no-op) */
export function registerLessonCards(lang, slug, vocabs, { rating, userId } = {}) {
  if (typeof window === 'undefined') return { added: 0, advanced: 0 };
  const cards = loadCardsFromStorage(userId);
  const result = applyLessonRegistration(cards, lang, slug, vocabs, { rating });
  saveCardsToStorage(result.cards, userId);
  return { added: result.added, advanced: result.advanced };
}
