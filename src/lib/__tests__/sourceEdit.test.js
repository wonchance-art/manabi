import { describe, expect, it } from 'vitest';
import { buildEditPlan, diffLineMap, remapProcessedJson } from '../sourceEdit.js';

// 계약: ③ 원문 수정 + 증분 재분석 — 이 리맵이 틀리면 분석 파이프라인의 프리픽스
// 재사용(id_{줄}_)이 엉뚱한 줄 토큰을 끌어와 자료가 훼손된다. 파이프라인 쪽 규칙
// (analyzeText: 프리픽스 `id|br|failed_{idx}_` 필터, failed_indices = 재분석 집합)과
// 반드시 동조 — 여기 테스트가 그 동조의 감시자다.

describe('diffLineMap — 줄 단위 LCS', () => {
  it('제자리 수정: 같은 줄번호가 del+ins로 잡혀 changedNew에 들어간다', () => {
    const d = diffLineMap(['가나다', '라마바', '사아자'], ['가나다', '라마바X', '사아자']);
    // pairs는 역추적으로 채워져 삽입 순서가 역순 — 내용만 비교
    expect([...d.pairs.entries()].sort((x, y) => x[0] - y[0])).toEqual([[0, 0], [2, 2]]);
    expect(d.changedNew).toEqual([1]);
    expect(d.removedOld).toEqual([1]);
  });

  it('삽입 시프트: 뒤 줄들이 새 번호로 매핑되고 삽입 줄만 분석 대상', () => {
    const d = diffLineMap(['A', 'B', 'C'], ['A', '신규', 'B', 'C']);
    expect(d.pairs.get(0)).toBe(0);
    expect(d.pairs.get(1)).toBe(2);
    expect(d.pairs.get(2)).toBe(3);
    expect(d.changedNew).toEqual([1]);
  });

  it('삭제 시프트: 사라진 줄은 removedOld, 분석 대상은 없다', () => {
    const d = diffLineMap(['A', 'B', 'C'], ['A', 'C']);
    expect(d.pairs.get(2)).toBe(1);
    expect(d.changedNew).toEqual([]);
    expect(d.removedOld).toEqual([1]);
  });

  it('trim 동등: 공백만 바뀐 줄은 유지 줄이다(분석 입력이 trim이라 재분석 낭비 차단)', () => {
    const d = diffLineMap(['가나다  ', 'B'], ['가나다', 'B']);
    expect(d.pairs.get(0)).toBe(0);
    expect(d.changedNew).toEqual([]);
  });

  it('빈 줄은 changedNew에 들어가지 않는다(분석할 것이 없다 — br은 파이프라인이 만든다)', () => {
    const d = diffLineMap(['A', 'B'], ['A', '', 'B']);
    expect(d.changedNew).toEqual([]);
    expect(d.pairs.get(1)).toBe(2);
  });

  it('중복 줄이 있어도 매핑은 단사(어떤 두 옛 줄도 같은 새 줄로 가지 않는다)', () => {
    const d = diffLineMap(['같다', '같다', 'B'], ['같다', 'B', '같다']);
    const values = [...d.pairs.values()];
    expect(new Set(values).size).toBe(values.length);
  });

  it('규모 가드 — O(m·n) 한도를 넘으면 정직하게 거절', () => {
    const big = Array.from({ length: 2100 }, (_, i) => `줄${i}`);
    expect(diffLineMap(big, big).ok).toBe(false);
  });
});

describe('remapProcessedJson — 토큰 ID 수술', () => {
  const json = {
    sequence: ['id_0_0_111', 'id_0_1_111', 'br_0_111', 'failed_1_111', 'br_1_111', 'id_2_0_111', 'br_2_end_111'],
    dictionary: {
      id_0_0_111: { text: '我', pos: '대명사' },
      id_0_1_111: { text: '去', pos: '동사' },
      br_0_111: { text: '\n', pos: '개행' },
      failed_1_111: { text: '깨진 줄', pos: '미분석', failed: true, original_line_idx: 1 },
      br_1_111: { text: '\n', pos: '개행' },
      id_2_0_111: { text: '好', pos: '형용사' },
      br_2_end_111: { text: '\n', pos: '개행' },
    },
    failed_indices: [1],
    status: 'partial',
  };

  it('유지 줄의 id/br/failed ID가 새 줄번호로 재작성되고 br_end 접미도 보존된다', () => {
    // 0→0 유지, 1→2 이동(사이에 줄 삽입), 2→3 이동
    const pairs = new Map([[0, 0], [1, 2], [2, 3]]);
    const r = remapProcessedJson(json, pairs);
    expect(r.ok).toBe(true);
    expect(r.json.sequence).toEqual([
      'id_0_0_111', 'id_0_1_111', 'br_0_111', 'failed_2_111', 'br_2_111', 'id_3_0_111', 'br_3_end_111',
    ]);
    expect(r.json.dictionary.id_3_0_111).toEqual({ text: '好', pos: '형용사' });
    // failed 토큰은 original_line_idx도 새 줄번호로
    expect(r.json.dictionary.failed_2_111.original_line_idx).toBe(2);
    expect(r.json.failed_indices).toEqual([2]);
  });

  it('매핑에 없는 줄(삭제·수정)의 토큰은 폐기된다 — 그 줄은 재분석되거나 소멸', () => {
    const pairs = new Map([[0, 0], [2, 2]]); // 1번 줄 폐기
    const r = remapProcessedJson(json, pairs);
    expect(r.ok).toBe(true);
    expect(r.json.sequence.some((id) => id.startsWith('failed_'))).toBe(false);
    expect(r.json.failed_indices).toEqual([]);
    expect(Object.keys(r.json.dictionary)).toHaveLength(5);
  });

  it('불변식: 리맵이 ID 충돌을 만들면 거절한다(자료 훼손 방지 가드)', () => {
    // 인위적 충돌: 두 옛 줄을 같은 새 줄로 접는 잘못된 매핑
    const collide = new Map([[0, 0], [2, 0]]);
    const bad = {
      sequence: ['id_0_0_111', 'id_2_0_111'],
      dictionary: { id_0_0_111: { text: 'a' }, id_2_0_111: { text: 'a' } },
      failed_indices: [],
    };
    expect(remapProcessedJson(bad, collide).ok).toBe(false);
  });

  it('패턴 밖 레거시 ID는 그대로 보존한다(유실 방지 — 재사용 필터엔 안 걸림)', () => {
    const weird = { sequence: ['legacy-token'], dictionary: { 'legacy-token': { text: 'x' } }, failed_indices: [] };
    const r = remapProcessedJson(weird, new Map());
    expect(r.ok).toBe(true);
    expect(r.json.sequence).toEqual(['legacy-token']);
  });
});

describe('buildEditPlan — 저장 계획', () => {
  const json = {
    sequence: ['id_0_0_111', 'br_0_111', 'id_1_0_111'],
    dictionary: {
      id_0_0_111: { text: '我去', pos: '동사' },
      br_0_111: { text: '\n', pos: '개행' },
      id_1_0_111: { text: '好', pos: '형용사' },
    },
    failed_indices: [],
    status: 'completed',
  };

  it('무변경(문단 자동분리 후 동일)은 noop', () => {
    expect(buildEditPlan('我去\n好', '我去\n好', json).noop).toBe(true);
  });

  it('한 줄 수정 → 그 줄만 분석 대상, 나머지는 리맵 유지', () => {
    const p = buildEditPlan('我去\n好', '我去了\n好', json);
    expect(p.ok).toBe(true);
    expect(p.selected).toEqual([0]);
    expect(p.analyzeCount).toBe(1);
    expect(p.remapped.sequence).toContain('id_1_0_111'); // 好 줄(1→1) 유지
    expect(p.remapped.sequence).not.toContain('id_0_0_111'); // 수정 줄 토큰 폐기
  });

  it('기존 실패 줄은 편집과 무관하게 분석 대상에 합류한다(리맵된 번호로)', () => {
    const withFailed = {
      ...json,
      sequence: ['id_0_0_111', 'br_0_111', 'failed_1_111'],
      dictionary: { ...json.dictionary, failed_1_111: { text: '깨짐', pos: '미분석', failed: true, original_line_idx: 1 } },
      failed_indices: [1],
    };
    const p = buildEditPlan('我去\n깨짐', '앞에 새 줄\n我去\n깨짐', withFailed);
    expect(p.selected).toEqual([0, 2]); // 새 줄 0 + 실패 줄(1→2)
  });

  it('빈 줄만 삽입(분석할 줄 0)이면 재조립 전용 센티널 [-1] — API 0회로 개행 구조만 재조립', () => {
    const p = buildEditPlan('我去\n好', '我去\n\n好', json);
    expect(p.ok).toBe(true);
    expect(p.analyzeCount).toBe(0);
    expect(p.selected).toEqual([-1]);
  });

  it('분석 전 자료(processed_json 없음)도 계획이 성립한다 — 전 줄이 분석 대상', () => {
    const p = buildEditPlan('我去\n好', '我去\n好呀', null);
    expect(p.ok).toBe(true);
    expect(p.selected).toEqual([1]);
  });
});
