// 가나로 쓴 낱말의 한자 표기(JA-KANJI-A-MOCK-001 ③-b, 오너 「권장대로」 2026-11-11 KST).
// 본문이 가나(がっこう)인데 기본형이 한자(学校)이면 카드 표제어는 이미 学校다. 그 가나가 **그 한자의 읽기**일 때만
// 칩을 「기본형」 대신 「한자 표기」로 하고 표제어 위에 그 가나를 읽기로 얹는다 — 같은 낱말을 다른 글자로 쓴 것임을 알린다.
// 활용형(行き → 行く · あるい → 歩く)은 지금처럼 「기본형」이다. 한자로 쓴 토큰(学校)은 해당하지 않는다.

const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/u;
const HAN = /\p{Script=Han}/u;
const TAIL_KANA = /[ぁ-ゖ]+$/u;

/** 가타카나 → 히라가나(장음 ー는 그대로). 읽기 비교용. */
export function toHiragana(value) {
  return String(value || '').replace(/[ァ-ヶ]/gu, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * @param {string} text 본문 표면(탭한 토큰)
 * @param {string} baseForm 카드 표제어(기본형)
 * @param {string|null} [dictReading] 사전 행 읽기(로그인 · 조회 뒤). 있으면 이것과 같아야 한다.
 * @returns {string|null} 표제어 읽기로 쓸 가나(= 본문 표면) — 해당하지 않으면 null
 */
export function kanaSpellingReading(text, baseForm, dictReading = null) {
  if (!text || !baseForm || text === baseForm || !KANA_ONLY.test(text) || !HAN.test(baseForm)) return null;
  const surface = toHiragana(text);
  if (dictReading) return toHiragana(dictReading) === surface ? text : null;
  // 사전 읽기가 없으면(손님 · 사전 행 없음) 기본형 끝 가나(送り仮名)가 표면 끝과 같아야 한다 — あるい ↔ 歩く는 아니다.
  const tail = baseForm.match(TAIL_KANA)?.[0] || '';
  if (tail && (!surface.endsWith(tail) || surface.length <= tail.length)) return null;
  return text;
}
