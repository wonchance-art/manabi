import { detectLangConfident } from './constants.js';

// 복습 범위의 언어 판정 한 줄 — 단어의 language, 없으면 글자로 확실히 가려지는 언어(BUNDLE-AUTH-001).
// 학습 타일(LearnTiles — 배움 · 내 정보 · 현황)이 이것 하나 때문에 복습 범위 모듈 전체(reviewScope · 큐 · 카드 종류)를 끌어오지 않게 따로 둔다.
// reviewScope.js가 같은 이름으로 다시 내보낸다(기존 import 경로 그대로).
export function wordScopeLanguage(word) {
  return word?.language || detectLangConfident(word?.word_text) || null;
}
