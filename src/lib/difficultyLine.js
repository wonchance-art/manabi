// 공개 자료 카드 난이도 한 줄(발매 점검 M2, 오너 「권장대로」 2026-11-08 KST · 계산 위치는 서버 — 오케스트레이터 결정 같은 날).
// 숫자는 데이터 쪽이 정본 materialDifficulty(#1743)로 미리 센 processed_json.metadata.difficulty다(브라우저는 급수 색인을 싣지 않는다 —
// 색인이 목록 쪽 JS를 수 MB 늘린다). 여기는 문구만 조립한다. 값이 없거나 형식이 다르면 null — 카드에 줄을 그리지 않는다(지금 화면).
//   difficulty = { version: 1, scale: 'HSK' | 'JLPT' | null, medianLevel, p90Level, types, listedShare }
//   HSK 1~7(클수록 어려움) · JLPT 5~1(작을수록 어려움, 5 = N5). 영어는 scale null → 줄 없음.
const LABEL = { HSK: (n) => `HSK ${n}`, JLPT: (n) => `N${n}` };

export function difficultyLine(difficulty) {
  if (!difficulty || difficulty.version !== 1) return null;
  const label = LABEL[difficulty.scale];
  const { medianLevel: median, p90Level: hard, types } = difficulty;
  if (!label || !Number.isInteger(median) || !Number.isInteger(hard) || !Number.isInteger(types) || types <= 0) return null;
  const words = `단어 ${types}개`;
  return median === hard ? `${label(median)} 단어 위주 · ${words}` : `대부분 ${label(median)} · 어려운 말 ${label(hard)}까지 · ${words}`;
}
