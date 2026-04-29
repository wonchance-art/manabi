/**
 * 사용자 단어 수로 추천 레벨 역산
 * JLPT: N5(<800) N4(<1500) N3(<3750) N2(<6000) N1(<10000)
 * CEFR: A1(<500) A2(<1000) B1(<2000) B2(<4000) C1(<7000) C2(<10000)
 */
export const JP_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const JP_THRESHOLDS = [0, 800, 1500, 3750, 6000, 10000];
export const EN_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const EN_THRESHOLDS = [0, 500, 1000, 2000, 4000, 7000, 10000];

export function getIdealLevel(lang, count) {
  const thresholds = lang === 'Japanese' ? JP_THRESHOLDS : EN_THRESHOLDS;
  const labels = lang === 'Japanese' ? JP_LEVELS : EN_LEVELS;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (count >= thresholds[i]) return labels[Math.min(i, labels.length - 1)];
  }
  return labels[0];
}
