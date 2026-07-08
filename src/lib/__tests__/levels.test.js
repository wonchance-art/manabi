import { describe, it, expect } from 'vitest';
import {
  getIdealLevel,
  JP_LEVELS, JP_THRESHOLDS,
  EN_LEVELS, EN_THRESHOLDS,
  FR_LEVELS, FR_THRESHOLDS,
  ZH_LEVELS, ZH_THRESHOLDS,
} from '../levels';
import { FR_LEVELS as FR_LEVELS_KO } from '../constants';

describe('getIdealLevel — Japanese (회귀)', () => {
  it('경계값들이 기존 스케일 그대로 유지된다', () => {
    expect(getIdealLevel('Japanese', 0)).toBe('N5');
    expect(getIdealLevel('Japanese', 799)).toBe('N5');
    expect(getIdealLevel('Japanese', 800)).toBe('N4');
    expect(getIdealLevel('Japanese', 6000)).toBe('N1');
    expect(getIdealLevel('Japanese', 999999)).toBe('N1');
  });
});

describe('getIdealLevel — English (회귀 + 폴백)', () => {
  it('경계값 유지', () => {
    expect(getIdealLevel('English', 0)).toBe('A1');
    expect(getIdealLevel('English', 499)).toBe('A1');
    expect(getIdealLevel('English', 500)).toBe('A2');
    expect(getIdealLevel('English', 7000)).toBe('C2');
  });

  it('알 수 없는 언어는 영어 임계로 폴백한다 (기존 동작 유지)', () => {
    expect(getIdealLevel('Klingon', 0)).toBe('A1');
    expect(getIdealLevel(undefined, 0)).toBe('A1');
  });
});

describe('getIdealLevel — French', () => {
  it('A0 포함 경계값', () => {
    expect(getIdealLevel('French', 0)).toBe('A0');
    expect(getIdealLevel('French', 199)).toBe('A0');
    expect(getIdealLevel('French', 200)).toBe('A1');
    expect(getIdealLevel('French', 7000)).toBe('C2');
  });
});

describe('FR_LEVELS 단일 출처', () => {
  it('levels.js의 FR_LEVELS는 constants.js FR_LEVELS(사용자 표시 라벨)에서 파생된 short code다', () => {
    expect(FR_LEVELS).toEqual(FR_LEVELS_KO.map(l => l.split(' ')[0]));
    expect(FR_LEVELS).toEqual(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });
});

describe('getIdealLevel — Chinese (신규, HSK 3.0 누적 표준 어휘량 기준)', () => {
  it('ZH_LEVELS/ZH_THRESHOLDS가 콘텐츠 레지스트리 키(OT/H1~H6)와 일치한다', () => {
    expect(ZH_LEVELS).toEqual(['OT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    expect(ZH_THRESHOLDS).toEqual([0, 200, 500, 1272, 2245, 3245, 4316, 5456]);
  });

  it('0 단어 → OT', () => {
    expect(getIdealLevel('Chinese', 0)).toBe('OT');
  });

  it('OT/H1 경계 (200)', () => {
    expect(getIdealLevel('Chinese', 199)).toBe('OT');
    expect(getIdealLevel('Chinese', 200)).toBe('H1');
  });

  it('H1/H2 경계 (HSK1 누적 500단어)', () => {
    expect(getIdealLevel('Chinese', 499)).toBe('H1');
    expect(getIdealLevel('Chinese', 500)).toBe('H2');
  });

  it('H2/H3 경계 (HSK2 누적 1272단어)', () => {
    expect(getIdealLevel('Chinese', 1271)).toBe('H2');
    expect(getIdealLevel('Chinese', 1272)).toBe('H3');
  });

  it('H3/H4 경계 (HSK3 누적 2245단어)', () => {
    expect(getIdealLevel('Chinese', 2244)).toBe('H3');
    expect(getIdealLevel('Chinese', 2245)).toBe('H4');
  });

  it('H4/H5 경계 (HSK4 누적 3245단어)', () => {
    expect(getIdealLevel('Chinese', 3244)).toBe('H4');
    expect(getIdealLevel('Chinese', 3245)).toBe('H5');
  });

  it('H5/H6 경계 (HSK5 누적 4316단어)', () => {
    expect(getIdealLevel('Chinese', 4315)).toBe('H5');
    expect(getIdealLevel('Chinese', 4316)).toBe('H6');
  });

  it('HSK6 누적치(5456) 이상도 H6에 머문다 (JP/EN/FR과 동일하게 최상위 레벨엔 상한이 없음)', () => {
    expect(getIdealLevel('Chinese', 5456)).toBe('H6');
    expect(getIdealLevel('Chinese', 999999)).toBe('H6');
  });

  it('더 이상 영어 임계로 폴백하지 않는다 (기존 버그 회귀 방지)', () => {
    // 수정 전에는 getIdealLevel('Chinese', 300)이 EN_THRESHOLDS로 폴백해 'A1'을 반환했다.
    expect(getIdealLevel('Chinese', 300)).not.toBe('A1');
    expect(getIdealLevel('Chinese', 300)).toBe('H1');
  });
});
