import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { LEVELS, PROFILE_LEVEL_COLUMN, levelRank, profileLevel } from '../constants';

/**
 * 계약: 추천·통계의 **학습 수준 4언어화** (오너 "다음 할 수 있는 일 ㄱ", 2026-09-01).
 *
 * ── 어떻게 찾았나
 *
 * F R6(난이도 점수)을 착수하려고 「이 점수가 어디 쓰이나」를 먼저 실측했더니, 쓰는 쪽이
 * 이미 고장나 있었다. 추천 카드 필터가 이랬다:
 *
 *     const userLevel = s.language === 'Japanese' ? 일본어수준 : 영어수준;
 *
 * ⇒ **프랑스어 카드가 사용자의 영어 수준으로 걸러진다.** 영어가 C1이면 프랑스어 B1
 * 카드는 diff 2로 조용히 숨는다. F R2가 프랑스어 공급을 연 순간 생긴 실사용 버그다.
 * 컬럼은 이미 4개가 다 있었다(`20260810120000_profile_levels_fr_zh`) — 없던 건 정본이다.
 *
 * 순서표도 같은 병이었다. `LEVEL_ORDER` 지역 복본이 ja/en만 알았고, 모르는 값을 `99`로
 * 두어 diff가 커지며 **거르는 쪽으로** 기울었다(모르면 보여 주는 게 맞다).
 *
 * ⚠ F R6 자체는 **보류**했다. 난이도 신호를 우리 교재로 재 보니 한자비율이 단조증가
 * (N5 0.030 → N1 0.309)로 잘 갈렸지만, **N5의 0.03은 「초보용으로 그렇게 쓴 것」**이지
 * 자연스러운 일본어가 아니다. 그 잣대를 실제 자막에 대면 전부 N2/N1으로 찍힌다.
 * 게다가 egress 차단이라 실자막으로 검증할 방법이 없다 — 검증 못 하는 점수는 안 만든다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const PROFILE = {
  learning_level_japanese: 'N3 중급',
  learning_level_english: 'C1 고급',
  learning_level_french: 'A2 초급',
  learning_level_chinese: 'H2 초급',
};

describe('학습 수준 정본 — 4언어 대칭', () => {
  it('네 언어가 모두 자기 컬럼을 읽는다', () => {
    expect(profileLevel(PROFILE, 'Japanese')).toBe('N3 중급');
    expect(profileLevel(PROFILE, 'English')).toBe('C1 고급');
    expect(profileLevel(PROFILE, 'French')).toBe('A2 초급');
    expect(profileLevel(PROFILE, 'Chinese')).toBe('H2 초급');
  });

  it('프랑스어가 영어 컬럼을 읽지 않는다 — 이게 실제로 났던 버그다', () => {
    // 프랑스어만 설정된 프로필. 옛 구현이면 `learning_level_english`(없음)를 읽어
    // 「수준 미설정」으로 떨어졌고, 영어가 설정돼 있었다면 **엉뚱한 잣대**로 걸렀다.
    expect(profileLevel({ learning_level_french: 'B1 중급' }, 'French')).toBe('B1 중급');
    expect(profileLevel({ learning_level_english: 'C1 고급' }, 'French')).toBe(null);
  });

  it('미설정·미지원은 null — 호출부가 "거르지 않음"으로 다룬다', () => {
    expect(profileLevel({}, 'Japanese')).toBe(null);
    expect(profileLevel(null, 'Japanese')).toBe(null);
    expect(profileLevel(PROFILE, 'Klingon')).toBe(null);
  });

  it('컬럼 이름을 아는 곳이 여기 하나다 — 화면이 컬럼명을 알면 또 갈린다', () => {
    expect(Object.keys(PROFILE_LEVEL_COLUMN).sort()).toEqual(Object.keys(LEVELS).sort());
    for (const f of ['src/views/MaterialsPage.jsx', 'src/views/VocabStats.jsx']) {
      expect(read(f), `${f}: 컬럼명 직접 참조 부활`).not.toContain('learning_level_japanese');
    }
  });
});

describe('레벨 순서는 LEVELS에서 나온다 — 지역 순서표 금지', () => {
  it('순서가 그 언어의 학습 순서다', () => {
    expect(levelRank('Japanese', 'N5 기초')).toBe(0);
    expect(levelRank('Japanese', 'N1 심화')).toBe(LEVELS.Japanese.length - 1);
    expect(levelRank('Chinese', 'OT 입문')).toBe(0);
  });

  it('언어마다 자기 배열을 쓴다 — 프랑스어는 A0 입문이 있어 A2가 한 칸 뒤다', () => {
    // 이게 언어 간 비교를 금지하는 이유다(호출부가 같은 언어일 때만 비교한다).
    expect(levelRank('French', 'A2 초급')).toBe(2);
    expect(levelRank('English', 'A2 초급')).toBe(1);
  });

  it('모르는 값은 null — 큰 숫자로 두면 조용히 걸러진다', () => {
    // 옛 구현은 `?? 99`라, 모르는 레벨이 diff 99가 되어 **카드가 사라졌다**.
    expect(levelRank('Japanese', 'X')).toBe(null);
    expect(levelRank('Klingon', 'N5 기초')).toBe(null);
  });
});

describe('배선 — 추천 필터', () => {
  const filter = () => sliceBetween(
    read('src/views/MaterialsPage.jsx'),
    'function filterSuggestionsByProfile',
    'export default function MaterialsPage',
  );

  it('정본을 쓰고 지역 순서표를 되살리지 않는다', () => {
    const f = filter();
    expect(f).toContain('profileLevel(profile, s.language)');
    expect(f).toContain('levelRank(s.language,');
    expect(read('src/views/MaterialsPage.jsx'), 'LEVEL_ORDER 지역 복본 부활').not.toContain('LEVEL_ORDER');
  });

  it('모르는 값이면 거른다가 아니라 **보여 준다**', () => {
    // 처음엔 `toContain('return true;')`로 뒀는데 블록에 그 줄이 여럿이라, 판정 한 줄만
    // false로 뒤집어도 통과했다(돌연변이 M6 생존). 요구는 「**언어가 맞으면 그 뒤로는
    // 거르지 않는다**」이므로 언어 게이트 뒤에 `return false`가 없음을 본다.
    const f = filter();
    const afterLangGate = sliceBetween(f, 'if (!s.level)', '  });');
    expect(afterLangGate, '판정 불가를 거르는 쪽으로 되돌림').not.toContain('return false');
    expect(f, '99 같은 큰 수로 밀어내는 옛 수법 부활').not.toContain('?? 99');
  });

  it('언어가 다르면 애초에 안 본다 — 순위가 언어별이라 이 게이트가 선행 조건이다', () => {
    expect(filter()).toContain("profile.learning_language?.includes(s.language)");
  });
});

describe('배선 — 자료실의 나머지 2트랙 잔재', () => {
  const page = () => read('src/views/MaterialsPage.jsx');

  it('언어 칩이 정본에서 나온다 — 손으로 적었더니 프랑스어가 빠져 있었다', () => {
    const src = page();
    expect(src).toContain('...Object.keys(LEVELS).map(');
    expect(src, '손으로 적은 칩 목록 부활').not.toMatch(/key: 'Chinese',\s*label: '중국어'/);
  });

  it('레벨 목록이 정본에서 나온다 — 삼항이라 프랑스어를 고르면 전체가 떴다', () => {
    const src = page();
    expect(src).toContain('LEVELS[langFilter]');
    expect(src, '언어별 배열 직접 참조 부활').not.toContain('JP_LEVELS');
  });

  it('전체 목록에 중복이 없다 — 영어·프랑스어가 CEFR 급수를 공유한다', () => {
    // 안 지우면 'B1 중급'이 두 번 뜨고 React key도 겹친다.
    expect(page()).toContain('new Set(Object.values(LEVELS).flat())');
    const all = [...new Set(Object.values(LEVELS).flat())];
    expect(all.length).toBeLessThan(Object.values(LEVELS).flat().length);
  });

  it('레벨 정렬도 자료 자신의 언어로 순위를 낸다', () => {
    // 여기선 모르는 값 99가 **맞다** — 정렬에서는 뒤로 밀릴 뿐이고, 필터에서 같은 99가
    // 틀렸던 이유는 거기선 카드가 사라졌기 때문이다. 같은 상수가 자리에 따라 갈린다.
    const sortBlock = sliceBetween(page(), "if (sortBy === 'level')", 'parseTitle(a.title)');
    expect(sortBlock).toContain('levelRank(meta?.language, meta?.level) ?? 99');
  });
});
