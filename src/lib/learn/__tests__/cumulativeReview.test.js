import { describe, expect, it } from 'vitest';
import { buildCumulativeReview } from '../cumulativeReview.js';
import frApi from '../../../content/french/index.js';

const mk = (slug, order, n = 3) => ({
  slug, order, title: `T${order}`,
  drills: Array.from({ length: n }, (_, i) => ({ id: `${slug}-d${i + 1}`, type: 'fill', prompt: `p___`, answer: 'a' })),
});

describe('누적 복습 — 매 5번째 챕터에서 직전 4챕터 드릴 재출제', () => {
  const level = Array.from({ length: 12 }, (_, i) => mk(`c${i + 1}`, i + 1));

  it('5번째·10번째 챕터에서만 4문항을 결정적으로 뽑는다', () => {
    expect(buildCumulativeReview(level, 'c3')).toEqual([]);
    const r5 = buildCumulativeReview(level, 'c5');
    expect(r5).toHaveLength(4);
    expect(r5.map((d) => d.sourceLabel)).toEqual(['T1', 'T2', 'T3', 'T4']);
    expect(new Set(r5.map((d) => d.id)).size).toBe(4);
    expect(buildCumulativeReview(level, 'c5')).toEqual(r5); // 결정적
    expect(buildCumulativeReview(level, 'c10')).toHaveLength(4);
  });

  it('드릴 없는 선행 챕터는 건너뛴다', () => {
    const sparse = [...level.slice(0, 3), { slug: 'c4', order: 4, title: 'T4' }, level[4]];
    expect(buildCumulativeReview(sparse, 'c5')).toHaveLength(3);
  });

  it('실데이터: fr A1 5번째 챕터(발음 뒤 첫 코어)에서 복습이 나온다', () => {
    const a1 = frApi.getGrammarChapters('A1');
    const fifth = a1[4];
    const r = buildCumulativeReview(a1, fifth.slug);
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r.every((d) => d.id.startsWith(`rev-${fifth.slug}-`))).toBe(true);
  });
});
