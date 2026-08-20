// ① 카드 확대 단어(오너 승인 2026-08-19) — 폭맞춤 크기의 분모.
// CJK 본문 글자는 병음 격자 계약으로 정확히 1em이라, 카드 글꼴 크기는
// `100cqi ÷ fitDivisor` 수식으로 폭을 꽉 채운다(측정 JS 없음 — index.css .word-fit).
// 라틴 자료는 글자 폭이 1em이 아니라 폭맞춤 대상이 아니다(isFitLang).

/** 폭맞춤을 적용하는 자료 언어 — 전각 1em 격자가 성립하는 CJK만. */
export function isFitLang(language) {
  return language === 'Chinese' || language === 'Japanese';
}

/**
 * 크기 분모 — 기본은 글자 수(폭 = 글자수 × 1em).
 * 일본어는 요미가나(0.5em/자)가 본문보다 넓을 수 있어(志 1자 : こころざし 5자),
 * 요미 폭(글자수 ÷ 2)이 더 크면 그쪽을 분모로 — 요미가 패널을 넘어 가로
 * 스크롤을 만드는 것을 크기 쪽에서 막는다. 병음은 0.26em 단일 크기 계약으로
 * 셀(1em)을 절대 넘지 않으므로 보정이 필요 없다.
 */
export function fitDivisor(text, furigana, language) {
  const n = [...String(text || '')].length;
  if (n === 0) return 1;
  if (language === 'Japanese' && furigana) {
    const yomiHalf = [...String(furigana)].length / 2;
    return Math.max(n, yomiHalf);
  }
  return n;
}
