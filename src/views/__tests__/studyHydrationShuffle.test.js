import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { seededShuffle } from '../../lib/seededShuffle.js';

/**
 * 계약: /study 첫 문항의 보기 · 토큰 순서는 서버 렌더와 첫 클라이언트 렌더가 같아야 한다(STUDY-HYDRATION-001).
 * 렌더 중 Math.random 셔플이 서버 · 클라이언트에서 다른 순서를 내 React #418(하이드레이션 불일치)이 났다
 * — M09 #1337 6176524870, 운영 098 · Preview 양쪽 재현. ReadingTextView의 문항 id 시드 셔플과 같은 해법.
 */
const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const session = read('src/views/StudySessionPage.jsx');
const page = read('src/app/(app)/study/page.jsx');

describe('학습 세션 보기 순서 — 서버 · 클라이언트 동일', () => {
  it('문항 보기 · 토큰은 shuffleSeed + uid 결정적 셔플 — 렌더 경로에 Math.random 없음', () => {
    const prepared = sliceBetween(session, 'const prepared = useMemo(() => {', '}, [item?.uid]);');
    expect(prepared).toContain('seededShuffle(arr, `${shuffleSeed}:${item.uid}`)');
    expect(session).not.toMatch(/Math\.random/);
  });

  it('서버 페이지가 요청마다 시드를 만들어 내려준다 — 세션마다 순서는 바뀐다', () => {
    expect(page).toContain('shuffleSeed={crypto.randomUUID()}');
  });

  it('같은 시드 = 같은 순서(원본 불변), 다른 시드는 순서가 달라질 수 있다', () => {
    const options = ['a', 'b', 'c', 'd', 'e', 'f'];
    const first = seededShuffle(options, 'seed-1:item-1');
    expect(seededShuffle(options, 'seed-1:item-1')).toEqual(first);
    expect(options).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect([...first].sort()).toEqual(options);
    const others = ['seed-2', 'seed-3', 'seed-4', 'seed-5'].map(seed => seededShuffle(options, `${seed}:item-1`).join(''));
    expect(others.some(order => order !== first.join(''))).toBe(true);
  });
});
