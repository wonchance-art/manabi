// 서버 전용 — 중국어 얼화(儿化) 병음 (ZH-ERHUA 안 A — 오너 「권장대로. ㄱㄱ」 2026-11-11 KST).
//
// 저장 꼴: 글자당 한 음절은 그대로, **儿 자리의 읽기만 「r」** — 哪儿 「nǎ r」 · 这儿 「zhè r」 · 一点儿 「yì diǎn r」.
//   「음절 수 = 글자 수」 불변식(takeSyllables · splitZhToken · boundaryEdits zhPieceReading · 뷰어 한자 패널)이 그대로 성립한다.
//   표시(목록 · 복습 카드)에서 「nǎ r」 → 「nǎr」로 붙여 쓰는 것은 화면 쪽 규칙이다(Design).
// 대상: CC-CEDICT가 儿 자리를 r5로만 적는 낱말(src/lib/server/data/zhErhua.json — scripts/build-zh-pinyin-check.mjs 생성).
//   실음절 ér(女儿 · 儿子 · 儿童 · 婴儿 · 孤儿)과 두 독음이 다 있는 낱말(花儿 · 小儿 · 托儿 · 干儿 · 猴儿)은 목록 밖 — 손대지 않는다.
//   앞 음절(一点儿의 一 변조 yì 등)은 그대로 둔다 — 儿 자리만 바꾼다.

import ZH_ERHUA from './data/zhErhua.json';

const ERHUA = new Set(ZH_ERHUA.words);

/** 이 낱말이 얼화 낱말인가(목록 기준). */
export function isZhErhuaWord(word) {
  return ERHUA.has(word);
}

/**
 * 얼화 낱말이면 儿 자리 음절을 「r」로 바꾼 새 배열, 아니면 받은 배열 그대로.
 * 음절 수 ≠ 글자 수면 추측하지 않고 그대로 돌려준다.
 * @param {string} word
 * @param {string[]|null|undefined} syllables
 */
export function applyZhErhua(word, syllables) {
  if (!syllables || !ERHUA.has(word)) return syllables;
  const n = [...word].length;
  if (syllables.length !== n || syllables[n - 1] === 'r') return syllables;
  return [...syllables.slice(0, n - 1), 'r'];
}
