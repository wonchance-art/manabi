import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 계약(TAP-INP-SCHED-001): 복습 화면에 넘기는 「범위 안 표현의 학습 상태」는 렌더마다 다시 거르지 않는다.
 * 예전에는 채점 · 정답 확인마다 projections × vocab 겹 순회(표현 412개 = 17만 번)가 탭 처리 안에서 돌았다(390 CPU×4 약 25ms).
 * 결과(순서 = projections 순서, 범위 안 표현만)는 같고, 계산은 projections · vocab이 바뀔 때만 한 번이다.
 */
const src = fs.readFileSync(path.join(process.cwd(), 'src/views/VocabPage.jsx'), 'utf8');

describe('복습 화면 학습 상태 거르기(TAP-INP-SCHED-001)', () => {
  it('id 묶음으로 한 번 거르는 메모 — 렌더 안 겹 순회가 없다', () => {
    expect(src).toContain('const scopedProjections = useMemo(() => { const ids = new Set(vocab.map(word => word.id)); return projections.filter(row => ids.has(row.vocabulary.id)); }, [projections, vocab]);');
    expect(src).toContain('projections={scopedProjections}');
    expect(src).not.toContain('projections.filter(row => vocab.some(');
  });

  it('같은 결과 — 예전 식과 새 식이 순서까지 같다(중복 · 범위 밖 · 빈 목록)', () => {
    const projections = [3, 1, 2, 9, 1].map((id, i) => ({ vocabulary: { id }, review: { i } }));
    const old = (p, v) => p.filter(row => v.some(word => word.id === row.vocabulary.id));
    const now = (p, v) => { const ids = new Set(v.map(word => word.id)); return p.filter(row => ids.has(row.vocabulary.id)); };
    for (const vocab of [[{ id: 1 }, { id: 3 }], [], [{ id: 9 }, { id: 7 }], [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 9 }]]) {
      expect(now(projections, vocab)).toEqual(old(projections, vocab));
    }
  });
});
