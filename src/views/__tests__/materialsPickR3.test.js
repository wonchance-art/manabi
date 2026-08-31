import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';
import { groupReadIdSet } from '../../lib/useGroupReadIds';

/**
 * 계약: v2-F R3 — 공개 자료 고르기 (오너 선택 2026-08-31 "남은 두 조각").
 *
 * 설계 R3의 표제(정렬 「최신」→「나에게 맞는 순」)는 **이미 출하돼 있었다**(#1108
 * 서재 i+1 R2 — `sortByFit`·맞춤도 줄·정렬 4종). 설계가 든 재료 셋 중 남은 것은
 * ⑴ 완독 신호를 고르기에 쓰기 ⑵ 그룹 채택 표시 둘뿐이었고, 셋째(타인 읽힌 횟수)는
 * `reading_progress`가 `.eq('user_id', …)`로 잠겨 있어 DB 작업 없이는 불가하다.
 *
 * 그래서 이 계약이 지키는 것은 그 둘의 **요구**다 — 문구·색·배치가 아니다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const source = () => read('src/views/MaterialsPage.jsx');
// 주석 제거 — "이건 쓰지 않는다"는 설명 자체가 부정 단언에 걸리면 안 된다(실측: 이 계약이
// 제 훅의 JSDoc을 잡았다). 검사 대상은 코드지 설명이 아니다.
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('F R3 — 그룹 같이 읽기 신호', () => {
  it('reads 행 → id 집합: 무그룹·조회 실패·결측 행이 전부 빈 Set/무시', () => {
    // 무해성이 이 부품의 계약이다 — 배지가 안 뜰 뿐 목록은 그대로여야 한다.
    expect(groupReadIdSet(undefined).size).toBe(0);
    expect(groupReadIdSet([]).size).toBe(0);
    expect(groupReadIdSet([{ group_id: 'g1' }]).size).toBe(0);       // material_id 결측
    expect(groupReadIdSet([null, undefined]).size).toBe(0);
  });

  it('reads 행 → id 집합: 여러 그룹이 같은 자료를 지정해도 1건', () => {
    const set = groupReadIdSet([
      { group_id: 'g1', material_id: 'm1' },
      { group_id: 'g2', material_id: 'm1' },
      { group_id: 'g3', material_id: 'm2' },
    ]);
    expect(set.size).toBe(2);
    expect(set.has('m1')).toBe(true);
    expect(set.has('m2')).toBe(true);
  });

  it('목록은 자료 1건당 1조회하는 뷰어용 함수를 쓰지 않는다', () => {
    // fetchGroupsReadingMaterial은 뷰어(자료 1건)용이다. 목록(12+)에 쓰면 N+1이 된다.
    const hook = codeOf(read('src/lib/useGroupReadIds.js'));
    expect(hook, '목록에서 자료별 조회 금지 — 목록형 fetchGroupReads를 쓰라')
      .not.toContain('fetchGroupsReadingMaterial');
    expect(hook).toContain('fetchGroupReads');
  });

  it('홈과 같은 쿼리 키를 써 자료실 진입에 추가 왕복이 없다', () => {
    // 이 재사용이 "조회 0"의 근거다. 키가 갈리면 같은 데이터를 두 번 받는다.
    const hook = read('src/lib/useGroupReadIds.js');
    const entry = read('src/lib/useGroupEntryItem.js');
    for (const key of ["'study-groups'", "'group-reads'"]) {
      expect(hook, `${key} 키가 홈과 갈림`).toContain(key);
      expect(entry, `${key} 키가 홈에서 사라짐`).toContain(key);
    }
  });

  it('배지는 그룹 집합으로만 결정된다 — 무그룹이면 자연히 없다', () => {
    expect(source()).toMatch(/groupReadIds\.has\(m\.id\)/);
  });
});

describe('F R3 — 「안 읽은 것만」', () => {
  it('완독분만 걷어낸다 — 읽는 중은 목록에 남는다', () => {
    // 읽는 중까지 숨기면 "이어서 읽기"가 목록에서 사라진다. 그래서 기준은 완독뿐이다.
    // 계약이 고정하는 건 **요구**지 변수 이름이 아니다 — 이 줄은 v2-N R3에서
    // 「받아둔 것만」이 겹쳐 걸리며 `afterUnread`로 갈라졌다. 그때 이름을 박아 둔
    // 옛 계약이 깨졌고, 그건 구현을 얼린 계약이었다는 뜻이다.
    const filterLine = sliceBetween(source(), 'unreadOnly ? sorted.filter', ';');
    expect(filterLine).toContain('completedIds.has(m.id)');
    expect(filterLine, '읽는 중까지 숨기면 이어읽기가 사라진다').not.toContain('inProgress');
  });

  it('정렬 뒤에 온다 — 좁히기지 정렬 변경이 아니다', () => {
    const src = source();
    expect(src).toContain('const sorted = (() => {');
    // 정렬 결과를 입력으로 받는다(정렬 로직 안에서 거르지 않는다).
    // 좌변 이름은 요구가 아니다 — 고정할 것은 "sorted를 입력으로 받는다"뿐이다.
    expect(src).toMatch(/=\s*unreadOnly \? sorted\.filter/);
  });

  it('게스트에겐 칩이 없다 — 진도가 없어 항상 빈 결과가 되기 때문', () => {
    const chip = sliceBetween(source(), '안 읽은 것만', '</button>');
    expect(source()).toMatch(/\{user && \([\s\S]{0,400}안 읽은 것만/);
    expect(chip).toBeTruthy();
  });

  it('추가 조회를 만들지 않는다 — 이미 로드된 완독 인덱스를 쓴다', () => {
    // completedIds는 progressMap에서 이미 온다. 새 쿼리를 붙이면 이 라운드의 전제가 깨진다.
    const src = source();
    expect(src).toContain('const completedIds = progressMap.completed;');
    expect(src.split("from('reading_progress')").length - 1, 'reading_progress 조회는 1곳뿐이어야 한다').toBe(1);
  });
});
