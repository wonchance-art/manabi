'use client';
// 복습실 듣기 카드 답 면의 레벨 예문(CARD-TYPES-001 — 오너 승인 2026-11-01 KST). 단어 페이지 답 면과 같은 부품(Example — 후리가나 · 해석)과
// 같은 CSS(level-word.css)를 쓴다 — 따로 그리지 않는다. 듣기 카드(원문 문장 없음)를 만났을 때만 동적 import로 받는다(listenExample.js).
// 예문 단어 창은 복습실에 없어 단어 조각은 누르지 않는다(onWord 없음) · 다시 듣기는 위 소리 단추가 진다(단어 페이지 답 면과 같이 speak 없음).
import { Example } from '@/components/levels/word/WordCard';
import { WordLangContext } from '@/components/levels/word/wordLang';
import '@/components/levels/word/level-word.css';

export { levelExampleOf } from '@/lib/levelExampleLookup';

/** 단어 페이지 판의 글자 lang(표제어 hw · 예문 읽기 exReading) — 판 정본(JlptWordPage · LevelWordPage · LatinWordPage)과 같은 값(계약). */
export const ROOM_EXAMPLE_LANG = Object.freeze({
  Japanese: Object.freeze({ hw: 'ja', exReading: 'ja' }),
  Chinese: Object.freeze({ hw: 'zh-CN', exReading: undefined }),
  English: Object.freeze({ hw: 'en', exReading: 'en' }),
  French: Object.freeze({ hw: 'fr', exReading: 'fr' }),
});

export default function RoomLevelExample({ ex, word }) {
  const L = ROOM_EXAMPLE_LANG[word.language];
  if (!L || !ex?.text) return null;
  return <WordLangContext.Provider value={L}>
    <div className="lw-ex--answer review-card__level-ex" data-language={L.hw}>
      <Example ex={ex} word={word.word_text} speak={null} onWord={null} tone />
    </div>
  </WordLangContext.Provider>;
}
