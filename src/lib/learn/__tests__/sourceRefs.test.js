import { describe, expect, it } from 'vitest';
import { collectSrcAttributions } from '../sourceRefs.js';

const SRC_A = { provider: 'tatoeba', id: 111, license: 'CC BY 2.0 FR', by: 'alice', grade: 'A' };
const SRC_B = { provider: 'tatoeba', id: 222, license: 'CC BY 2.0 FR', by: 'alice', grade: 'B', basedOn: 111 };

describe('sourceRefs — 실자료 출처 집계', () => {
  it('대화·예문·재노출 전 위치의 src를 provider·저작자 단위로 묶는다', () => {
    const chapter = { sections: [
      { dialogue: [{ speaker: 's', fr: 'a', ko: 'ㄱ', src: SRC_A }] },
      { examples: [{ fr: 'b', ko: 'ㄴ', src: SRC_B }, { dialogue: [{ speaker: 's', fr: 'c', ko: 'ㄷ', src: SRC_A }] }] },
      { original: { dialogue: [{ speaker: 's', fr: 'd', ko: 'ㄹ', src: SRC_A }] }, variant: { dialogue: [] } },
    ] };
    const refs = collectSrcAttributions(chapter);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ provider: 'tatoeba', by: 'alice', count: 4 });
  });

  it('src가 없으면 빈 배열 — 출처 블록 미표시', () => {
    expect(collectSrcAttributions({ sections: [{ examples: [{ fr: 'x', ko: 'y' }] }] })).toEqual([]);
  });
});
