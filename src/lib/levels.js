/**
 * 사용자 단어 수로 추천 레벨 역산
 * JLPT: N5(<800) N4(<1500) N3(<3750) N2(<6000) N1(<10000)
 * CEFR: A1(<500) A2(<1000) B1(<2000) B2(<4000) C1(<7000) C2(<10000)
 * HSK 3.0(급별 누적 표준 어휘량): OT(<200) H1(<500) H2(<1272) H3(<2245) H4(<3245) H5(<4316) H6(<5456, 이후 지속)
 */
import { FR_LEVELS as FR_LEVELS_KO } from './constants';

export const JP_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
export const JP_THRESHOLDS = [0, 800, 1500, 3750, 6000, 10000];
export const EN_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const EN_THRESHOLDS = [0, 500, 1000, 2000, 4000, 7000, 10000];
// 프랑스어는 A0(입문 상식) 단계 포함 — A0(<200) A1(<500) A2(<1000) B1(<2000) B2(<4000) C1(<7000) C2(<10000)
// 단일 출처: 사용자에게 보이는 라벨(constants.js FR_LEVELS = 'A0 입문' 등)에서 콘텐츠 키(short code)만 파생.
// FR_LEVELS와 constants.js가 서로 다른 배열을 따로 유지하며 어긋나는 일이 없도록 여기서는 재정의하지 않는다.
export const FR_LEVELS = FR_LEVELS_KO.map(l => l.split(' ')[0]);
export const FR_THRESHOLDS = [0, 200, 500, 1000, 2000, 4000, 7000, 10000];
// 중국어(HSK)는 OT(오리엔테이션) 단계 포함 — 콘텐츠 레지스트리(src/content/chinese/index.js ZH_LEVEL_META)의
// key/short와 동일한 OT/H1~H6. 임계는 HSK 3.0 급별 누적 표준 어휘량(H1 500·H2 1272·H3 2245·H4 3245·H5 4316·H6 5456)을
// 그대로 채택 — OT→H1 진입점(<200)만 프랑스어 A0→A1과 같은 방식(본 학습 전 예열 단계 상한)으로 설정.
export const ZH_LEVELS = ['OT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
export const ZH_THRESHOLDS = [0, 200, 500, 1272, 2245, 3245, 4316, 5456];

const LEVEL_TABLES = {
  Japanese: { levels: JP_LEVELS, thresholds: JP_THRESHOLDS },
  French:   { levels: FR_LEVELS, thresholds: FR_THRESHOLDS },
  Chinese:  { levels: ZH_LEVELS, thresholds: ZH_THRESHOLDS },
  English:  { levels: EN_LEVELS, thresholds: EN_THRESHOLDS },
};

export function getIdealLevel(lang, count) {
  const { levels: labels, thresholds } = LEVEL_TABLES[lang] || LEVEL_TABLES.English;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (count >= thresholds[i]) return labels[Math.min(i, labels.length - 1)];
  }
  return labels[0];
}
