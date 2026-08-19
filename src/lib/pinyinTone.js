// 병음 음절 → 성조 번호(1~4, 경성 0) — 성조 색상 표시용(오너 확정 2026-08-19: 병음에만).
// 성조는 이미 갖고 있는 병음의 발음 부호에서 파생한다 — DB·분석 파이프라인 무변경.
const TONE_MARKS = [
  /[āēīōūǖĀĒĪŌŪǕ]/, // 1성
  /[áéíóúǘÁÉÍÓÚǗ]/, // 2성
  /[ǎěǐǒǔǚǍĚǏǑǓǙ]/, // 3성
  /[àèìòùǜÀÈÌÒÙǛ]/, // 4성
];

export function pinyinToneNumber(syllable) {
  const s = String(syllable || '');
  if (!s) return null;
  for (let tone = 0; tone < TONE_MARKS.length; tone++) {
    if (TONE_MARKS[tone].test(s)) return tone + 1;
  }
  // 부호 없는 라틴 음절 = 경성(轻声). 라틴이 아예 없으면 병음이 아니다.
  return /[a-zA-Zü]/.test(s) ? 0 : null;
}

/** rt에 붙일 색상 클래스 — 병음이 아니면 undefined(클래스 무부착) */
export function pinyinToneClass(syllable) {
  const tone = pinyinToneNumber(syllable);
  return tone === null ? undefined : `pinyin-tone--${tone}`;
}
